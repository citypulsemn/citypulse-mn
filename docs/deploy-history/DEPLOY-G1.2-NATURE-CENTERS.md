# Deploy — G1.2: Nature Centers, a new Places kind (10)

*August 2026. Tier 1 (audience / SEO). Code + data only, no schema.*

## What shipped

A new `/places/nature-center` page — **10 metro nature centers**, each verified
against its official city / county / park-district / nonprofit page. Another
evergreen, indexable Places URL for the G1.2 SEO push, and a strong family /
rainy-day / first-snow outing category.

- **New `PlaceKind` "nature-center"** in [lib/places.ts](../../lib/places.ts):
  union + `KIND_META` + 10 `Place` rows + editorial intro. Zero page/route code —
  `/places` grew a Nature Centers card, `/places/nature-center` prerendered from
  the `[kind]` route, sitemap auto-included. All `YEAR_ROUND`, all **free**.

### Coverage (10)
- **Minneapolis (MPRB):** Carl W. Kroening (North Mississippi Regional Park)
- **Ramsey County:** Tamarack (White Bear Township)
- **Three Rivers:** Eastman (Dayton) · Richardson (Bloomington) · Lowry (Victoria)
- **Cities:** Springbrook (Fridley) · Westwood Hills (St. Louis Park) · Wood Lake (Richfield)
- **Nonprofit:** Dodge (West St. Paul) · Carpenter St. Croix Valley (Hastings)

## Honest exclusions

- **Maplewood Nature Center** — the interpretive center has **closed**; only the
  preserve and nature-play yard remain, so it's not listed as a nature center.
- **Warner Nature Center** (Marine on St. Croix) — permanently closed (~2020).
- **Silverwood Park** (St. Anthony) — an art-and-nature park, not an interpretive
  nature center; left out to keep the kind coherent.
- **Bell Museum** — a natural-history *museum* (paid), a different category.

## Verification

Gate: `tsc` clean · **1002** tests · `npm run build` clean (`/places/nature-center`
statically generated) · `npm audit` 0. Places drift guards pass for all 10 rows
(unique slugs, `https` official sources, intro length + banned-word check, metro
bounding box); `kindsWithPlaces` exact-list test updated to include `nature-center`.

**Browser-verified (dev):** `/places/nature-center` renders "10 across the Twin
Cities metro", the intro, and each center with a FREE badge, city, amenity tags
(TRAILS / RIVER / EXHIBITS / RAPTORS / ORCHARD / FARM / BOARDWALK …), and its
official-source link; `/places` shows the Nature Centers card ("10 spots →").
This server's log had no `featured` error (schema applied earlier this session).

## Deploy steps

Push to `main`. Code + data only, no schema, no env. Sitemap gains
`/places/nature-center` automatically.

## Rollback

`git revert`. Pure registry addition; reverting removes the kind and its page.
