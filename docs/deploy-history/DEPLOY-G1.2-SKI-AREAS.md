# Deploy — G1.2: Ski & Snowboard Areas, a new Places kind (4)

*August 2026. Tier 1 (audience / SEO). Code + data only, no schema.*

## What shipped

A new `/places/ski-hill` page — **the metro's four downhill ski & snowboard
areas**, each verified against its official page. Small but **exhaustive**: these
are the only downhill areas inside the metro. Another evergreen, indexable Places
URL for the G1.2 SEO push (winter search intent).

- **New `PlaceKind` "ski-hill"** in [lib/places.ts](../../lib/places.ts): union +
  `KIND_META` + editorial intro + 4 rows. Zero page/route code — `/places` grew a
  Ski Areas card, `/places/ski-hill` prerendered, sitemap auto-included.
- **New `SKI_SEASON` const** (December–March; a winter wrap like `WINTER`) —
  downhill season runs longer than the skating/sledding window.

### Coverage (4, all paid)
- **Afton Alps** (Hastings) — Vail-owned, the metro's biggest, 18 lifts
- **Buck Hill** (Burnsville) — the storied training hill (Lindsey Vonn)
- **Hyland Ski & Snowboard Area** (Bloomington) — Three Rivers, big terrain park
- **Elm Creek Winter Recreation Area** (Maple Grove) — Three Rivers, beginner hill + tubing

Excluded (out of metro): Trollhaugen, Welch Village, Wild Mountain.

## Verification

Gate: `tsc` clean · **1002** tests · `npm run build` clean (`/places/ski-hill`
statically generated) · `npm audit` 0. Places drift guards pass for all 4 rows
(unique slugs, `https` official sources, intro length + banned-word check, metro
bounding box); `kindsWithPlaces` exact-list test updated to include `ski-hill`.

**Browser-verified (dev):** `/places/ski-hill` renders "4 across the Twin Cities
metro" with the **"Closed for the season — these reopen around December"** banner
(SKI_SEASON seasonal handling working, like sledding/rinks), all 4 with PAID
badges and DOWNHILL / TERRAIN PARK / NIGHT SKIING / TUBING tags and official-source
links; `/places` shows the Ski Areas card ("4 spots · seasonal, closed now →").
No console errors.

## Deploy steps

Push to `main`. Code + data only, no schema, no env. The page shows the
closed-for-season banner until December, then flips to open automatically.

## Rollback

`git revert`. Pure registry addition; reverting removes the kind and its page.
