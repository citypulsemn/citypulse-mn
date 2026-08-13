# Deploy — rinks + sledding, the winter pair (rinks 4→8, sledding 5→11)

*August 2026. The last of the curated exhaustive category sweeps. Registry-only.
Built off-season (guides rank best if indexed before December), evergreen data.*

## What shipped

- **Rinks 4 → 8** — the *destination* skating spots (not every hockey arena, and
  not every flooded neighborhood rink — see the note below): Central Park Ice
  Skating Loop (Maple Grove, a rare refrigerated outdoor rink), the ROC (St.
  Louis Park, covered refrigerated), and two marquee indoor open-skate arenas,
  Braemar (Edina) and Bloomington Ice Garden.
- **Sledding 5 → 11** — from St. Paul's official sledding list (Highland — the
  fan favorite, Margaret, Merriam) plus Running Park (Bloomington), Staring
  Lake's 700-foot mega hill (Eden Prairie), and Roseville Central Park.

Every entry has an official source + street address → accurate coordinates.

## Honest calls

- **The Depot Ice Rink (Minneapolis) — excluded, permanently closed.** (Don't
  re-add without confirming it reopened.)
- **Rinks stay curated, not exhaustive-of-everything.** "Every flooded
  neighborhood rink" is the same unbounded case as playgrounds — hundreds of city
  rinks — which belongs in a future OSM/bulk map layer, not the verified
  registry. This list is the destination + refrigerated + marquee-indoor set.
- **Deferred (need a confident source):** Goat Hill refrigerated rink (Eagan),
  Wells Fargo WinterSkate at Rice Park (St. Paul), and the other Ramsey/St. Paul
  indoor arenas (Aldrich, Charles Schulz–Highland, TRIA). St. Paul recommends ~15
  sledding hills; the smaller neighborhood ones (McMurray, Orchard, Prosperity…)
  are candidates for a later pass.

## Verification

Gate: `tsc` clean · **961** tests · `npm run build` clean · `npm audit` 0. Dev
render: `/places/rink` → "**8** across the Twin Cities metro"; `/places/sledding`
→ "**11**".

## Deploy steps

Push to `main`. Registry data only. Sitemap already lists both kinds.

## Rollback

`git revert`. Registry-only.

## Milestone: curated exhaustive sweeps complete

With this, every Places kind has had its curated exhaustive pass:
**splash-pad 49 · beach 45 · pool 25 · playground 13 · park 13 · rink 8 ·
sledding 11.** What remains to "finish Places": the OSM bulk map layers ("every
playground", "every park", and the "every flooded rink" variant), the
farmers-market kind (still unseeded), the deferred entries across categories, and
the beach coordinate-refinement pass.
