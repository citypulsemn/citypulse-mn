# Deploy — a run whose span lives in `end_at` clustered as a single day

**Date:** 10 November 2026
**Code:** `lib/multiday.ts` (`planCollapse` clustering + span writing), tests in `lib/__tests__/multiday.test.ts`
**Data:** `npm run collapse` applied (13 actions, 31 rows archived) plus one correction,
`corrections-grinch-title-variant.json`
**Schema:** none.

Children's Theatre Company's *Dr. Seuss's How the Grinch Stole Christmas!* was **8 published rows
for one engagement**, two of which rendered back to back in the homepage Trending strip. It is now
one row. The cause was not the Grinch's, and it was still happening to other listings the day this
was written.

---

## Two causes, not one

### 1. Clustering could not see a span stored in `end_at` (6 of the 8 rows)

`planCollapse` clusters on intervals, and its rule list promises:

> Weekly series never merge: a 7-day gap between single-day rows always splits clusters.
> **Only a row whose days touch a run's span (gap ≤ 1) joins.**

The interval came from `rowEndNum`, which reads **`multi_day_end` alone**. But the pipeline inserts
a whole run it finds as one row with the last day in **`end_at`** — `CollapseRow.end`'s own
docstring says exactly that ("a run inserted as one row carries its last day here"). Such a row
therefore clustered as a **single day**. For those runs there was no span to touch.

So each unbroken week of performances formed its own keeper, and the row that knew the real run sat
beside them unable to take any of them in. A theatre dark on Mondays splits every week:

```
LIVE 2026-11-03 → 2027-01-03 (end_at)   the real run, absorbing nothing
LIVE 2026-11-12 → mde 2026-11-13        one keeper
LIVE 2026-11-15                         one keeper
LIVE 2026-11-19 → mde 2026-11-22        one keeper
LIVE 2026-11-24 → mde 2026-11-25        one keeper
LIVE 2026-11-27 → mde 2026-11-29        one keeper
LIVE 2026-12-02 → mde 2026-12-06        one keeper
```

**This was live, not historical.** The planner was still producing the same split for *Dune: Part
Three* (5 keepers) and *Winter Waltz* (3) on the day of the fix.

### 2. A title that is a word SUFFIX of another (1 row)

The eighth row was `How the Grinch Stole Christmas` — the same show without the `Dr. Seuss's`
prefix. `runKey` compares normalised titles **exactly**, and the parent-child fold uses
`isWordPrefix`, so a suffix reaches neither. Jaccard on the word sets is 0.714, just under the
fold's 0.75 gate, but that gate lives in `planRunFolds` (the upsert path), not here.

Fixed as **data, not code**. Changing `normalizeRunTitle` to strip a leading brand possessive would
be a global rule written to fit one row; the normaliser is deliberately a whitelist. Reported under
*Left open* instead.

---

## The fix

One helper swapped at two call sites:

```ts
const e = perNight ? s : keeperEndNum(row);          // clustering interval
: Math.max(...cluster.rows.map(keeperEndNum));       // the span written
```

`keeperEndNum` goes through `spanEndISO`, the site's own span rule, late-night carve-out included.

**This does not widen the gap rule.** A single-day row has `start == end` by either column, so
"weekly series never merge" is untouched. Only rows that genuinely carry a span stop being mistaken
for single days.

**The keeper order was left alone**, still on `rowEndNum` — three review rounds on 9 Nov 2026
regressed on reordering it.

### The second call site was a regression I introduced and the differential caught

Changing clustering alone was wrong. Once a row is absorbed *because* of its `end_at`, the span
**written** has to read the same column, or the absorbed row is archived and the days it attested
are lost. *And Then There Were None* at the Guthrie: a 12–25 Dec keeper absorbing a **26 Dec –
26 Jan** row wrote a span of `2026-12-26` and dropped a month of the run. Review did not find this
— the old-vs-new diff did, on the first run.

---

## The differential check, written before the change

[Three review rounds of reordering `planCollapse` have regressed](DEPLOY-4.4.1-SPAN-AWARE-COLLAPSE.md),
so the harness came first: snapshot every action for the **real 968-row live set** plus nine
generated cases pinning the documented invariants, then re-run and diff.

| generated case | before → after |
|---|---|
| weekly series must never merge | 0 → 0 |
| sports never merge across days | 0 → 0 |
| music never merges across nights | 0 → 0 |
| adjacent days still cluster | 1 → 1 |
| late night is not a span | 0 → 0 |
| corrected rows never planned | 0 → 0 |
| draft rows never planned | 0 → 0 |
| a run in `multi_day_end` absorbs (control) | 1 → 1 |
| **the Grinch shape: a run in `end_at`** | **3 → 1** |

The control matters: the *same dates* in the other column always worked. That is what makes this a
column bug rather than a gap problem.

On the live set the change is **strictly additive** — 0 actions removed, **0 actions changed**,
5 added, 10 rows newly archived, 0 rows no longer archived.

All five new actions were checked against the listings before applying:

| keeper | absorbs |
|---|---|
| Grinch, 3 Nov → 3 Jan | its 6 weekly keepers |
| And Then There Were None, 12 Dec | the 26 Dec – 26 Jan row (span written: 2027-01-26) |
| Nickelodeon Universe Winter Break, 12 Nov → 31 Dec | a shorter duplicate inside it |
| Maybe Happy Ending, 17–22 Nov | "– Weekend Performances", 22 Nov |
| Twelve Kinds of Ice, 13 Oct → 22 Nov | "– Sunday Matinees", 8 Nov |

---

## Verification

```
Grinch rows: 24   published 8 -> 1   archived 16 -> 23
npm run collapse: 13 actions, 31 rows archived, 968 -> 937
after the title-variant correction: 936
npm run collapse --dry-run now: 0 action(s)
```

Rendered, on a cold build:

- **Event page:** `HAPPENING NOW · Nov 3 – Jan 3 · runs 62 days`, matching the row's own
  description ("running November 3, 2026 through January 3, 2027").
- **Homepage:** one Grinch card where there were two.
- **`/ongoing`:** carries it once.

### Mutation

| mutation | tests that failed |
|---|---|
| clustering back to `rowEndNum` | 3 |
| the span written back to `rowEndNum` | 1 |
| gap widened from 1 to 7 | 4 |

The third is the guard that this stayed a column fix and never became a gap change — it fails the
pre-existing "weekly series never merge" test plus the three added here.

### Quality gate

| | |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` | **3,419 passed in 156 files** (8 new) |
| `npm run build` | clean |
| `npm audit` | **0 vulnerabilities** |

### Backups

- `Documents/CityPulseMN/backups/2026-11-10-collapse-run-clustering-before.json` — all 968
  published/draft rows, taken before the collapse
- `...-grinch-title-variant-before.json` and `...-grinch-title-variant-applier.json`

---

## Deploy

The data is already applied to production Supabase and caches were cleared by both appliers.

```bash
git add lib/multiday.ts lib/__tests__/multiday.test.ts corrections-grinch-title-variant.json docs/deploy-history/DEPLOY-RUN-IN-END-AT-CLUSTERING.md
git commit -m "fix — one theatre run was eight listings because its span sat in the wrong column"
git push
```

## Rollback

Code: `git revert` — one helper at two call sites. Data: the collapse is reversible from the
968-row backup by restoring `status` and `multi_day_end` on the affected ids.

---

## Left open

- **A mid-run day page no longer shows the Grinch.** At 62 days the run is far over
  `EXPAND_MAX_DAYS`, so it leaves the day grid and lives on `/ongoing` and in the "21 also
  running" count. Before the fix a reader on 20 November saw a card — but that card was a
  **fabricated 4-day span**, one of the bogus weekly keepers. The site now shows the truth, which
  the 14-day cap keeps off the grid. Same consequence as the
  [Monsters and Fall Flower dedupe](DEPLOY-MONSTERS-FALLFLOWER-DEDUPE.md); the cap itself is a
  decided product question, not reopened here.
- **Dune: Part Three is still 5 cards, Winter Waltz 3.** Unchanged by this fix, and deliberately:
  no row attests either whole engagement, so merging them would need the gap rule widened, which
  the tests above now forbid. The honest floor is to merge only what a row attests.
- **A word-SUFFIX title still never folds.** `runKey` is exact and the parent-child fold is
  prefix-only, so `X` beside `Brand's X` stays two rows. One instance archived by hand here. A
  rule for it belongs with the Jaccard matcher in `planRunFolds`, measured against the whole
  corpus, not tuned to this case.
- **`staleSpanIds` still ignores `status`** (noted 10 Nov in
  [DEPLOY-DECEMBER-RUN-ENDS.md](DEPLOY-DECEMBER-RUN-ENDS.md)).
