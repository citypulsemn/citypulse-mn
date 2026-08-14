# Deploy — G1.2: Gardens & Conservatories, a new Places kind (7)

*August 2026. Tier 1 (audience / SEO). Code + data only, no schema.*

## What shipped

A new `/places/garden` page — **7 botanical gardens and conservatories** across
the metro, each verified against its official page. Another evergreen, indexable
Places URL for the G1.2 SEO push.

- **New `PlaceKind` "garden"** in [lib/places.ts](../../lib/places.ts): union +
  `KIND_META` + editorial intro + 6 new rows, **plus the Minnesota Landscape
  Arboretum recategorized from `park` → `garden`** (it was already in the registry
  as a park; it's an arboretum, so it belongs here). Net: gardens 7, parks 12.
- **Generalized the season const** `DOG_WARM` → **`WARM_SEASON`** (April–October),
  now shared by the winter-closing dog parks and the gated seasonal gardens.

### Coverage (7)
- **Year-round:** Marjorie McNeely Conservatory (Como, St. Paul, free) ·
  Minnesota Landscape Arboretum (Chaska, **paid**) · Lyndale Park Gardens
  (Minneapolis, free) · Longfellow Gardens (Minneapolis, free)
- **Seasonal (close for winter):** Eloise Butler Wildflower Garden (Minneapolis,
  free, Apr–Oct) · Noerenberg Memorial Gardens (Wayzata, free, May–Oct) ·
  Normandale Japanese Garden (Bloomington, free, May–Oct)

6 free / 1 paid — the free ones lead the free-first sort; the Arboretum sits last.

## Notes / honest scope

- The Arboretum move keeps a single canonical entry (a duplicate slug would have
  failed the drift guard — and did, on the first pass; caught and fixed by moving
  rather than duplicating).
- Season honesty: Eloise Butler is officially gated **April–October** (confirmed
  on the MPRB page); Noerenberg and Normandale close for winter too (`MARKET_SEASON`,
  May–October). The four year-round entries are conservatories or open formal gardens.
- Deferred/considered: Cowles Conservatory (Sculpture Garden — intermittently
  closed/renovated, fuzzy sourcing); Munsinger Clemens (St. Cloud, out of metro);
  Bell Museum (a paid natural-history museum, not a garden).

## Verification

Gate: `tsc` clean · **1002** tests · `npm run build` clean (`/places/garden`
statically generated) · `npm audit` 0. Places drift guards pass for all 7 rows
(unique slugs — after the Arboretum de-dup — `https` official sources, intro
length + banned-word check, metro bounding box); `kindsWithPlaces` exact-list test
updated to include `garden`.

**Browser-verified (dev):** `/places/garden` renders "7 across the Twin Cities
metro", free-first with the Arboretum's PAID badge last, amenity tags, and
official-source links; `/places` shows the Gardens card ("7 spots →") and Parks
now reads "12 spots →" (Arboretum moved out). No console errors.

## Deploy steps

Push to `main`. Code + data only, no schema, no env.

## Rollback

`git revert`. Pure registry change; reverting removes the kind and restores the
Arboretum to `park`.
