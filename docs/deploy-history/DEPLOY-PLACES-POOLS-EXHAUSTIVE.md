# Deploy — pools, metro sweep (17 → 25)

*August 2026. Third category of the exhaustive-coverage expansion. Registry-only.*

## What shipped

The `pool` kind went from **17 → 25** — the metro's public aquatic centers and
water parks that were missing:

- **Minneapolis (MPRB):** North Commons Water Park, Jim Lupient Water Park.
- **Suburban outdoor aquatic centers:** SandVenture (Shakopee), Anoka Aquatic
  Center, Apple Valley Family Aquatic Center (Splash Valley), Hastings Family
  Aquatic Center.
- **Indoor, year-round:** Veterans Memorial Community Center "The Grove" (Inver
  Grove Heights), Brooklyn Center Community Center pool.

Every entry has its official city / park-board page as `sourceUrl`, a full
street address, and — because aquatic centers are facilities with real addresses
— **accurate coordinates** (the coordinate softness from the beach pass doesn't
apply here). Outdoor pools use the `POOL_SUMMER` season; the two indoor centers
are `YEAR_ROUND`. All are paid admission.

## Method

Direct main-loop research (WebSearch/WebFetch) against official city pages and
the MPRB water-parks list, deduped against the existing 17, verified per entry.

## Deferred (confirmed or likely, need verification next pass)

- **West St. Paul outdoor pool** — appears on aggregator lists; no confident
  official page/address yet.
- **Roseville, Plymouth Creek Center, Minnetonka (Williston), Woodbury, White
  Bear, South St. Paul** — likely have municipal or community-center pools but
  weren't confirmed with an official source + address this pass.
- **Private YMCAs / school-district pools** — deliberately excluded (membership /
  not public-facing municipal facilities), consistent with the existing list.

## Verification

Gate: `tsc` clean · **961** tests · `npm run build` clean · `npm audit` 0. Dev
render of `/places/pool`: count line "**25** across the Twin Cities metro".

## Deploy steps

Push to `main`. Registry data only. The sitemap already lists `/places/pool`.

## Verify checklist (production)

- [ ] `citypulsemn.com/places/pool` shows 25 and the clustered map.
- [ ] A couple of source links open the official aquatic-center page.

## Rollback

`git revert`. Registry-only.

## Next categories

Rinks and sledding (winter pair) are the remaining bounded ones; parks and
playgrounds are the "truly every one, clustered" categories. Plus the deferred
pools and beaches above, and a coordinate-refinement pass on the beach entries.
