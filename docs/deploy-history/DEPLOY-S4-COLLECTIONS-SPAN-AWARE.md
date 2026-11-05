# Deploy — a collection page and its own ICS feed disagreed about what was on

**Date:** 5 November 2026 · **Roadmap:** [ROADMAP-SPANS.md](../ROADMAP-SPANS.md) item **S4**
**Files:** `lib/multiday.ts`, `lib/collections.ts`, `lib/feeds.ts`,
`app/collections/[slug]/page.tsx`, `lib/__tests__/collections.test.ts`
**Schema:** none. **Data:** none. Code only.

The fifth break of ENGINEERING rule 5, found by the review of the fourth.

---

## What was wrong

`selectCollection` decided membership from the **start day alone**:

```ts
if (e.start < w.fromWall) return false;
const day = e.start.slice(0, 10);
return w.days ? w.days.has(day) : day <= w.endKey;
```

No `spanEnd`, no `daysSpanned`. A run that opened before the window and is open right now was
absent from its own collection.

**What makes it a bug and not a choice:** the *same* `CollectionSpec` already got true-span
treatment in `lib/feeds.ts`, which builds its feeds from `COLLECTIONS.map(c => c.slug)`. So
`/collections/<slug>` and `/feeds/<slug>` answered one question two ways — and the
under-reporting one was the indexed HTML page. That is the R1.5 page-versus-ICS shape
`/this-weekend` already paid for once.

### Measured — and the first two measurements were both wrong

| collection | before | after | gained |
|---|---|---|---|
| `date-night` | 41 | 58 | **17** |
| `arts-and-culture` | 58 | 74 | **16** |
| `free-this-week` | 15 | 22 | 7 |
| `family-fun` | 15 | 19 | 4 |
| `only-in-minnesota` | 2 | 3 | 1 |
| the other three | — | — | 0 |

**45 rows gained, 0 lost.**

Both earlier figures are left on the record because the lesson is worth more than the
tidiness. The first said **686**: that oracle applied only the category filter and ignored each
spec's own price and query rules. The second said **22**: that oracle cloned each event onto
the first covered day but kept its original time-of-day, so the old predicate's
`e.start < w.fromWall` still rejected the clones. **Simulating a predicate is how you get a
wrong number twice.** Run the old code against the new code over the real set.

---

## What shipped

### 1. The rule moved DOWN, not sideways

The obvious fix — import `inWindow` from `lib/feeds.ts` — **cycles**: `feeds.ts` imports
`COLLECTIONS`, so that dependency runs one way only. The rule therefore went to
`lib/multiday.ts` as `spansWindow`, beside `spansDay`, which both callers already import from.
`feeds.ts` deleted its local copy. Same resolution as `spanEndISO` moving into `lib/dates.ts`.

### 2. R1.2's floor is kept, and it is the one axis that still differs

A test has pinned since R1.2 that a **single-day** event which already started today is gone
from collections by the afternoon — a collection is what is coming up. That floor survives:

```ts
.filter((e) => spanEnd(e) !== null || e.start >= w.fromWall)
```

A **run** that began this morning is not past and stays. The ICS has no such floor, so this
morning's concert remains in the feed all day. **Deliberate, tested, and measured at 3 rows
today** — not quietly aligned.

### 3. The feed was also ignoring `queryScope`

Found while verifying parity, and the non-span half of the same disease.
`food-truck-festivals` sets `queryScope: "title"` on purpose — *"a real food-truck festival
names itself one; a body mention isn't the topic"* — and `lib/feeds.ts` called
`matchesQuery(ev, spec.query)` **without the scope**, so the ICS admitted body mentions the
page deliberately excluded. One line, now fixed, with its own parity test.

### 4. The page lost its third copy of day-grouping

Span-aware selection means mid-run events reach the page, and grouped by their own start they
would print `Saturday, May 23, 2026` as a header on a November collection. The page now uses
`planListView` — the same "Already running" group the homepage list and `/day` use — and its
local `groupByDay` is deleted.

---

## Verification

### Page versus its own feed, inside the overlapping window

The two use different *windows* by design (the ICS is a rolling 30 days; a collection uses its
own `window` field), so the only meaningful comparison is events inside both. After this
change:

| collection | disagreements |
|---|---|
| `date-night`, `arts-and-culture`, `festivals-and-markets`, `only-in-minnesota`, `food-truck-festivals` | **0** |
| `free-this-week`, `live-music`, `family-fun` | 1 each — all the R1.2 floor, all single-day events that started earlier today |

`food-truck-festivals` was 1 before the `queryScope` fix and is 0 after.

### Mutation

| mutation | tests that failed |
|---|---|
| `selectCollection` back to the start day | 3 |
| the R1.2 floor removed | 2 |
| `spansWindow` ignores the span | **4 — on both sides**, collections *and* the pre-existing feeds rule-5 test |

That last one is the proof the predicate is genuinely shared rather than copied again.

### Observed on the running site

- `/collections/date-night` — "58 events", sections lead with **Already running**, then
  Thursday 5 Nov onward. 48 cards plus `+ 10 more running` = 58. **No past-dated headers.**
- `/collections/live-music` — 43 events, no "Already running" group (nothing is mid-run), no
  change in card count
- No console or server errors

---

## Quality gate

| | |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` | **3,161 passed in 152 files** (3,154 + 7) |
| `npm run build` | clean, 611 pages |
| `npm audit` | **0 vulnerabilities** |

---

## Deploy

```bash
git add lib/multiday.ts lib/collections.ts lib/feeds.ts "app/collections/[slug]/page.tsx" lib/__tests__/collections.test.ts docs/ROADMAP-SPANS.md docs/deploy-history/DEPLOY-S4-COLLECTIONS-SPAN-AWARE.md
git commit -m "fix — a collection page and its own ICS feed disagreed about what was on"
git push
```

Verify on **www** with `curl -L` (the apex 308s):

1. `https://www.citypulsemn.com/collections/date-night` — leads with "Already running", no
   header dated before today
2. The headline count and the rendered cards reconcile via the `+ N more running` line
3. `https://www.citypulsemn.com/feeds/food-truck-festivals` — no event whose *title* lacks
   "food truck"
4. `https://www.citypulsemn.com/collections/live-music` — unchanged, 43 events

## Rollback

`git revert`. `spansWindow` is additive; `feeds.ts` delegating to it is behaviour-identical to
its deleted local copy; the page change is presentational. The only behaviour changes are the
collections predicate and the `queryScope` argument, both reverting cleanly.

---

## Left open

- **The windows still differ by design** — the ICS is a rolling 30 days whatever the
  collection's own `window` says. Defensible for a subscription, but it means "the page and the
  feed agree" is only ever true *inside the overlap*, and that is how this guide states it.
- **The R1.2 floor** keeps one axis different on purpose. If Taren would rather a collection
  show what is on rather than what is coming up, that is a one-line change and a test to
  rewrite.
- **Rule 5 is now closed for every surface found so far** — five breaks, all fixed. The sweep
  that found the fifth also named weaker candidates that are *not* violations
  (`weekly-picks`, `related`, `verify`, `digest-personal`, `admin`, `ops-inputs`,
  `source-sweep` all ask genuine start questions); `lib/instagram.ts:80` is the one remaining
  literal capped-expansion misuse, reaching one admin page.
