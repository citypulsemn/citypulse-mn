# Deploy P4.3 — Places kind-page filters (cost / open-this-season / city)

*Aug 17, 2026. The Places directory has breadth (18 kinds, ~470 entries) but a
kind page was a static list — you couldn't narrow 19 splash pads to "free," "open
now," or "in my city." This adds client-side filters using data the registry
already carries: zero curation, no DB, no SEO dependency. Pure product usability
for the people who actually browse it.*

## Design
- **Filter the content, not the map.** The interactive map is mount-once by design
  (the `placesRef` pattern — it doesn't re-plumb its GeoJSON source on prop
  change), and its own docstring calls the list "the content, the map the
  enhancement." So the map stays the full geographic overview and the filters act
  on the list below it — lower risk, and the honest surface to filter.
- **Only axes the data already supports:** `cost` (free/paid — strict, so a
  pay-what-you-can `donation` place shows only under "All", never conflated),
  `open this season` (`openNow` in the Chicago frame), and `city` (the distinct
  cities present in that kind). No new fields, no research.

## What shipped
- **Pure filter logic** ([lib/places.ts](../../lib/places.ts)): `PlaceFilters`,
  `NO_PLACE_FILTERS`, `filterPlaces(places, f, now)` (AND across axes; takes `now`
  so it's deterministic/testable), and `placeCities(places)` (distinct, sorted).
- **`PlacesBrowser`** ([components/PlacesBrowser.tsx](../../components/PlacesBrowser.tsx))
  — a client component: a cost segmented control, an "Open this season" toggle, a
  city dropdown (only when >1 city), a live "N of M" count + Clear, then the
  filtered `PlacesList`, with an **honest-empty state** ("No X match — Clear
  filters") when a combination excludes everything. `now` is fixed at mount
  (month-granular anyway), and the default state is no-filter so SSR and the first
  client paint agree (no hydration mismatch).
- **Kind page** ([app/places/[kind]/page.tsx](../../app/places/[kind]/page.tsx))
  now renders `<PlacesBrowser>` in place of the bare `<PlacesList>`; the map is
  untouched.
- **CSS** ([app/globals.css](../../app/globals.css)): one `.places-filter` block,
  brand tokens, 34px touch targets, gold-on-navy AA.

## Verification (observed, not intended)
- **Live browser:** on `/places/splash-pad`, the filter bar renders; "Free" narrows
  the list and updates the count; "Open this season" and the city dropdown compose;
  Clear resets; an over-constrained combo shows the honest-empty state. (Screenshot
  in chat / SSR-confirmed where the headless pane was degenerate.)
- **Tests +9** (1102 total): `filterPlaces` — no-filter passthrough, strict free
  (excludes donation), paid, season open/closed in July vs January (Chicago frame),
  city exact match, AND composition, honest-empty over-constrained; `placeCities`
  distinct+sorted; a tripwire that the page renders `PlacesBrowser` not the bare
  list.
- Gate: `tsc` clean · 1102/1102 · `npm run build` clean · `npm audit` 0.

## Deploy steps
Merge to `main`; Vercel auto-deploys. No schema, no secret. Kind pages stay
prerendered + ISR (registry is code); the filter runs client-side after hydration.

## Follow-ups (deferred, noted for honesty)
- The map doesn't react to filters (mount-once) — a later enhancement could
  `setData` the GeoJSON source on filter change so pins narrow too; scoped out
  here to avoid the map's mapbox lifecycle.
- A "near me" distance sort would extend this (the geolocate control exists on the
  map); would reuse the `lib/geo-distance` Haversine from the homepage location
  feature.

## Rollback
`git revert`. The filter is additive; reverting restores the bare `<PlacesList>`.
No data or schema involved.
