# Deploy — Winning detail (moat), kind 2: rink "Indoor" badge

*Aug 17, 2026. Extends the verified-detail layer to ice rinks — the primary
decision axis a skater wants: an enclosed **year-round arena** (skate any weather,
any month; paid) vs a free **outdoor neighborhood rink** (winter, snow-dependent).
Reuses the `PlaceDetails` schema from the ski-hill moat; adds one field.*

## Why no research pass this time
For ski hills the amenities were spread across commercial sites and needed
verification. Rinks are different: **in Minnesota, year-round refrigerated ice
means an enclosed arena** — the registry's own `season` field already separates
the two, and the 5 year-round rinks are all canonical, well-known indoor arenas
whose `sourceUrl` already documents them. So `indoor` is high-confidence and
source-backed without a fresh agent pass, while the honesty guard (below) proves
nothing outdoor got mislabeled.

## What shipped
- **Schema:** `indoor?: boolean` added to `PlaceDetails`, `indoor: "Indoor"` at the
  top of `PLACE_DETAIL_LABELS` ([lib/places.ts](../../lib/places.ts)). Renders via
  the same gold ✓ badge as the ski facts.
- **Data:** `details: { indoor: true }` on the 5 indoor arenas — **Bloomington Ice
  Garden, Braemar Arena, Parade Ice Garden, Schwan Super Rink, TRIA Rink** —
  `verifiedAt` bumped to 2026-08-17. The other 22 rinks (park rinks, the John Rose
  *Oval*, the *Outdoor* Center ROC, downtown WinterSkate) are outdoor and carry no
  indoor badge — correct: the Oval and ROC are refrigerated but open-air.

## Verification (observed, not intended)
- **Live browser:** `/places/rink` shows the ✓ Indoor badge on exactly the 5
  arenas (driven via the DOM; 0×0 pane blocks screenshots).
- **Tests +2** (1109 total): the indoor set is *exactly* those 5 arenas, and — the
  honesty guard — **no seasonal (outdoor) rink is ever marked indoor**. (Plus the
  existing `details` drift guard: labeled keys, boolean values, nothing invented.)
- Gate: `tsc` clean · 1109/1109 · `npm run build` clean · `npm audit` 0.

## Value, composed
The 27 rinks were an undifferentiated list; now a skater sees at a glance which 5
are indoor (year-round, any weather) — and combined with the existing cost badge
(indoor = paid, outdoor = free) it's decision-complete. It also stacks with the
P4.3 filters + near-me sort: filter to free, sort nearest, and see which are
indoor, on one page.

## Deploy steps
Merge to `main`; Vercel auto-deploys. No schema (registry is code), no secret.

## Follow-ups (moat, kind by kind)
- **Rinks — "Warming house"** would be the natural second rink fact for the
  outdoor ones, but it needs a per-rink research pass (city pages list it
  unevenly) — a future item.
- **Beaches (45): lifeguarded** — still deferred (safety-sensitive + seasonally
  volatile; needs a re-verify cadence first).
- **Filter by detail** ("indoor only") — a per-kind detail filter is a follow-on
  to the generic P4.3 filter.

## Rollback
`git revert`. `indoor` is an optional field; reverting removes it and the 5
arenas' badge, leaving the ski-hill details intact.
