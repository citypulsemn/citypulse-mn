# Deploy — The map reacts to the filters

*Aug 17, 2026. Follow-on to filter-by-detail. Until now the interactive Places
map was mount-once and always showed every pin, while the filter bar narrowed only
the list below it. Now the map and the list move together: filter to "Indoor," or
"Free + St. Paul," and the map re-clusters to just those points and reframes to
them.*

## Design — update in place, never remount
Remounting Mapbox on every keystroke would flicker, re-download nothing but still
rebuild the GL context, and throw away the user's pan/zoom. So the map stays
mounted once and reacts by **updating its GeoJSON source in place**:
- The browse component ([components/PlacesBrowser.tsx](../../components/PlacesBrowser.tsx))
  now owns the map and passes the **filtered** set as a `visible` prop.
- A lightweight effect in
  [components/PlacesMapInteractive.tsx](../../components/PlacesMapInteractive.tsx)
  watches a **membership signature** (sorted slugs) — so a near-me *re-sort*, which
  doesn't change which places are shown, never moves the map — and on a real change
  calls `source.setData(...)` (Mapbox re-clusters on the GPU) then `fitBounds(...)`
  to reframe. No teardown, pan/zoom preserved between unrelated interactions.
- **Load-race safe:** the initial source and bounds read the *current* visible set
  via a ref, so a filter applied during the ~1s Mapbox load is honored the moment
  the source is added; the reaction effect no-ops until the source exists.

## What shipped
- **Pure logic:** `placesBounds(places)` → `[[minLng,minLat],[maxLng,maxLat]]` (or
  `null` for an empty/uncoordinated set, so the map keeps its viewport instead of
  jumping to 0,0). Ignores non-finite coords exactly like `placesToGeoJSON`
  ([lib/places-map.ts](../../lib/places-map.ts)). Lets the reaction effect refit
  without pulling the Mapbox module in for a `LngLatBounds`.
- **Wiring:** map moved from the page into `PlacesBrowser` (fed `visible={filtered}`);
  new membership-signature reaction effect; `setData` + `fitBounds`.
- The gray OSM "every one" backdrop (playgrounds/parks) is intentionally *not*
  filtered — it's the community-mapped reference layer, a different dataset than the
  curated gold pins; only the curated pins react.

## Verification (observed, not intended)
- **Pure + wiring (local, golden + tripwire):** `placesBounds` covered for the
  multi-point box, the single-point zero-area box, non-finite dropping, and the
  empty→null case. Tripwires assert the map now lives in `PlacesBrowser` fed the
  filtered set, is gone from the page, and updates via `setData`/`placesBounds`
  (not a remount). **Tests +6** (1122 total). `tsc` clean · `npm run build` clean ·
  `npm audit` 0.
- **Local browser:** the map placeholder renders above the filter bar, filters
  still narrow the list (Indoor → 5 of 27), console clean. **Local has no Mapbox
  token**, so the live pin reaction can't be observed locally (environment blind
  spot, ENGINEERING rule 3).
- **Production (the axis that matters):** verified on the deployed site — see the
  post-deploy check below.

## Deploy steps
Merge to `main`; Vercel auto-deploys (it holds `NEXT_PUBLIC_MAPBOX_TOKEN`).
No schema, no new secret.

## Post-deploy verify
On `citypulsemn.com/places/rink`: tap **Indoor** — the map should re-cluster to the
5 arenas and reframe to them; tap **Clear** — it returns to all 27. On
`/places/ski-hill`, **Snow tubing** should drop the map to the 5 tubing hills.
The list count and the visible pins should always agree.

## Rollback
`git revert`. The reaction is additive (a `visible` prop + one effect + the
`placesBounds` helper); reverting restores the always-all map with the list-only
filters, badges and feature-filters intact.
