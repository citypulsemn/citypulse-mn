# Deploy — Places seed expansion (12 → 26 verified entries)

*August 2026. A curation pass on the Places registry (`lib/places.ts`) — pure
data + two small test/label updates the data forced. No new code.*

## What shipped

The seed grew from **12 to 26 entries**, each web-researched against an
authoritative parks source on `verifiedAt` (2026-08-07):

**Beaches: 6 → 16**
- **+7 Minneapolis** (completing the Park Board's list): Bde Maka Ska 32nd
  Street + North, Cedar Lake East + South, Lake Harriet Southeast, Lake Nokomis
  50th Street, Wirth Lake — each with its own MPRB beach page as `sourceUrl`.
- **+3 suburban** (Three Rivers Park District): French Regional Park / Medicine
  Lake (Plymouth, free), Bryant Lake Regional Park (Eden Prairie, free), and
  **Elm Creek Swim Pond** (Maple Grove) — the registry's first **`paid`** entry
  ($9 daily / $25 season).

**Splash pads: 6 → 10**
- **+2 core cities**: Victory Memorial (Minneapolis, opened 2025) and Parque
  Castillo (St. Paul, West Side).
- **+2 suburban**: Maple Grove Central Park interactive fountain and the M Health
  Fairview Sports Center splash pad (Woodbury) — each with its city's official
  parks page as `sourceUrl`.

Coverage now spans six cities (Minneapolis, St. Paul, Plymouth, Eden Prairie,
Maple Grove, Woodbury). Neighborhood keys grew on the in-city lakes (five
southwest-lakes beaches now); everything suburban is honestly `null`.

## Two small changes the data forced

- **Cost variety is now real.** Elm Creek is `paid`, so the free-first sort is
  actually exercised — verified on the page (Elm Creek renders **last**, badged
  "Paid", after the 15 free beaches). The unit test switched from "all names are
  alphabetical" to "non-decreasing cost rank, alphabetical within the free group,
  and a paid entry exists."
- **Label honesty.** The kind-page count line changed from "across
  Minneapolis–St. Paul" to "across the Twin Cities metro" now that suburbs are
  included. (The `placesByNeighborhood` test also stopped hard-coding exactly two
  southwest-lakes slugs.)

## Verification (observed, not intended)

- **Live in dev:** `/places/beach` → 16 rows, "16 across the Twin Cities metro",
  Elm Creek Swim Pond last and badged **Paid**. `/places/splash-pad` → 10 rows
  across **four cities** (Minneapolis, St. Paul, Woodbury, Maple Grove). No
  console errors.
- The **drift guards validated all 26 entries**: unique slugs, resolvable
  neighborhood keys, https `sourceUrl` on every entry, real `verifiedAt`,
  house-voice intro length + banned-word check, and **coordinates inside the
  metro bounding box** (the suburban additions reach it — Elm Creek at 45.15,
  Woodbury at −92.96 — and all passed).
- **Gate:** `tsc` clean · **927/927** · `npm run build` clean (both kind pages
  still prerender) · `npm audit` 0.

## Honesty notes

- **Coordinates:** the Minneapolis lake beaches are placed from well-known lake
  geography; the suburban Three Rivers / city entries are placed from their real
  street addresses at park level. The `address` + `sourceUrl` are the precise
  anchors; a pin sits within the right park.
- **Not yet the full ~35.** The roadmap's target leans heavily on splash pads
  (~20–25), and dedicated splash pads in the core cities are limited (Mpls 5,
  St. Paul 4). Reaching that number needs a per-suburb splash-pad pass across
  ~10 more suburbs — each its own official source — which is the next chunk of
  curation, not a code change.

## Deploy steps

Push to `main`. Registry data + two test updates + one label. No schema, no env,
no deps. On deploy the two kind pages simply list more spots; the sitemap URLs
are unchanged (the kinds already existed).

## Verify checklist

- [ ] `/places/beach` lists 16 spots; the paid Elm Creek pond is last with a
      "Paid" badge; in production the map shows 16 numbered pins matching the list.
- [ ] `/places/splash-pad` lists 10 spots across Minneapolis, St. Paul, and the
      suburbs.
- [ ] Spot-check a few `sourceUrl` links resolve to the right place + season.

## Rollback

`git revert`. Pure data; the two test updates and the label revert with it.
