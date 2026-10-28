# Deploy — the collapse pass can now un-make a span, not only make one

**28 Oct 2026.** One pure function, four files, five tests. No schema change.
Three data passes, **two of which you have to run** — the live applies were
refused to me by the permission layer and are listed under Deploy.

## What was wrong

Six upcoming music listings carried a `multi_day_end`, which the site renders
as a date span. All six were two-night stands: one card reading "Nov 13 – 14"
where there are two separately-ticketed shows. On **five of the six**, the
second night already had its own published card, so day two showed the same
show twice — once as itself, once as the tail of its neighbour's span.

| listing | span | day two |
|---|---|---|
| Phantom of the Opera · Fitzgerald | Oct 31 → Nov 1 | Nov 1 matinee published separately |
| The Many Deaths of Laila Starr · Ordway | Nov 7 → Nov 8 | Nov 8 matinee archived |
| Schubert Club Presents (Concert) · Ordway | Nov 10 → Nov 11 | Nov 11 published (twice) |
| Schubert Club IAS: James Ehnes · Ordway | Nov 10 → Nov 11 | Nov 11 published (twice) |
| The Suburbs · Turf Club | Nov 13 → Nov 14 | Saturday published separately |
| Angine de Poitrine · First Avenue | Dec 1 → Dec 2 | Dec 2 published separately |

The pass found **nine**, not six: my query filtered to upcoming published rows,
and the collapse pass has no date filter. The other three are past drafts with
placeholder titles (`Show (Aug 28)`, `Show (Sep 1)`, one Berlin row) — nothing
reader-facing, cleared for tidiness.

## Why they existed, and why nothing caught them

`PER_NIGHT` in `lib/multiday.ts` is the rule that a sports game and a night of
a stand are separately ticketed, so consecutive days never form a run. It is
enforced **at write time only**, and the set has grown twice: sports from the
start, music on **29 Sep 2026** after five two-night stands were nearly folded.

Growing it stops new folds. It does nothing about spans already stored. There
was no reconcile and no detector, so those six sat on the live calendar for
**29 days** — and the same thing happened in July, when sports joined and 14
legacy sports spans had to be cleared by hand because no lever existed.

The sharp edge: **`planCollapse` already disbelieves these spans.** Its
`perNight` guard treats such a row as a single-day interval whatever
`multi_day_end` says — a guard added in July precisely so a corrupt span could
not absorb real games. The site has no such guard. It reads `multi_day_end`
directly. So the planner and the renderer disagreed about the same column, and
the renderer is the one readers see.

## The fix

`staleSpanIds(rows)` — ids whose stored span the current rules would never have
written. One filter, beside the `PER_NIGHT` set it reconciles, so the two can't
drift. Called from **both** appliers:

- `scripts/collapse-multiday.ts` — reports each one by title (`CLEAR "The
  Suburbs" 2026-11-13 — drop the span to 2026-11-14`) and clears on apply.
- `lib/upsert.ts collapseMultiDayRuns` — so the weekly pipeline heals this
  without anyone remembering, and `run-pipeline.ts` says so when it does.

Clearing is durable: **nothing else writes `multi_day_end`.** Only these two
appliers and the operator corrections lever, and for a per-night category the
planner now emits `setEnd: null` every time.

The load-bearing test is the invariant, driven through the public API:

> the set of categories that **refuse to write** a span must be exactly the set
> whose stored spans get **cleared**

Those two were different sets for 29 days. Adding a category to `PER_NIGHT` can
no longer move one half without the other. The rest of the tests cover the
six live rows, the July sports class, a genuine festival run left alone, and the
boundaries — an `endDay` on the start day, an `endDay` before it, no category —
none of which `spanEnd()` renders, so none of which this function touches.

## What clearing the spans exposed

Two problems the span was hiding. Both are listings on the live calendar.

### The Minnesota Opera premiere is postponed

`mnopera.org` is now headed **"Postponed: The Many Deaths of Laila Starr"**:
*"Minnesota Opera Announces Postponement of The Many Deaths of Laila Starr
World Premiere"*. Ticketholders were emailed about their options, and no
performance dates remain anywhere on the page.

We have **three published rows** for it — **Oct 31**, Nov 5 and Nov 7. The first
is this Saturday. All three go to `cancelled`, which is the status the project
already defines for this (`prompts.ts`: *"a source explicitly says
cancelled/postponed"*): off every list, page survives carrying
*"This event has been cancelled."* That is the right outcome for a postponement
— someone who searches for it finds out, rather than finding nothing.

Ten further Laila Starr rows are already archived and stay that way.

### One recital, five cards

The Schubert Club's Ehnes engagement is **two** performances — schubert.org
lists exactly *"Tuesday, Nov 10, 2026 at 7:30 p.m."* and *"Wednesday, Nov 11,
2026 at 10:30 a.m."*, both "James Ehnes, violin & Andrew Armstrong, piano". We
published **five rows** for them: three for Nov 10, two for Nov 11.

So no second night needed restoring here — the archived Nov 11 row I first took
for a folded second night is a **fourth** copy, and publishing it would have
made three cards for a morning recital.

Keeping one per performance, both titled as the presenter titles them, and
moving their citations from the Ordway's index page to the Schubert Club's own
listing. Archiving the other three.

`Schubert Club Presents (Concert)` with its Nov 10–11 span is **not** invented,
and I nearly recorded that it was. The Ordway's own index prints the engagement
as one entry: *"Schubert Club Presents / James Ehnes, violin / November 10 – 11,
2026 • Ordway Concert Hall"*. The pipeline read the venue's range notation
correctly. It is a duplicate, not a fabrication, and it gets `archive` — which
keeps its page — rather than the `hide` a fabrication gets.

## Deploy

Code first; it is inert until a collapse pass runs.

```bash
git push origin HEAD:main
```

**Then the three data passes, in this order.** The order matters: the collapse
pass reads only `published` and `draft` rows, so cancelling the Nov 7 Laila
Starr row first would hide its span from the clear.

```bash
npm run collapse -- --dry-run
```

Expect `9 stale span(s)` and **4 run actions archiving 16 rows**. Those four are
the Bell Museum exhibition — "Selections from Creating Art, Thinking Science" is
twenty daily rows for one show, Wed–Sun over four weeks, and the pass folds each
week into a span. That is its designed job and Monday's pipeline would do it
anyway; it is not part of this change. If you would rather it did not happen
yet, stop here and say so — the span clear can wait for Monday too.

```bash
npm run collapse
```

```bash
npm run verify -- --from=verdicts-laila-postponed.json
```

Free — no model call, Postgres only. Expect `cancelled 3`. Add `--dry-run`
first if you want to see it; it has been rehearsed and routes 3 cancels, 0
dropped.

```bash
npm run correct -- --from=corrections-ehnes-dedupe.json --apply --backup=C:/Users/mccul/Documents/CityPulseMN/backups/2026-10-28-ehnes-before.json
```

Expect 2 edits and 3 archives, 0 refused. Rehearsed as a dry run.

Then delete the working files — `corrections*.json` and
`verdicts-laila-postponed.json` in the repo root, including the four left from
this morning. None are tracked.

## Verify

```bash
npm run collapse -- --dry-run
```

`0 stale span(s)` — and it stays zero, because the pass now removes them.

On the site:

- **Nov 13** — The Suburbs appears once, not twice, and the card reads a single
  date rather than "Nov 13 – 14". Same on **Nov 1**, **Nov 14**, **Dec 2**.
- **Oct 31 and Nov 5 and Nov 7** — no Laila Starr on the calendar. Open one of
  its pages: it renders with the cancelled banner and no ticket button.
- **Nov 10** — one James Ehnes card, not three. **Nov 11** — one, not two.
- The Bell Museum exhibition shows four week-long cards instead of twenty daily
  ones.

Backup of all 829 upcoming rows, every status, taken before any write:
`C:\Users\mccul\Documents\CityPulseMN\backups\2026-10-28-spans-before.json`.

## Rollback

```bash
git revert <sha> && git push origin HEAD:main
```

Reverting restores the old behaviour — spans stop being cleared; it does not put
back spans already cleared, and you would not want it to.

The data is reversible from the backup above: it holds `multi_day_end` and
`status` for every row touched. The three archived Ehnes rows and the three
cancelled Laila Starr rows can go back with `publish: true` through the
corrections lever. If the opera announces new dates, the cancelled rows are the
rows to re-date — do not let the pipeline insert fresh ones beside them.

## What this does not fix

- **Five spellings of one address, and that is why there were five Ehnes
  cards.** `Ordway Music Theater`, `Ordway Concert Hall`, `Ordway Concert Hall
  (St Paul)`, `Ordway Center for the Performing Arts – Music Theater`,
  `Ordway Center for the Performing Arts – Concert Hall` — all at 345
  Washington Street, all on the identical pin. Dedup clusters on title + city,
  so same-venue-same-minute rows with different titles never meet. A venue-alias
  table would have caught all three Ehnes duplicates and probably more; it is
  also a change to the dedup key, which is the riskiest thing in the pipeline.
  Worth its own session.
- **Four cards for the Bell Museum exhibition rather than one.** The planner
  splits on the two-day closure gap, which is the same rule that protects a
  weekly series from being folded. Changing it is a real decision, not a tidy-up.
- **Nothing reconciles `end_at`.** `spanEnd()` reads a later `end_at` as a span
  too. `Schubert Club Presents` carried `end_at` of Nov 11 21:30 — a 7:30pm
  concert "ending" the next night. Its row is being archived, so that one is
  moot, but the general case is unchecked.
