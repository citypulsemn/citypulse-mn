# Deploy — G1.2: Orchards & Pumpkin Patches, a new Places kind (7)

*August 2026. Tier 1 (audience / SEO). Code + data only, no schema.*

## What shipped

A new `/places/orchard` page — **7 pick-your-own apple orchards and pumpkin/corn-
maze farms** across the metro, each verified against its official page. A strong
autumn-search category ("apple orchards near Minneapolis"), and the page politely
shows a closed-for-season banner outside September–October.

- **New `PlaceKind` "orchard"** in [lib/places.ts](../../lib/places.ts): union +
  `KIND_META` (label "Orchard & Patch") + editorial intro + 7 rows.
- **New `FALL_SEASON` const** (September–October) — the pick-your-own window.

### Coverage (7) — 4 free / 3 paid
- **Free to enter (pay for what you pick):** Aamodt's Apple Farm (Stillwater) ·
  Pine Tree Apple Orchard (White Bear Lake) · Deardorff Orchards & Vineyards
  (Waconia) · Sponsel's Minnesota Harvest (Jordan)
- **Admission:** Afton Apple Orchard (Hastings) · Apple Jack Orchards (Delano) ·
  Sever's Fall Festival (Shakopee)

## Honest exclusions

- **Emma Krumbee's** (Belle Plaine) — **permanently closed (2024)**. Not listed.
- **Twin Cities Harvest Festival** (Brooklyn Park) — the operator announced 2025 is
  its **last year at its current location** (relocating), so its address will go
  stale. Deferred until the new site is confirmed.

## Verification

Gate: `tsc` clean · **1002** tests · `npm run build` clean (`/places/orchard`
statically generated) · `npm audit` 0. Places drift guards pass for all 7 rows
(unique slugs, `https` official sources, intro length + banned-word check, metro
bounding box); `kindsWithPlaces` exact-list test updated to include `orchard`.

**Browser-verified (dev):** `/places/orchard` renders "7 across the Twin Cities
metro" with the **"Closed for the season — these reopen around September"** banner
(FALL_SEASON handling working), free-first with APPLES / PUMPKINS / CORN-MAZE /
BAKERY / CIDERY tags and official-source links; `/places` shows the Orchards &
Patches card ("7 spots · seasonal, closed now →"). No console errors.

## Deploy steps

Push to `main`. Code + data only, no schema, no env. The page flips to open in
September automatically.

## Rollback

`git revert`. Pure registry addition; reverting removes the kind and its page.
