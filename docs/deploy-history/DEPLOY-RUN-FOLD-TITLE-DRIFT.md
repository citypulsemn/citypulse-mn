# Deploy — the run fold catches mid-string title drift

**Date:** 4 Nov 2026
**Touches:** `lib/multiday.ts`, `lib/upsert.ts`, `lib/ops-inputs.ts`, `lib/ops-digest.ts`
**Follows:** `DEPLOY-RUN-REFIND-FOLD.md`, which shipped the fold itself (`b8f0e74`)
and closed with this as "separate, measurable work"
**Schema:** none. No migration, no new column, no new table.

---

## What was still broken

The fold shipped earlier the same day declines a re-find of a run already on the
calendar. Its identity was an exact `runKey` plus one alias — the title with
parentheses *unwrapped* rather than deleted, repairing a normaliser artefact.

Neither sees a word change in the **middle** of a title, which is how the same
production actually arrives twice:

| live | re-find | what changed |
|---|---|---|
| Monsters on **Summer** Vacation (Special Exhibit) · May 23 → Jan 10 | Monsters on Vacation (Special Exhibit) · Aug 17 → Jan 10 | a word deleted |
| Como … – Daily **General** Admission · Oct 10 → Nov 10 | Como … – Daily **Open** Admission · Oct 24 → Nov 24 | a word swapped |

An exact key cannot see either. Neither can a prefix rule — `planCollapse`'s
`isWordPrefix` was measured against both and catches neither, which is one of
four reasons it was declined (see the previous guide).

## What shipped

One rule, in `planRunFolds`, beside the key and the alias rather than inside
`normalizeRunTitle`: a live run is also a candidate when it is in the **same
city** and its normalised title shares at least **0.75** of its words with the
incoming one, measured as token-set Jaccard (shared ÷ union).

Set-based, so it also sees a **reordering** no prefix or alias rule can:
`Sever's Fall Festival & Corn Maze` against `Sever's Corn Maze & Fall Festival`
scores 1.000.

Everything else is unchanged — `PER_NIGHT` still refuses sports and music before
any similarity is computed, run → run still holds, the keeper is still chosen by
the same sort, and the span still only ever extends through `greatest()`.

### Where 0.75 comes from

Measured over **every** overlapping same-city published run pair on the live
calendar — 125 runs, 116 pairs the key and alias do not already fold — walking
the whole band down to 0.30 rather than asserting a number:

| band | pairs the widening newly folds | verdict |
|---|---|---|
| ≥ 0.85 | 1 | real duplicate |
| ≥ 0.80 | 2 | real duplicates |
| **≥ 0.75** | **6** | **every one a real duplicate — but 2 are refused on shape, see below** |
| ≥ 0.70 | 6 | — |
| ≥ 0.65 | 7 | real duplicate (a third Fall Flower Show row) |
| ≥ 0.60 | 11 | all real duplicates (Como's "Daily Zoo Visit", SEA LIFE's two admission rows) |
| 0.500 | — | **the pair this project already established is WRONG**: `Nickelodeon Universe Winter Break – Universe of Light Holiday Light Show` against `Nickelodeon Universe Winter Break`, an umbrella listing and a year-round attraction inside it |
| 0.444 | — | the first pair no reader would call one event: `The Santa Experience at Mall of America` and `Festival of Trees at Mall of America`, sharing nothing but "at mall of america" |

That column counts candidate **pairs**, which is not the same as folds — the
replay below credits the drift rule with 3 productions, fewer than the 6 pairs
here. Both numbers are right: where several rows of one cluster overlap, an
incoming row's earliest candidate is sometimes reached by the exact key or the
alias instead, and the fold is then recorded as a key match. The drift rule is
only ever credited with what nothing else would have caught.

The previous guide put this figure at **8**, which counted drafts. The fold's
live set is `status = 'published'` only (one of this morning's four fixes), and
on published rows the count is 6. Measured both ways to be sure: 125 published
runs give 116 non-key overlapping pairs and 6 at ≥ 0.75; adding drafts gives 191
runs, 174 pairs and 8.

So the threshold sits a clear **0.25 above the nearest known-bad pair** rather
than up against it. It is conservative, not tuned: 0.60 would fold five more
pairs that are also real duplicates and still meet nothing wrong until 0.50.
Lowering it is a product call, and in this project coverage loss is the
expensive direction, so it stays where the evidence is unambiguous.

Arithmetically 0.75 means a word deleted from a four-word title (3 of 4 shared),
a word added to a three-word one, or — since a substitution costs two tokens —
one word swapped in a title of six or more shared tokens. Both motivating cases
are swaps carried by a long venue prefix. The same swap in a short title
(`Daily General Admission` on its own, 0.500) is **not** caught, deliberately,
and there is a test pinning that.

### Mid-string means mid-string: an appended word is refused

An adversarial review caught the first draft folding `Fall Flower Show – Part 2
Opening` onto `Fall Flower Show – Part 2` at 0.833, and that is not drift — it
is the **parent/child shape**, and folding it re-opens the exact hole reason 3
of the `isWordPrefix` declination was paid for: *a multi-day sub-event IS a run*,
so matching a prefix relation turns "run → run only" into "run → run, plus any
multi-day sub-event whose title begins with its parent's" — the class the
coverage rule exists to protect. Run-to-run alone does not close it: a single
dated performance has no span and is excluded for that reason, but a sub-event
that runs for days is a run like any other.

So the drift candidate now refuses `isWordPrefix` **in either direction**,
borrowing the same module-private helper `planCollapse` uses rather than
restating the idea. Measured: **2 of 8 drift folds were this shape**, both of
them that one pair; after the guard, 0 of 6 are.

Two things worth being precise about.

**A strict token superset would have been the wrong guard.** It also refuses
`{monsters, on, vacation}` ⊂ `{monsters, on, summer, vacation}` — the deletion
this rule was built for. The distinction that matters is *where* the extra word
sits: appended is parent/child, inserted is drift. There is a test pinning that,
and a mutation confirming the superset version turns the suite red.

**The guard declines a fold that was correct on identity**, and that should be
said plainly rather than smoothed over. Como publishes no opening night (below),
so those two rows really are one show. The gate refuses them anyway, because
nothing in the data distinguishes that pair from a real ticketed preview — and
here a wrong fold costs an event that silently never appears. One correct fold
is the price of closing the class. The Fall Flower rows now need a manual
dedupe as well as the date correction they already needed.

### The three productions, verified against their venues

A measurement says two rows are similar. It cannot say they are the same
production. All three were checked against the venues' own pages on 4 Nov 2026,
each by a researcher and then by two independent agents told to refute it — one
re-opening every cited URL to confirm the quotes, one arguing the opposite case.
**Zero refutations, and every host read fine** (including `mcm.org`, which has
blocked scripted fetches before; it served both tools today).

- **Fall Flower Show** — one show. Como's own Sunken Garden page is headed
  "Fall Flower Show 2026" and runs "September 18 through October 18 and October
  23 through November 29, 2026" in two halves it labels "Part 1" and "Part 2".
  There is **no opening, preview or members' night**: Como's own event sitemap
  carries fall opening-day pages for 2023 only, and Como Friends' upcoming list
  jumps from a December shopping evening to February. `– Part 2 Opening` is an
  aggregator's phrasing. **A test shipped this morning asserted the opposite**
  and has been corrected, with the evidence in the test.
- **Monsters on Vacation** — one exhibit. The official title has **no
  "Summer"**; "Monsters on Summer Vacation" is a *different* exhibit the museum
  ran in summer 2024, and the May 23 2026 – Jan 10 2027 window on that row is
  the 2026 exhibit's attested one. So the row is correctly dated and wrongly
  titled.
- **Como admission** — one thing, and that thing **is not an event**. Como is
  free ("Free." on its Hours & Admission page), publishes no product under any
  of these names, and a site search returns nothing for "Open Admission" or
  "Daily Zoo Visit". Three live rows invent dated 31-day windows around a
  standing year-round policy. Folding them is still correct; **archiving all of
  them is the real answer**, and this function cannot make that call.

### The keeper's title, which is the real cost

Once keys stop being identical the two rows hold genuinely different words, so
one of them is a better name. Be exact about which one survives: the
earliest-start sort only chooses among several **live** candidates, and the
incoming row never keeps — so for a two-row drift pair **the surviving title is
simply the one found first**. Replayed both ways on the real calendar,
`Fall Flower Show – Part 2` and `– Part 2 Opening` each keep when the other
arrives.

That has a measured consequence. The Monsters fold keeps
`Monsters on Summer Vacation`, a title the museum does not publish, on a listing
running into January. The fold **cannot make any title worse than one already
published** — both rows are live today — but it does stop the better-named
re-find from ever appearing again.

Three ways out were considered:

1. **Pick the keeper by title instead.** Rejected: it drops an attested earlier
   start, the axis readers plan around, and on the Monsters pair the earlier
   start is the *correct* window.
2. **Write the other row's title onto the keeper.** Rejected: a title rewrite is
   a product call, and `planRunFolds` has no business making one.
3. **Report it.** Shipped. A drift fold is flagged in `admin_audit` and named in
   the Monday ops email beside both titles, where a correction fixes the name.

The read path built in the previous patch is what makes (3) an answer rather
than a shrug. That is why it was built first.

### The reporting

`RunFold` gained `drift: boolean`, **derived from the keeper's own keys** rather
than carried from whichever candidate list found it — a row can match both ways,
and two sources of one fact drift apart. `foldRunRefinds` is only a courier for
it. The ops digest then draws a different line for each rule:

```
## Run folds
- 3 re-finds folded onto a run already listed
- 1 of them matched on title similarity, not an identical name
-     2026-11-04 · "Monsters on Vacation (Special Exhibit)" → kept "Monsters on Summer Vacation (Special Exhibit" (title similarity), span unchanged
-     2026-11-04 · "Twelve Kinds of Ice" → kept "Twelve Kinds of Ice", run extended to 2026-11-22
```

The count is its own line because the examples truncate at five, and it prints
**only when there is a drift fold** — "0 of them matched" is noise, and noise is
what trains a reader to skim.

## Verification

### Read-only, against production

Through the real `foldRunRefinds` query, with incoming rows built the way the
real caller builds them (`event_key`, not uuid — the namespace mismatch that
caused this morning's worst defect):

| | before | after |
|---|---|---|
| self-folds (a row declining its own re-find) | 0 | **0** |
| drafts in the live set | 0 | **0** |
| folds by key or alias | 16 | 14 |
| folds by title drift | — | **6** (3 productions, counted in both directions) |
| total folds | 16 | **20** |
| cost | — | **1.30 ms per incoming row**, 123 rows × 569 live in 160 ms |

**Key folds went 16 → 14, and that is worth understanding rather than
explaining away.** The widening does not only *add* folds — it can also give an
existing fold a different keeper, because a drift candidate that starts earlier
now enters a pool the key match used to have to itself. Measured by replaying
every published run against the gate with the rule on and off: **6 of 123
incoming rows reach a different outcome, 4 of them newly folded and 2
redirected.** Both redirections are in the Monsters cluster, and both move the
keeper from an August row to the **May 23** one — which is the exhibit's
attested opening date, confirmed at `mcm.org`. So the redirect is *more* correct
on the date axis, on the row whose title is wrong. It is also why the cluster
now collapses toward one row rather than the two the alias alone reached.

That is the whole trade in one line: the drift rule finds the correctly-dated
row and keeps its incorrect name, and the ops email is where that becomes
visible.

The similarity pass is a scan, not an index lookup — similarity has no key to
look up. At a weekly batch of ~120 rows that is ~15k comparisons of
already-normalised token sets, which is why `runs()` now carries `titleKey` and
`cityKey` instead of re-normalising inside the loop.

### The read path, end to end, without writing

No production fold has happened yet, so the live `--dry-run` renders the
zero-state and cannot exercise the drift line. Both halves were observed
separately:

- the gather's SQL expressions against **real Postgres** over a `VALUES`
  literal — the only way the `(patch->>'drift')::boolean` cast and its
  `coalesce` get exercised. `drift: true` → `true`, `drift: false` → `false`,
  and a **pre-drift row with no flag at all** → `false`, never null.
- the real `gatherOpsInputs()` output with that `folds` block through the real
  `composeOpsDigest` — the section renders in place between Jobs and Coverage,
  in **both text and HTML**.

### The gate

- `npx tsc --noEmit` clean
- `npm test` — **3,087 in 151 files** (was 3,069)
- `npm run build` clean
- `npm audit` — **0 vulnerabilities**
- `npm run ops-digest -- --dry-run` — section renders in place
- **22 mutations, every one confirmed to turn the suite red**, all four files
  restored byte-identical

The threshold mutations are the point of that pass. A test that expects `[]`
passes for any reason at all — a non-overlapping interval, a different city —
so each refusal had to be shown to refuse **because of the number it claims**:

| mutation | the test that must break |
|---|---|
| threshold → 0.60 | the 3-of-5 boundary pair folds |
| threshold → 0.50 | a short-title swap folds |
| threshold → 0.40 | Santa vs Festival of Trees folds |
| threshold → 0.85 | both named cases are lost |
| `>=` → `>` | the two pairs at exactly 0.75 are lost |
| city check dropped | a Duluth tour stop folds onto St Paul |
| word-prefix guard removed | the Fall Flower pair and the multi-day sub-event fold |
| guard checks one direction only (either one) | the pair in the unguarded direction folds |
| guard widened to a strict token superset | the Monsters deletion stops folding |
| Jaccard → containment | the 3-of-5 pair scores 1.0 |
| numerator + 1 | every score inflates |
| drift candidates removed | the named cases are lost |
| `drift` forced true | a plain weekly re-find reads as a judgement call |
| `drift` forced false | no fold is reviewable |
| `PER_NIGHT` filter removed | two near-identical game titles fold |
| applier stops carrying the flag | the cross-file tripwire |
| `coalesce` dropped from the cast | a pre-drift row reads as null |
| example marker deleted | **missed on the first pass — see below** |
| count line always prints | a quiet week gains a noise line |

One mutation was **missed**, and it is the same shape as the defect this
morning's review found: my digest test asserted the *renderer* against a
hand-written `examples` string, so deleting the marker from the **gather**,
where the line is actually built, broke nothing. Fixed with a gather-source
tripwire in the block that already exists for exactly this (`R2.3 — gather-side
tripwires`), then re-mutated in both directions. The lesson keeps being the
same one: a test that reads a fixture is not testing the thing that writes it.

## Deploy

```bash
git push                      # Vercel auto-deploys from main
```

Nothing else. No migration, no secret, no backfill, no cron change.

## Verify after deploy

1. **Nothing is broken now** — the gate only runs inside `upsertEvents`, so
   until the next pipeline pass nothing changes. `/admin/ops` should render
   **Run folds** between Jobs and Coverage, reading
   `no re-finds folded in the last 7 days`.
2. **After the next weekly pipeline run** (`.github/workflows`, Monday),
   check the Actions log for `[upsert] folded … (title similarity, not an
   identical name)`. Expect **3 productions' worth** of drift folds on the first
   pass — Monsters, Como admission and the Travail supper — then near zero,
   because each run collapses to one row. The Fall Flower Show is **not** among
   them: it is refused on shape (above) and needs a manual dedupe.
3. **Read the Monday ops email's Run folds section.** For every line marked
   `(title similarity)`, check the two titles beside each other and ask whether
   the kept one is the name the venue publishes. On the first pass at least one
   will not be — see the Monsters finding above.
4. **Watch `collapsed` in the Pipeline section.** Unchanged from the previous
   guide and still the tripwire: every span extension writes `multi_day_end`,
   the one column `collapseMultiDayRuns` reads, so each fold widens what
   `planCollapse` sees later in the same pass. Realistic expectation is archives
   3 → 6; a jump toward 29 means true spans have landed broadly and
   `planCollapse`'s own prefix fold is pulling in the dated performances this
   gate deliberately protects.
5. **If a fold was wrong**, the row was never inserted, so there is nothing to
   un-archive. The re-find returns on the next pass; correct the keeper's title
   or dates and raise the threshold if a class of pairs is wrong.

## Rollback

`git revert`. The gate only ever declines an insert and extends a span — it
deletes nothing and archives nothing, so reverting leaves no cleanup. Any span
extension it made is a value some row attested. The `drift` key in existing
`admin_audit` patches becomes ignored data; the digest's `coalesce` already
reads an absent flag as false, so a revert does not break the read path.

## Left open, honestly

- **Como's three admission rows are not events** and should be archived
  (`status = 'archived'`, never deleted) with the hours moved to the venue page.
  The fold reduces them from three rows to two. It cannot fix a row that should
  not exist. **This is the most substantive finding of the session and it is a
  data decision, not a code one.**
- **The Monsters survivor needs a title correction** to `Monsters on Vacation`,
  keeping the May 23 2026 – Jan 10 2027 window. Attested at `mcm.org`.
- **The Fall Flower Show needs a manual dedupe AND a date correction.** Three
  live rows, attested Oct 23 – Nov 29 2026, and none of them carries that end
  date. The drift rule deliberately will not touch them (the word-prefix guard),
  so this one is entirely a data decision: keep `Fall Flower Show – Part 2`,
  fix its dates, archive the other two.
- **Additive drift is still missed.** `Fall Flower Show – Part 2` against
  `2026 Fall Flower Show – Part Two (Lion-Inspired)` scores 0.444 — the year is
  normalised away but "two" and "2" are different tokens, and the parenthetical
  is unattested by Como anyway. Digit/word equivalence in `normalizeRunTitle`
  would catch it and would change `planCollapse`'s archiving in both directions,
  so it is its own measured item.
- **The digest truncates a title at 44 characters with no ellipsis**, so
  `Monsters on Summer Vacation (Special Exhibit` reads as a stored string.
  Cosmetic, pre-existing, and it sits in the instrument this patch relies on.
- Everything the previous guide left open is still open: `EventDetailBody:77`'s
  `· daily from <time>` on 82 listings, `isUpcoming` dropping an over-cap run
  after day one, the Grinch representation question, and the 22 surplus rows
  already live, which no prospective gate can reach.
