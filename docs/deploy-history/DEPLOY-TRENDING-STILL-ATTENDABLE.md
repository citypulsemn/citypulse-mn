# Deploy — "still attendable" on the trending strip asked the wrong question

**Date:** 10 November 2026 · **Files:** `lib/trending.ts`, tests in `lib/__tests__/trending.test.ts`
**Schema:** none. **Data:** none. One SQL predicate.

`getTrendingEvents` gated its stats join on:

```sql
and coalesce(e.multi_day_end, e.end_at, e.start_at) >= now()
```

The comment above it says "still attendable". That is `isEnded`'s question, and `isEnded`
([lib/event-view.ts:34](../../lib/event-view.ts)) answers it by taking the **latest** of the
three stamps:

```ts
const endWall = [event.start, event.end || "", event.multiDayEnd || ""].reduce((a, b) => (b > a ? b : a));
```

`coalesce` does not take the latest. It takes the **first non-null**, so it *prefers*
`multi_day_end` even when an `end_at` beyond it exists. Where those two disagree, the strip
drops a run while every page on the site still calls it live.

Four surfaces read this function: the **homepage** strip, `/collections`,
`/collections/trending`, and the ops digest's trending section.

---

## Measured before changing anything

| | |
|---|---|
| published rows | 734 |
| rows where `coalesce` ≠ `greatest` | **2** |
| rows that change eligibility **today** | **0** |
| rows `greatest` would newly *exclude* | 0 (it is the max — it can only widen) |
| events eligible for the stats join, old vs new | **67 vs 67** |

So this ships as a no-op and starts mattering in December. The two rows:

| | drops under `coalesce` | drops under `greatest` |
|---|---|---|
| Julmarknad Handcraft Market & Festival · American Swedish Institute | 2026-12-05 | 2026-12-06 |
| The Music Man · Ordway Music Theater | 2026-12-09 | **2026-12-25** |

A note on 5 Nov measured **0** rows with this shape. It is 2 now — appearing, not theoretical.

---

## What shipped

```sql
and greatest(e.start_at, e.end_at, e.multi_day_end) >= now()
```

`start_at` is `not null` in the schema, and Postgres's `greatest` ignores NULLs, so the
expression is never NULL. This is the same rule the open-flag queries and the self-check adopted
this week, and the same one `isEnded` and `eventTimeState` both already apply in TypeScript.

**No label change was needed.** Unlike the widenings earlier in this chain, the strip renders
through the ordinary card component, which already asks `isMultiDay` for its own label — the
rendered strip shows `Oct 23 – Nov 29` on a run that opened 18 days ago. The predicate was
the only thing out of step.

---

## The data error underneath, which is the more important half

Both divergent rows are divergent **because `multi_day_end` is wrong**, and in both cases the
organiser's own page says so:

| | stored `multi_day_end` | the source says | the site shows today |
|---|---|---|---|
| Julmarknad · asimn.org | 2026-12-05 | "December 4-6, 2026" | `Dec 4 – 5` |
| The Music Man · ordway.org | 2026-12-09 | "December 8 – 27, 2026" | `Dec 8 – 9` |

`spanEndISO` prefers `multi_day_end` for **display**, so those two pages under-report their own
runs — by one day, and by eighteen. A reader looking for Music Man tickets on
20 December is told the show closed eleven days earlier.

This change does not touch that. It is a separate correction with its own evidence, and it is
**left open** below. Note the consequence while it stands: trending will keep The Music Man
until 25 December while its event page says it ended on the 9th. Correcting the data makes
`coalesce` and `greatest` agree again and the disagreement disappears entirely.

---

## Verification

### The real function against the real database

```
trending strip today: 12 events
   2026-11-12  Fezziwig's Holiday Party
   2026-11-13  Art Attack! 2026
   2026-11-20  Northern Lights
   2026-10-23  Fall Flower Show
   ...
eligible for the stats join — old 67, new 67
  newly admitted: 0   newly excluded: 0
```

### The rendered homepage

`npm run start` on the build below, "Trending now" read off the page — all 12 in the server's
order, span labels intact:

```
Nov 12 – Dec 28   Fezziwig's Holiday Party
Nov 13 – 15       Art Attack! 2026
Nov 20 – Jan 3    Northern Lights
Oct 23 – Nov 29   Fall Flower Show
```

### Tests — 8 new

`getTrendingEvents` needs a DB, so the SQL cannot be executed in the suite. What is pinned
instead is the **claim** the SQL makes — that "still attendable" means what `isEnded` means —
as a golden test on the two real December shapes, plus a source assertion that the SQL keeps
saying it.

The source assertion is scoped to the **SQL literal**, not the function: the comment above it
names the rejected `coalesce` form in order to reject it, and a whole-function slice would have
failed on its own explanation. That mistake has now been made three times in this chain, so
there is also a guard that the slice is non-empty.

Fixtures use `category: "arts"` deliberately — `PER_NIGHT` covers music and sports, so
`staleSpanIds` strips `multiDayEnd` off a music row and this shape cannot exist there.

### Mutation

| mutation | tests that failed |
|---|---|
| the predicate back to `coalesce(e.multi_day_end, …)` | 2 |
| `isEnded` changed to prefer `multiDayEnd` over the max | 2 |

The second matters: it proves the golden tests are testing the rule, not restating the fixture.

### Quality gate

| | |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` | **3,405 passed in 156 files** |
| `npm run build` | clean |
| `npm audit` | **0 vulnerabilities** |

---

## Deploy

```bash
git add lib/trending.ts lib/__tests__/trending.test.ts docs/deploy-history/DEPLOY-TRENDING-STILL-ATTENDABLE.md
git commit -m "fix — the trending strip dropped a run its own pages still called live"
git push
```

Nothing changes on the site today — the two sets are identical. The verification that it
worked is in December: The Music Man should still be eligible for the strip on 10 December.

## Rollback

`git revert`. One predicate. No schema, no data.

---

## Left open

- **The two wrong end dates.** Both attested, neither corrected. On The Music Man
  `end_at` (25 Dec) is short by two days as well, so both columns need correcting, not just
  one. That row is the urgent half: eighteen days of a Broadway run are invisible to readers.
- **Eight published rows for one Grinch.** The smoke of this strip surfaced it — Children's
  Theatre Company's Grinch exists as 8 published rows under two titles - 7 as *Dr. Seuss's How
  the Grinch Stole Christmas!* and one as *How the Grinch Stole Christmas* (3 Nov with `end_at`
  2027-01-03, then 12, 14, 15, 19, 24, 27 Nov and 2 Dec). Two of them render **back to back** in
  Trending now. This is the
  [end_at-stuffed-with-the-run-end](DEPLOY-RUN-REFIND-FOLD.md) shape that the Jaccard title-drift
  fold was built for, and all 8 rows are still separate. Finding out why the fold did not reach
  them is its own piece of work.
- **`lib/ops-inputs.ts:121`** (`never_upcoming`) is still start-only.
- **`lib/day-order.ts:47`** sorts the day page's in-cap ongoing group by title while the "Also
  running" shelf beside it sorts ending-soonest.
