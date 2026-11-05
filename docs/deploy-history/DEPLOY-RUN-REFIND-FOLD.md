# Deploy — a long run stops being re-minted every Monday

**4 November 2026.** The pipeline was creating a **new published row every week**
for every long-running show. One pure function, one gate in the upsert write
path, 20 tests. Deploy is a push; no data migration.

## The defect

`event_key` is `sha256(title | venue | start DAY)`, and the pipeline writes the
day it **found** a show rather than the day the run opens. So every weekly pass
over the same production mints a fresh identity nothing can collide with:

```
Como Park Daily General Admission   Oct 10 → Nov 10
                                    Oct 17 → Nov 17      +7
                                    Oct 24 → Nov 24      +7
Twelve Kinds of Ice                 Oct 19, Oct 26, Nov 2  — all ending Nov 22
Kunene and the King                 Oct 10, Oct 15, Oct 29 — all ending Nov 8
A Christmas Carol                   Nov 11, Nov 26, Dec 5, Dec 26
```

The `+7` and the identical end date are the signature. Measured across the live
calendar on 4 Nov: **13 productions, 43 live rows, 30 of them surplus.**

## Why all three existing gates miss it

This is the session's recurring disease — several instruments each reading
something adjacent to what they claim to measure:

| gate | why it misses |
|---|---|
| `dedupeByKey` | compares `event_key`, and these differ **by construction** |
| `withoutLiveDuplicates` | loads only rows **starting on an incoming day**, so it never meets a run that opened weeks ago |
| `collapseMultiDayRuns` | hands `planCollapse` the **`multi_day_end` column alone**, so a run carried in `end_at` reads as a single day and 7 days of gap refuses the cluster |

The third is the sharpest: `collapseMultiDayRuns` runs in the weekly pipeline
(`run-pipeline.ts:256`) and its own comment says "planCollapse clusters on full
spans" — but it is not given the full span. `spanEnd()` treats a later-day
`end_at` as a span and so does `archivePastEvents`'s `coalesce(multi_day_end,
end_at, start_at)`. The collapse reader was the only one reading one source.

## The road not taken, and why

The obvious fix was to feed `planCollapse` the true span. **Measured first:**

```
rows the planner sees as a RUN   29  →  206
archives                          3  →  38      (35 newly archived)
```

Among those 35: `Twelve Kinds of Ice – ASL-Interpreted Performance`,
`– Saturday Matinee`, `– Sunday Matinees`, `Kunene and the King` on Nov 5 and
Nov 8. Those are **dated performances, and they are the calendar's coverage** —
a run longer than `EXPAND_MAX_DAYS` renders on its start day only, so the ASL
performance is the only card a reader gets on 14 November. That change would
have destroyed more coverage than the duplication it removed, and it would have
answered a product question (one span row, or many dated rows?) by side effect.

So the collapse is **untouched**, and the fix is narrow: fold **run onto run**.

## What shipped

`planRunFolds(live, incoming)` in `lib/multiday.ts` — pure, beside `runKey`,
`spanEnd` and `PER_NIGHT` so it reuses all three rather than restating any:

- only a row that **is itself a run** can be a re-find of one; a single dated
  row inside a run is left alone, deliberately
- `PER_NIGHT` (sports, music) is refused outright — consecutive days there are
  separately ticketed events, the rule the set exists for
- identity is `runKey` (title|city), **imported not restated**; a second
  definition of "the same event" is what let the other gates drift
- day intervals must **overlap**, inclusive: a re-find opening on the run's
  closing day is the same run
- the **earliest** run keeps the slot, then the longer — the keeper
  `planCollapse` would pick, so the two passes cannot disagree
- the span is extended **only** when the re-find reaches further

`foldRunRefinds` in `lib/upsert.ts` does three writes, not one:

1. **skip** the insert,
2. **extend** `multi_day_end` when the re-find reaches further,
3. **bump `last_seen_at`** on the keeper — because the point is that the run
   *received* this week's sighting. Leave it off and the keeper reads as
   abandoned, which is the live-duplicate freeze from the other side.

Plus a `run:folded` audit row carrying the blocked title, the keeper and the
extension.

### The alias key

Identity is `runKey` plus ONE alias: the title with parens **unwrapped** rather
than deleted. Five live rows for one exhibit keyed apart for a single reason —
`normalizeRunTitle` deletes parenthetical *contents*:

```
Monsters on Vacation (Special Exhibit)   runKey → "monsters on vacation"
Monsters on Vacation – Special Exhibit   runKey → "monsters on vacation special exhibit"
```

Those are the same words. The alias equates them and nothing looser; `runKey`
stays in the set, so an alias only ever ADDS a key. It lives inside
`planRunFolds` rather than in `normalizeRunTitle`, because unwrapping parens in
the normaliser would also SPLIT pairs that merge today (`Fair (Day Two)` keys to
`fair` now and folds into its parent) and change `planCollapse`'s archiving in
both directions.

Measured against the real rows the real query returns: **30 folds the exact key
already made, 3 that the alias newly makes**, and the survivor carries the clean
title in both Monsters folds.

### A read path, which this gate needed before any widening

The gate DECLINES AN INSERT, so a wrong fold is an event that silently never
appears. Its only traces were an `admin_audit` row — a table with no read path
in the app, which this very digest otherwise queries for exactly one unrelated
action — and a `console.log` in the Actions log.

A **Run folds** section in the Monday email and on `/admin/ops` now names every
fold of the last 7 days, with BOTH titles: the suppressed row and the keeper can
be worded differently, which is what the alias is for, and that is exactly when
the two need to be side by side. Zero renders as one plain line and does not
alert, because a week with no long run in the batch folds nothing. A failed read
says "unavailable" and alerts, so it can never read as a quiet week.

## Four defects an adversarial review found, three of them in this patch's own first draft

Reported honestly, because the first draft passed its full gate — tsc, 3,052
tests, build, audit 0 — and ten mutations, with all four of these live.

**1. A row folded onto ITSELF. 107 of 149 live runs.** `foldRunRefinds` gave
`planRunFolds` live rows identified by `id::text` (a uuid) and incoming rows
identified by `event_key` (a sha256). Its self-exclusion filter compared the two
namespaces and so could never fire. An ordinary re-find — same title, venue and
start day, therefore the SAME `event_key`, i.e. the normal `ON CONFLICT` update
— was declined, and with it every update that path carries: price, ticket_url,
`end_at`, a cancellation. The unit test `a row never folds onto itself` was green
throughout, because it passes one object as both sides, a shape production
cannot produce. Fixed by excluding live rows whose `event_key` is in the incoming
batch, the way `withoutLiveDuplicates` already does, and the CALLER is now pinned
in `lib/__tests__/upsert-queries.test.ts` rather than the pure function alone.

**2. A hidden draft could keep the slot.** The live read took
`status in ('published','draft')` and the keeper sort ignores status, so a draft
— a row held back on purpose by `statusForNewEvent` or `venueIsUnknown` — could
decline a re-find that would have been INSERTED VISIBLE (`status` is set on
insert alone). The event then rendered nowhere at all. 26 of 149 live runs are
drafts. Now `status = 'published'`, which also makes the predicate identical to
`archivePastEvents`'. Before this gate existed the outcome was a visible
duplicate, and this project holds coverage loss to be worse than duplication.

**3. A span could SHRINK.** Every `extendTo` is computed against the keeper's
pre-batch span, so two re-finds of one run in a single batch both carry a
non-null `extendTo` — and a bare `set multi_day_end = …` let the second, possibly
the nearer, win. The run then ended earlier than a source in that same batch had
attested, with the row that attested it already declined. Now
`greatest(<new>, multi_day_end, end_at)`: `end_at` is in there because `spanEnd`
prefers `multi_day_end` once it is set, so writing a nearer span over a further
`end_at` would shrink the run as the site reads it. Spans only ever extend, per
keeper rather than per fold.

**4. The instrument could kill the panel — rule 1.** The `admin_audit` insert was
unguarded, and it runs AFTER the span and `last_seen_at` writes have committed.
One pooler timeout would have aborted the whole pipeline pass mid-run, skipping
every remaining band, with mutations applied and no trace of why. Now wrapped,
with a warning line.

### The venue-suffix alias, measured and declined

Stripping a trailing ` at <the row's own venue>` would have folded the third
Monsters row too. Both rows strip their OWN venue, so they meet on the bare
remainder and two DIFFERENT venues in one city get equated — measured,
`Festival of Trees at Mall of America` absorbing `Festival of Trees at
Bloomington Center for the Arts`, both in Bloomington. A word-count floor does
not close it: the three-word holiday names are exactly the colliding ones. All 7
historical cross-venue folds were in fact correct, but a wrong one here is an
event that silently never appears. It also caused the survivor inversion this
guide rejects `isWordPrefix` for, on 5 rows. Declined, with a test pinning the
decision. The cost: the Monsters cluster folds to two rows, not one.

## Tests

**19 golden tests** on the pure planner — the boundary (opening on the closing
day folds; the day after does not), honest emptiness, a tour stop of the same
show in another town, the coverage case as its own test, the alias artefact, and
the declined venue alias pinned so the decision cannot be undone by accident.
**13 query-text tripwires** on the SQL the unit suite cannot execute, including
the four defects above and one asserting the writer's action string and patch
keys match the reader's. **5 tests** on the digest section.

Mutation-proved in **fourteen** directions, every one caught, all three files
restored byte-identical:

| mutation | |
|---|---|
| unmutated | GREEN |
| the parens-unwrapped alias is gone | **RED** |
| the alias REPLACES `runKey` instead of joining it | **RED** |
| the alias drops the city (a tour stop reads as a re-find) | **RED** |
| the self-fold returns: live rows carrying an incoming `event_key` are kept | **RED** |
| drafts may keep a slot again | **RED** |
| the span is assigned, not `greatest()` | **RED** |
| the audit insert is unguarded again (rule 1) | **RED** |
| the keeper's title is no longer recorded | **RED** |
| the action string drifts from the reader's | **RED** |
| zero folds renders as a count, not the honest line | **RED** |
| the folds are counted but not named | **RED** |
| a failed folds read falls through to a reassuring zero | **RED** |
| the section calls them "weekly" re-finds again | **RED** |

The earlier pass of eight mutations on the planner alone (`PER_NIGHT` no longer
refused, a dated performance may be folded, overlap made exclusive, the span
always rewritten, the latest run keeps the slot, only `end_at` read) was also
caught in every direction — and caught none of the four defects above, which is
why the review happened.

## Verified against the real database, read-only

The SQL has never run in CI, so it was executed against production directly —
`as end` is accepted (a reserved word is legal as an `AS`-prefixed alias) and
returns exactly the keys the planner consumes: `id, title, city, category,
start, end, multiDayEnd`, 696 rows on a 1 Nov lower bound.

Then the real query's rows were fed the synthetic re-finds next Monday would
produce:

```
FOLDED  Twelve Kinds of Ice   → kept d39edbca (Oct 19), span unchanged
FOLDED  Como Daily Admission  → kept b506f130 (Oct 10), extend to 2026-12-09
FOLDED  A Christmas Carol     → kept e2721ea1 (Nov 11), span unchanged
insert  a run nothing matches        (correct)
insert  a dated performance          (correct — coverage preserved)
```

And replayed historically, each cluster in the order it actually arrived: **8
rows blocked, 20 left live** — the 20 being dated performances and genuinely
separate weekend runs (European Christmas Market's three weekends, the
Christkindl weekends, the Bell Museum's weekly blocks), none of which overlap.

## Quality gate

- `npx tsc --noEmit` — clean
- `npm test` — **151 files, 3,069 tests** (3,032 → 3,069), green
- `npm run ops-digest -- --dry-run` — the Run folds section renders, in place
- `npm run build` — clean
- `npm audit` — **0 vulnerabilities**

## Deploy

Push to `main`; Vercel auto-deploys. Nothing to run, no schema change, no data
migration. The gate takes effect on the **next weekly pipeline run**.

## Verify, after the next pipeline run

```bash
npm run ops-digest -- --dry-run
```

Then check the trail directly:

```sql
select patch->>'title', patch->>'kept', patch->>'extended_to', at
from admin_audit where action = 'run:folded' order by at desc limit 20;
```

The Monday email now carries this as its **Run folds** section, so the SQL is
only for digging further.

What to expect, and the two numbers that mean trouble:

- **Around 16 folds on the first full pass** — that is how many genuine
  duplicate runs the live calendar held on 4 Nov, measured through the real
  planner. A handful a week after that.
- **Zero after a full pass is a signal to investigate**, not a pass: either
  nothing was re-found, or the gate is not firing.
- **A number near 100 means the self-fold is back** (defect 1 above). 107 of 149
  live runs would have declined their own re-find. If the count jumps to three
  figures, rows are being blocked from their own `ON CONFLICT` update and the
  weekly `upserted` count will drop by about the same amount — which would read
  as another supply cliff rather than as a bug.

**Also watch `collapsed` in the Pipeline section**, which already carries a delta
against the previous run. The fold cannot extend a span without writing
`multi_day_end`, and that is the one column `collapseMultiDayRuns` reads — so
every extension widens what `planCollapse` sees later in the same pass.
Measured on the real calendar: realistically archives go 3 → 6, the new ones
being genuine surplus copies of Jeyifous and Como Park, with no survivor
renamed. But if true spans ever land broadly in `multi_day_end`, the worst case
is 3 → 29, and the 26 would include `Twelve Kinds of Ice – ASL-Interpreted
Performance`, `– Sensory-Friendly Performance`, `– Saturday Matinee` and
`Kunene and the King – Final Weekend` — the dated performances this guide says
must stay live, pulled in by `planCollapse`'s own `isWordPrefix` fold once a
parent carries a wide span. A jump in `collapsed` is the tripwire for that.

## Rollback

`git revert`. The gate only ever *declines* an insert and extends a span; it
deletes nothing and archives nothing, so reverting leaves no cleanup. Any span
extension it made is a value the re-find attested.

## Left open, honestly

- ~~**Mid-string title drift is still not caught.**~~ **SHIPPED the same day —
  see `DEPLOY-RUN-FOLD-TITLE-DRIFT.md`.** The alias key handles the punctuation
  artefact; it did nothing for `Monsters on Summer Vacation` vs `Monsters on
  Vacation` (a word deleted) or Como's `Daily General Admission` vs `Daily Open
  Admission` (a word swapped). Those are a SIMILARITY problem, and a token-set
  (Jaccard) threshold at ≥ 0.75 catches both, including word *reordering* no
  prefix or alias rule can see (`Sever's Fall Festival & Corn Maze` ↔ `Sever's
  Corn Maze & Fall Festival`, 1.000).

  Two numbers in this bullet were wrong and the follow-up corrected them. "8
  both-live pairs" counted drafts, which the fold's live set excludes; on
  published rows the widening folds **6** pairs the key and alias do not. And
  the survivor-inversion risk was framed as a flaw in the rule when it is a
  property of the gate: the keeper is whichever row is already live, so a drift
  fold cannot make a title worse than one already published — it only stops the
  better-named re-find from returning. That is reported rather than resolved,
  which is what the read path above was built for.

## The isWordPrefix widening, measured and declined

Borrowing `planCollapse`'s `isWordPrefix` parent-child rule (same city, shorter
key ≥ 2 words, intervals overlapping) folds **14 further pairs** across the live
calendar — 9 of them on rows dated today or later. Declined, for four reasons
measured in that order of weight:

1. **It renames the survivor, on 3 of its own 9 folds.** `planRunFolds` keeps
   the earliest start with no title tie-break, while `planCollapse` deliberately
   prefers the *shorter* key (lines 307-315). So wherever the longer title was
   found first, the fold keeps it: the site would show a month-long show titled
   `Fall Flower Show – Part 2 Opening`, the whole Como show carrying
   `– Lion-Themed Second Half`, and one sub-show's name on the entire
   Nickelodeon winter break. The moment keys stop being identical, the keeper
   needs a title tie-break — with exact matching the question could not arise.
2. **One fold is simply wrong.** `Nickelodeon Universe Winter Break – Universe
   of Light Holiday Light Show` (11-12) absorbs `Nickelodeon Universe Winter
   Break` (11-26). The Universe of Light is a year-round attraction with its
   own page; the holiday show has its own attested range. Keeper = earliest
   start, so the fold drops the **broad** listing and keeps the sub-show. That
   is the harmful direction.
3. **It punches through the protection this patch just shipped.** "Run → run
   only" keeps sub-events out, and it holds only because a single dated
   performance has no span. A multi-day sub-event *is* a run, so prefix matching
   turns the rule into "run → run, plus any multi-day sub-event whose title
   begins with the parent's" — the class the COVERAGE test exists to protect.
4. **It catches neither motivating case.** `monsters on summer vacation` deletes
   a word mid-string and the admission pair swaps one; neither is a word prefix.
   (Weak on its own — incompleteness is not a veto — but it means the change
   buys nothing for the defect it was opened for.)

And the measurement's own framing was off: a write-path gate blocks an
**incoming** row, so every pair above is a row already live that the gate cannot
touch. Its benefit is entirely prospective; its cost lands immediately.

### What the measurement says to do instead

- **The Monsters cluster is a normalizer artifact, not drift.**
  `normalizeRunTitle` deletes parenthetical *contents* (line 44), so
  `Monsters on Vacation (Special Exhibit)` and
  `Monsters on Vacation – Special Exhibit` key differently for titles a reader
  calls identically spelled; a third row appends ` at <venue>`, an aggregator
  formatting artifact. Generating two **alias keys** inside `planRunFolds` —
  parens unwrapped rather than deleted, and a trailing ` at <the row's own
  venue>` stripped — gives all three variants one key. Verified against the real
  normalizer: **5 folds, 0 wrong, 0 ambiguous**, and Travail, Nickelodeon and
  the Fall Flower Show pairs share no key at all. That cluster is **5 live rows
  for one exhibit**, the largest single duplication on the calendar. Keep the
  aliases inside `planRunFolds`: unwrapping parens inside `normalizeRunTitle`
  itself would also *split* pairs that merge today (`Fair (Day Two)` folds into
  its parent now and would stop), changing `planCollapse`'s archiving in both
  directions.
- **The fold has no read path.** `admin_audit` is not read by the app, and the
  ops digest queries that table for exactly one action,
  `import_music_review` (`lib/ops-inputs.ts:176`). Every `run:folded` row this
  patch writes lands where no human surface reads it — the only other trace is a
  `console.log` in the Actions log. A fold count in the ops digest is cheap, and
  is worth having **before** any widening of this gate, the narrow one included.
- **The duplicate-card harm is not on day pages.** Every parent here runs 20-146
  days, so each row renders on its own start day only and they never collide in
  the calendar grid. The harm lands on `/ongoing` and `/this-weekend`, which use
  the true uncapped span — five identical Monsters cards on a shelf capped at 12.
- **The two named cases are a similarity problem, not a prefix one.** A token-set
  (Jaccard) threshold at ≥ 0.75 catches both, and across the whole table its
  bottom band holds no false positive I could find; on rows both-live it folds 8
  pairs, 0 wrong, including word *reordering* that no prefix rule can see
  (`Sever's Fall Festival & Corn Maze` ↔ `Sever's Corn Maze & Fall Festival`,
  1.000). The repo already uses `word_similarity > 0.6` on venue
  (`lib/upsert.ts:388`), so the tool is not foreign. But it carries the same
  keeper-title inversion as (1), and it misses the Monsters cluster entirely
  (0.600 / 0.556). Separate, measurable work — not a rider on this patch.
- **This stops the bleeding; it does not clean the wound.** 9 productions and
  22 surplus rows are already live. They need corrections (6 were applied
  earlier today) or a one-off collapse run.
- **The Grinch representation question is still open** — `abdc06be`, the
  correctly dated Nov 3 – Jan 3 run row, is live beside four dated performances
  and puts two cards on `/this-weekend` on three weekends. The fold would not
  have created that and will not fix it; it is the product call about whether a
  theatre run is one span or many dated rows.
- **`EventDetailBody:77`** still prints `· daily from <time>` on 82 listings,
  including the Carol survivor at "daily from 7:30 PM" across 47 days with 1 PM
  matinees. Not reachable by a correction (`all_day` is not a `Correction`
  field) and not touched here.
- **`isUpcoming`** reads `daysSpanned().at(-1)`, so an over-cap run is not
  upcoming the day after it opens and leaves the venue, city and neighborhood
  pages. Unrelated to this change, and the larger of the two code defects.
