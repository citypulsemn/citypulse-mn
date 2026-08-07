# Deploy — Places P2.1: pools (a new kind)

*August 2026. First of P2.1's "four more kinds." Pure data curation — the code
already supported `pool`, so this is registry rows only, exactly as P1 promised.*

## What shipped

A **`pool` kind seeded with 12 verified aquatic centers** across 11 cities,
each checked against its official city / parks-board page on `verifiedAt`
(2026-08-07). Picked for summer (it's in season) and for a real mix:

| Pool | City | Season | Cost |
|---|---|---|---|
| Webber Natural Swimming Pool | Minneapolis | summer | **free** |
| Bloomington Family Aquatic Center | Bloomington | summer | paid |
| Cascade Bay Water Park | Eagan | summer | paid |
| Como Regional Park Pool | St. Paul | summer | paid |
| Edina Aquatic Center | Edina | summer | paid |
| New Hope Aquatic Park | New Hope | summer | paid |
| Redwood Community Pool | Apple Valley | summer | paid |
| Richfield Outdoor Pool | Richfield | summer | paid |
| St. Louis Park Aquatic Park | St. Louis Park | summer | paid |
| Great River Water Park | St. Paul | **Sept–May** | paid |
| The Tropics Indoor Waterpark | Shoreview | year-round | paid |
| Chaska Community Center Pool | Chaska | year-round | paid |

The mix exercises the whole season model for the first time on real data:
outdoor **June–August** pools, two **year-round** indoor water parks, and St.
Paul's **Great River Water Park**, which runs the *off-season* (closed for
summer, back in September) — the `openMonth > closeMonth` **winter-wrap** case
`openNow` was built to handle. Webber (the free, chemical-free natural pool) is
the only free entry, so it leads the free-first sort.

## Zero new code — as designed

Adding a kind is registry data plus (optionally) an editorial intro. The `/places`
index picked up a **Pools** card automatically (via `kindsWithPlaces`), the
`/places/pool` page prerendered from the same `[kind]` route, and the sitemap
gained the URL — no page, component, or route changes. That's the P1 architecture
paying off.

Only additions: 12 `PLACES` rows, three season constants (`POOL_SUMMER`,
`YEAR_ROUND`, `OFF_SEASON`), and a `PLACES_KIND_INTRO.pool` header paragraph.

## Verification (observed, not intended)

- **Live in dev (fresh server):** `/places` shows four cards — Beaches (16),
  Splash Pads (19), **Pools (12)**, Venues →. `/places/pool` renders 12 rows,
  free-first (**Webber first**, "Free"; paid pools follow, "The Tropics" last),
  "12 across the Twin Cities metro". No server errors.
- **Tests +4 (936/936):** the pool seed is free-first with Webber leading; it
  carries a season mix (year-round + seasonal + the off-season wrap); Great
  River reads **closed in July, open in January** via `openNow`. Drift guards
  validated all 47 entries (unique slugs, https sources, banned-word + metro
  bounding-box checks).
- **Build:** `/places/pool` prerenders alongside beach and splash-pad.
- **Gate:** `tsc` clean · 936/936 · `npm run build` clean · `npm audit` 0.

## Honesty notes

- **Cost is real:** 11 of 12 pools charge admission (`paid`); the page shows the
  badge and the source link carries current rates. Webber is genuinely free.
- **Season is month-level:** outdoor pools are marked June–August (they open
  after school, not Memorial Day); a couple close a few days into September, but
  the conservative month floor is honest and the `sourceUrl` has exact dates.
- **Coordinates** come from each pool's real street address.

## Deploy steps

Push to `main`. Registry data + editorial + a test bound. No schema, no env, no
deps, no route changes.

## Verify checklist

- [ ] `/places` shows a "Pools" card (12 spots); `/places/pool` lists them,
      Webber first (free), the rest paid.
- [ ] In production the pool map shows 12 numbered pins matching the list.
- [ ] Spot-check a few `sourceUrl` links resolve to the pool + its season/rates.

## Rollback

`git revert`. Pure data + one test bound.

## P2.1 remaining

Curated **parks** (year-round), destination **playgrounds** (year-round), and
the **rink + sledding** winter pair (best seeded closer to the season — the
season math already handles the Dec–Feb wrap). All data-only, rolling.
