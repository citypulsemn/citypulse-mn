# Deploy — the OSM "every one" bulk map layer (playgrounds + parks)

*August 2026. Piece 2 of the playgrounds hybrid — and the answer to "truly every
one" for the unbounded kinds.*

## What shipped

For the two **unbounded** Places kinds (playground, park), the map now carries a
second, **zoom-gated gray layer showing every community-mapped one** from
OpenStreetMap — beneath the hand-picked gold registry pins. Pan the metro and you
see our curated destinations; **zoom in and every playground/park nearby appears
as gray dots.** This is exactly the "hide until zoomed / categorize smartly"
approach the owner asked for.

- **[scripts/build-osm-places.ts](../../scripts/build-osm-places.ts)** — queries
  the OpenStreetMap **Overpass API** for `leisure=playground` / `leisure=park`
  across the metro bounding box and writes compact GeoJSON to
  **public/osm/&lt;kind&gt;.json**. Regenerated manually
  (`npx tsx scripts/build-osm-places.ts playground`), so the build never depends
  on a live third-party API.
  - Current snapshot: **3,417 playgrounds** (360 KB) and **3,197 parks** (374 KB).
- **[PlacesMapInteractive.tsx](../../components/PlacesMapInteractive.tsx)** —
  for OSM kinds only, **fetches the static JSON at runtime** (so it never touches
  the page bundle), adds it as a gray `circle` layer with **`minzoom: 11`**
  (hidden until you zoom in) and **`beforeId: "clusters"`** (rendered *below* the
  gold pins). Clicking a gray dot shows its name (or "Unnamed playground") tagged
  "Community-mapped · OpenStreetMap." A caption under the map explains the two
  layers and links OSM's copyright — **ODbL attribution**.
- Only **playground** and **park** get this. Every other kind is already
  exhaustive in the verified registry.

## Two gotchas worth recording

- **Overpass 406 without a User-Agent.** The API rejects requests that lack a
  descriptive `User-Agent` header — the script sets one.
- **Parks 504 (gateway timeout).** The `leisure=park` query is heavy (big
  polygons); it timed out once and succeeded on retry. If it keeps failing, use a
  mirror (`overpass.kumi.systems`) or narrow the bbox.

## Honesty

The gray dots are **community data** — unverified, mostly name-only, coordinates
of varying precision. They are labeled as such (caption + popup), rendered
distinctly (gray, smaller), and are **map-only** — they never enter the curated
list or claim the registry's verification. The gold curated pins remain the
editorial spine.

## Verification

Gate: `tsc` clean · **967** tests (a new tripwire validates both data files are
FeatureCollections inside the metro box, and pins the map wiring — zoom-gate,
below-gold, OSM label) · `npm run build` clean · `npm audit` 0.

As with every map here, the live layer renders only in production (the Mapbox
token is prod-only), so local verification is tsc + the data-file/wiring
tripwires; the gray-dots-on-zoom behavior is verified in prod.

## Deploy steps

Push to `main`. The generated JSON lives in `public/osm/` (served static). No
schema, no env, no deps.

## Verify checklist (production)

- [ ] `/places/playground` and `/places/park`: gold pins at metro zoom; **zoom
      in past ~z11 and gray dots appear** for every OSM playground/park.
- [ ] Clicking a gray dot shows its name / "Community-mapped · OpenStreetMap."
- [ ] The caption under the map links OpenStreetMap.
- [ ] Other kinds (golf, pools, …) show **no** gray layer.

## Rollback

`git revert`. The map falls back to registry-only pins; the `public/osm/*.json`
files and the script are inert if unused.

## Refreshing the data

`npx tsx scripts/build-osm-places.ts playground` and `… park` regenerate the
snapshots. Worth doing a couple of times a year, or wiring into a low-frequency
job later.
