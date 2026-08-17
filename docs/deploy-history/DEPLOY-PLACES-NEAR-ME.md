# Deploy — Places "Near me" distance sort

*Aug 17, 2026. The P4.3 follow-up. Kind pages now filter (cost/season/city); this
adds the last thing a "where should we go" browser wants: sort the list
nearest-first from where you actually are, with each place's distance shown. Uses
the browser geolocation API + the existing Haversine — the location point is
never stored.*

## Design
- **New capability, existing math.** The homepage location feature is *city-pick*
  based (its own note: geolocation "can later feed the same {lat,lng}"). This is
  that later — actual GPS. It reuses `distanceMeters` (the shared Haversine, same
  formula as the near-duplicate rule) rather than a second distance function.
- **Sort, don't filter.** "Near me" ranks the (already filtered) list ascending by
  straight-line miles — it never hides a place, so it composes cleanly with the
  cost/season/city filters. Registry order returns when you toggle it off.
- **Privacy:** the coordinate comes from `navigator.geolocation.getCurrentPosition`
  on an explicit tap and lives only in component state — never persisted, never
  sent anywhere. `enableHighAccuracy: false` (a metro-scale sort doesn't need GPS
  precision), 10s timeout, 5-min cache.

## What shipped
- **Pure ranking** ([lib/places.ts](../../lib/places.ts)): `placesByDistance(places,
  origin)` → a new array of `{ place, miles }` sorted nearest-first (stable ties,
  no mutation). `LatLng` / `RankedPlace` types. Golden-tested.
- **`PlacesList`** ([components/PlacesList.tsx](../../components/PlacesList.tsx))
  gains an optional `distances?: Map<slug, miles>` prop — renders "· X.X mi" (or
  "<0.1 mi") in the row meta when present; unchanged otherwise.
- **`PlacesBrowser`** ([components/PlacesBrowser.tsx](../../components/PlacesBrowser.tsx))
  gains a **📍 Near me** button (→ "Locating…" → "✓ Nearest first"), a graceful
  error note when location is blocked/unsupported, and the ranked render path.
  The shared **Clear** now also resets the near-me sort.
- **CSS** ([app/globals.css](../../app/globals.css)): `.place-dist` (gold, tabular),
  `.pf-nearme`, `.pf-geo-note`.

## Verification (observed, not intended)
- **Live browser, mocked geolocation** (the headless dev pane has no real GPS):
  injected a downtown Minneapolis fix, tapped Near me → the list re-sorted
  nearest-first and each row showed its mileage; toggling off restored registry
  order; filters + near-me compose. (Screenshots blocked by the 0×0 pane, so
  verified by driving the DOM.)
- **Tests +3** (1105 total): `placesByDistance` ranks nearest-first with miles
  attached and strictly increasing; the unit is miles not meters (~1° lat ≈ 69 mi);
  no input mutation. (Plus the P4.3 filter tests from the prior deploy.)
- Gate: `tsc` clean · 1105/1105 · `npm run build` clean · `npm audit` 0.

## Deploy steps
Merge to `main`; Vercel auto-deploys. No schema, no secret. Geolocation runs
client-side after an explicit tap; pages stay prerendered + ISR.

## Notes / deferred
- Straight-line distance, not driving distance (no routing API, no cost, honest
  "as the crow flies" — fine for "which is closest").
- The **map still doesn't react** to the sort (mount-once) — a later pass could
  `setData` + a "you are here" marker.
- Geolocation needs **HTTPS** (prod is; localhost is treated as secure) — it won't
  prompt on a plain-HTTP origin, which is why verification mocks the position.

## Rollback
`git revert`. `distances` is an optional prop and `placesByDistance` is additive;
reverting removes the button and the distance column, leaving the P4.3 filters.
