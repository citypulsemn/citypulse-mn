# Deploy — Places expansion (47 → 57)

*August 2026. A curation pass bolstering the existing kinds. Pure data — no code
changes, no new kinds.*

## What shipped

**+10 verified entries**, each checked against an official parks/city page on
`verifiedAt` (2026-08-07):

**Beaches: 16 → 21** — the rest of the Three Rivers regional lakes:
- Bush Lake (Bloomington, free) · Fish Lake (Maple Grove, free) · Cleary Lake
  (Prior Lake, free) · Baker Park Reserve / Lake Independence (Maple Plain, free)
  · **Lake Minnetonka Swim Pond** (Minnetrista, paid).

**Pools: 12 → 17**:
- Bunker Beach Water Park (Coon Rapids — MN's largest outdoor water park) ·
  Crystal Cove (Crystal) · Highland Park Aquatic Center (St. Paul, in the
  `highland-park` district) · Grove Cove Aquatic Center (Maple Grove, indoor
  year-round) · Eagan Community Center Pool (indoor year-round). All paid.

The registry is now **57 entries — 21 beaches + 19 splash pads + 17 pools**.
Beaches span 9 cities; pools span 15. (Deliberately skipped **Soak City /
Valleyfair** — a commercial amusement-park water park, not a public pool.)

## Zero code — the pattern holds

Same as the pool launch: this is registry rows only. Counts, the index cards,
the maps, the sitemap, and the season logic all update themselves. No test
changes were needed either — the drift guards validate every new row generically
(unique slug, https `sourceUrl`, banned-word + metro-bounding-box checks), and
the count-based tests are dynamic.

## Verification (observed, not intended)

- **Live in dev (fresh server):** `/places` now reads **Beaches 21 · Splash Pads
  19 · Pools 17 · Venues →**. On `/places/beach`, the two paid swim ponds (Elm
  Creek, Lake Minnetonka) sort **last** after the 19 free beaches — free-first
  holding across 21 entries and 9 cities. No server errors.
- **Gate:** `tsc` clean · **936/936** (drift guards validated all 57 entries) ·
  `npm run build` clean · `npm audit` 0.

## Honesty notes

- **Sources** are official Three Rivers / city / St. Paul parks pages; Bunker
  Beach uses its Explore Minnesota (state tourism) profile.
- **Cost:** the new pools are all `paid`; Bunker Beach's intro flags the extra
  park vehicle permit. The new lake beaches are free except the two chlorinated
  swim ponds.
- **Coordinates** come from each place's real street address / lake location.

## Deploy steps

Push to `main`. Registry data only. No schema, no env, no deps, no route changes.

## Verify checklist

- [ ] `/places` shows Beaches 21, Splash Pads 19, Pools 17.
- [ ] Spot-check a few new `sourceUrl` links resolve to the beach/pool + season.

## Rollback

`git revert`. Pure data.
