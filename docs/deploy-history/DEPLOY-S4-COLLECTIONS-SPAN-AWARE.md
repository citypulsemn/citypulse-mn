# Deploy — a collection page and its own ICS feed disagreed about what was on

**Date:** 5 November 2026 · **Roadmap:** [ROADMAP-SPANS.md](../ROADMAP-SPANS.md) item **S4**
**Files:** `lib/multiday.ts`, `lib/collections.ts`, `lib/feeds.ts`, `lib/instagram.ts`,
`lib/content/templates.ts`, `app/collections/[slug]/page.tsx`,
`app/content/collection/[slug]/route.tsx`, and their tests
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
`lib/multiday.ts` as `spansWindow`, beside `spansDay`. (`feeds` already imported from
`multiday`; `collections` did not, reaching it only transitively through `lib/weekend.ts` —
the first draft of this line overstated that too. It changes nothing about the cycle: nothing
in `multiday`'s own import closure reaches either module.)
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

## Verified on production — 6 November 2026

Pushed `9f5785b..ca4deee`; the deploy landed in about 60 seconds. Counts were taken
**before and after the same deploy**, because the live set moves daily — the "43" this guide
quoted for `live-music` the day before was already 47 by the morning, and comparing against a
previous day's number proves nothing.

| check | result |
|---|---|
| `/collections/date-night` | **40 → 57 events** |
| leads with "Already running" | yes, 6 cards, `+ 11 more running` |
| day headers | Nov 6, 7, 8 — today is the 6th, **no past-dated header** |
| headline reconciles | 46 rendered + 11 more = **57** ✓ |
| `ItemList` describes the rendered set | **46 entries, not 57** ✓ (the fix in `ca4deee`) |
| `/feeds/food-truck-festivals` | 2 events, **both titles contain "food truck"** ✓ |
| `/collections/live-music` | **47 → 47**, no "Already running" group — nothing mid-run qualifies |

All six ongoing cards carry a span containing today, two of them (`Aug 17 – Dec 31`,
`Nov 3 – Jan 3`) **longer than the 14-day grid cap** — the exact shape rule 5 was hiding.
"Twelve Kinds of Ice" appears once, not three times: the dedupe held through the deploy.

### The verification found a SECOND defect, and it was mine

The share card at `/content/collection/date-night` rendered six rows, **every one a long
museum run and not one dated event**: it led with `Collection in Focus: Martine Syms,
Jun 25 – May 23`, an eleven-month gallery rotation, on a card headed "Date Night Ideas".

`ca4deee` fixed this file's **date label** and left its **ordering**. Both broke for one
reason — `selectCollection` returns start-ascending, so mid-run rows, newly eligible, sort
*first* — and fixing only the label meant the card still selected for "started longest ago",
which is an anti-signal. Nothing caught it because the route renders an **image**, so no test
reads its contents and no HTML assertion can.

**Fixed** by moving the row choice into `lib/content/templates.ts` as the pure
`collectionCardRows` — soonest-starting first, topped up with runs (ending soonest) only when
the calendar is thin, so a quiet week shows real runs rather than blank rows. Five golden
tests; mutating it back to `selected.slice(0, 6)` fails three of them.

**The lesson is the one this project keeps paying for:** a fix aimed at a symptom on a surface
you cannot assert against is not verified until you *look at the surface*. The label was
checked by reading the code; the ordering was caught by rendering the PNG and reading it.

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
- **Rule 5: SIX literal breaks found, six fixed — and I am not calling it closed.** The first
  draft of this line said "closed … five breaks, all fixed" **three lines above naming a live
  sixth**, `lib/instagram.ts:80`. A review caught the contradiction. That one is fixed here
  too (it became a one-liner once `spansDay` was an import away), so the count is six. But
  every one of the six was found while chasing the previous one, which is weak evidence that
  the sixth is the last.
- **The cousin shape is NOT swept.** A start-only predicate is not the literal thing rule 5
  forbids, but it produces the same bug when a sibling surface answers differently — which is
  exactly what made S4 a bug rather than a preference. The highest-reach live candidate is
  **`lib/related.ts:29`** (`e.start >= nowWall`), on every event page, disagreeing with the
  venue page it links to (`app/venues/[slug]/page.tsx:81` uses the span-aware `isUpcoming`).
  Also flagged: `lib/verify-flags.ts:62` (`e.start_at >= now()`), which can hide a reader
  report about a currently-running show. Neither is in this commit; both want their own.
