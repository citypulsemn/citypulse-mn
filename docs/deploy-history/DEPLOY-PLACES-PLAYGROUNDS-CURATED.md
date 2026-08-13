# Deploy — destination playgrounds, curated expansion (5 → 13)

*August 2026. The CURATED half of the playgrounds hybrid. Registry-only.*

## The hybrid decision

Unlike splash pads / beaches / pools (bounded at ~30–60), playgrounds are
**unbounded** — "truly every playground" is 3,000+ points (nearly every park has
one), which the hand-verified registry can't honestly hold. The owner chose a
**hybrid**:

1. **Curated "destination playgrounds"** — the registry list, hand-verified with
   the age-fit / accessibility / theme detail that can't be scraped. **This
   deploy.**
2. **An exhaustive "every playground" map layer** from OpenStreetMap, zoom-gated
   on the clustered map (dots that appear as you zoom in). **A separate build**
   (Overpass ingestion → generated data → a distinct map layer) — NOT in this
   deploy; scoped as the next Places project.

## What shipped (piece 1)

The `playground` kind went from **5 → 13** — the "worth the drive" playgrounds,
each with an official source + street address (so coordinates are accurate):

- **Inclusive/accessible:** French Regional (Plymouth), Roseville Central
  (Victoria West), Becker Park (Crystal), Waterford Park (Waconia), Shoreview
  Commons.
- **Themed/destination:** Staring Lake fire-tower (Eden Prairie), Teddy Bear Park
  (Stillwater), Elm Creek Play Area (Maple Grove — one of the state's largest).

## Deferred (need a confident official source URL)

Como Park playground (St. Paul), Schaper Park ninja course (Golden Valley), and
the Bracket Field rocket (Minneapolis) — all real destination playgrounds, but I
didn't have a clean official page to anchor them this pass.

## Verification

Gate: `tsc` clean · **961** tests (drift guards validated all 8 new) · `npm run
build` clean · `npm audit` 0. Dev render of `/places/playground`: count line
"**13** across the Twin Cities metro".

## Deploy steps

Push to `main`. Registry data only. Sitemap already lists `/places/playground`.

## Verify checklist (production)

- [ ] `/places/playground` shows 13 and the clustered map.
- [ ] A couple of source links open the official park page.

## Rollback

`git revert`. Registry-only.

## Next: the OSM "every playground" map layer (piece 2)

The big one. Scope: query OpenStreetMap (Overpass, `leisure=playground`) across
the metro bounding box → a generated data file (thousands of points, most
name-only) → a **separate, zoom-gated GL layer** distinct from the curated list,
clearly labeled as community/OSM data (not the verified registry). Its own
multi-session build; the curated list above is the editorial spine it complements.
