# Deploy — farmers markets, a new Places kind (0 → 72)

*August 2026. Seeds the last unseeded registry kind. Registry-only.*

## What shipped

The `farmers-market` kind (previously wired but empty) is now seeded with **72
regular seasonal public markets** across the seven-county metro — the city
markets and the suburban ones, including the many satellites of the St. Paul
Growers' Association and the Anoka County Growers Association.

New wiring:
- `PLACES_KIND_INTRO["farmers-market"]` ([lib/editorial.ts](../../lib/editorial.ts))
  and a **`MARKET_SEASON`** const (May–October — the outdoor run; a few flagships
  add an indoor winter market, noted per entry). `KIND_META` already existed.
- The `kindsWithPlaces` exact-list test gains `farmers-market`; the "unseeded
  kind" test now uses **`music-venue`** (the only remaining unseeded kind — it's
  the cross-link to /venues, deliberately never seeded).
- Every market: `cost: "free"` (browsing is free), day-of-week `tags` (searchable
  "saturday market"), venue-lot coordinates from its address, and an official
  source.

## Method + scope

Three regional research agents (Mpls/St Paul, north/east, west/south) swept city
pages, the St. Paul Growers' Association, the Anoka County Growers Association,
and the Minnesota Farmers Market Association directory — no-delegation, clean
JSON. **Included:** regular seasonal public markets. **Excluded:** one-off
pop-ups (e.g. a "Makers Market" during a city-days festival) and retail farm
stands (e.g. Eden Prairie's Untiedt's stand — a store, not a market). Cities with
no confirmable regular market (Eden Prairie, St. Louis Park, Mendota Heights,
Lino Lakes, North St. Paul, Vadnais Heights) were left out honestly.

## Honest notes

- **A handful of weak sources.** Where a market had no official city/market page,
  the source is its Minnesota Grown, NFMD, or (for Jordan) Facebook listing — all
  https and attesting the market exists, worth swapping to an official page on a
  verify pass: Camden, Uptown, Linden Hills, Markets on Main, Fridley, New
  Brighton, Savage, Lake Elmo, Hastings, Hugo, Victoria, Carver, Jordan.
- **Dropped as too weak/short:** the every-other-week "theNEWmpls" market and two
  ultra-short St. Paul micro-markets (7th Place, Securian) — candidates for a
  later pass with firmer sourcing.
- **Coordinates** are venue-lot level from each address (a market is a small
  footprint, so these are close).
- **Season** is month-level May–October; exact 2026 open/close dates shift and
  live on each source URL.

## Verification

Gate: `tsc` clean · **967** tests (drift guards validated all 72 — unique slugs,
https sources, metro box, intro length, banned words) · `npm run build` clean ·
`npm audit` 0. Dev render: `/places/farmers-market` → "**72** across the Twin
Cities metro"; the **Farmers Markets card shows on the `/places` index**.
(Caught one `http://` source URL that the drift guard rejected — fixed to https.)

## Deploy steps

Push to `main`. Registry + kind wiring only. Sitemap picks up
`/places/farmers-market` automatically.

## Rollback

`git revert`.

## Milestone

Every registry Places kind is now seeded (music-venue stays an intentional
cross-link to /venues). Counts: **golf-course 85 · farmers-market 72 · splash-pad
49 · beach 45 · pool 25 · playground 13 · park 13 · sledding 11 · rink 8** —
~321 curated places, plus the OSM bulk layers (3,417 playgrounds + 3,197 parks).
