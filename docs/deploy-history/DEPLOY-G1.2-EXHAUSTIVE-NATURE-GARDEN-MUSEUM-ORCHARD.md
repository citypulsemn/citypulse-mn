# Deploy — G1.2: exhaustive pass on Nature Centers, Gardens, Museums, Orchards

*August 2026. Tier 1 (audience / SEO). Code + data only, no schema.*

## What shipped

An exhaustive-coverage pass on four of the newer Places kinds (+16 entries), each
verified against its official page. (**Ski areas is already exhaustive** — the four
metro downhill areas are the complete set, so no change there.)

### Nature Centers 10 → 12 (+2)
- **Belwin Conservancy** (Afton) — 1,600 acres, bison herd, free
- **Wargo Nature Center** (Lino Lakes, Anoka County) — free

### Gardens 7 → 9 (+2)
- **St. Paul-Changsha China Friendship Garden** (Lake Phalen) — free
- **Cowles Conservatory** (Minneapolis Sculpture Garden) — free

### Museums 13 → 20 (+7)
- **Twin City Model Railroad Museum** · **Minnesota Transportation Museum**
  (Jackson Street Roundhouse) · **Pavek Museum** (St. Louis Park broadcasting) ·
  **Gibbs Farm** (Falcon Heights) · **James J. Hill House** · **Historic Fort
  Snelling** · **The Landing** (Shakopee) — all paid.

### Orchards & Patches 7 → 12 (+5)
- **Everly Farms** (Minnetrista, formerly Minnetonka Orchards) · **Whistling Well
  Farm** (Hastings) · **Sweetland Orchard** (Webster) · **Pinehaven Farm**
  (Wyoming) · **Waldoch Farm** (Lino Lakes)

## Honesty notes

- **Maplewood Nature Center** stays **excluded** — its interpretive center has
  closed; only the preserve/nature-play-yard remains, so it isn't an operating
  nature center.
- **Historic Fort Snelling** (the MNHS museum) and **Fort Snelling State Park**
  (the DNR park) are distinct facilities with distinct entries — same locale, two
  real places.
- **Minnetonka Orchards** is now **Everly Farms** (renamed) — stored under the
  current name and domain.
- Museums are all marked `YEAR_ROUND` (the "place exists, check hours" default);
  the seasonal historic sites (Gibbs Farm, The Landing, Fort Snelling's costumed
  programs) note their warm-months timing in the intro rather than flipping the
  page to "closed."

## Verification

Gate: `tsc` clean · **1002** tests · `npm run build` clean · `npm audit` 0. Places
drift guards pass for all 16 new rows (unique slugs, `https` official sources,
intro length + banned-word check, metro bounding box). No `kindsWithPlaces`
change (all kinds already seeded).

**Browser-verified (dev):** `/places/museum` → "20" (Pavek, Hill House);
`/places/nature-center` → "12" (Belwin, Wargo); `/places/garden` → "9" (China
Friendship Garden, Cowles); `/places/orchard` → "12" (Everly, Sweetland). No
console errors.

## Deploy steps

Push to `main`. Code + data only, no schema, no env.

## Rollback

`git revert`. Pure registry additions.
