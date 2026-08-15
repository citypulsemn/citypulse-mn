# Deploy — U7: "near me" location filter (city + radius)

*Roadmap UX2 U7 (Taren's list #5). Aug 14, 2026. Size M.*

## What shipped

The homepage explorer gains a **"near me"** control: pick your metro city, choose a
radius, and the events filter to that circle. It persists across visits (it's "my
area", a standing preference, not a transient filter). Verified: picking St. Paul at
5 miles narrows this week from 194 events to 44 — all genuinely St. Paul-area (West
St. Paul Farmers Market, Bell Museum, the State Capitol …).

## The honest-data decision (why city, not a typed zip)

The ask was "zipcode or city." A zip→coordinates table would mean ~200–400
hand-entered coordinate pairs — exactly the kind of data an LLM fabricates, and
wrong coords would quietly misplace people. So instead of inventing a zip table,
each city's center is computed from **its own events' coordinates** (every published
event is geocoded — non-null lat/lng, the pipeline skips failures). Zero external
data, zero fabricated coordinates, and it's derived from ground truth we already
trust. The city + radius covers the core "tailor to my area" intent honestly.

Zip entry and "use my current location" are clean follow-ups that feed the *same*
`{ lat, lng }` center — see below.

## Design decisions

- **FILTER, not sort.** The list is a chronological day-grouped agenda; sorting by
  distance would shatter that. A radius filter keeps the day grouping and just shows
  fewer events. Default radius **25 mi** (covers the metro from most points); options
  5 / 10 / 25 / 50. It composes as another AND filter in the explorer's existing chain
  (search → price/area → **distance** → window → category).
- **Centroids from our own events** (`cityLocations`) — the picker lists the ~68
  cities that currently have events, busiest-first (Minneapolis, St. Paul, Bloomington
  …). A city with no events simply doesn't appear (honest emptiness).
- **Persisted in localStorage** (`cp_location` = `{ key, radiusMi }`), mirroring the
  `cp_default_view` pattern. Only the city KEY is stored; on restore the coords are
  re-derived from the current events, so they stay fresh and a since-emptied city
  drops. Saving happens in the handlers (not an effect), so it can't race the
  restore-once on mount. Stays out of the URL, so the homepage remains ISR-cached
  (URL-sync for shareable located views is a possible follow-up).
- **Clear** resets it (and `clearAll` / the empty-state "clear all" clear it too).

## Files

- `lib/location.ts` — `cityLocations(events)` (centroids), `filterByDistance(events,
  center, radiusMi)` (reuses the tested `distanceMeters` Haversine), `RADIUS_OPTIONS_MI`
  / `DEFAULT_RADIUS_MI`, `MetroLocation`.
- `components/LocationControl.tsx` — the city + radius + clear control (styled
  selects, gold when active, 44px targets).
- `components/EventsExplorer.tsx` — state, the `locations` memo, the distance step in
  the `filtered` memo, localStorage persistence + restore-once, `filtersActive` /
  `clearAll` wiring, and the control render.
- `app/globals.css` — `.locctl` styles.
- `lib/__tests__/location.test.ts` — 9 golden tests.

## Verification (observed)

- `npx tsc --noEmit` clean · `npm run build` clean · `npm audit` 0.
- `npm test` — **1045 passed** (location 9/9: centroid mean, city-variant grouping
  Saint Paul/St. Paul/St Paul→one, busiest-first sort, radius boundary in/out).
- **Live smoke:**
  - Control renders with 68 city options ("Anywhere in the metro" default), radius
    hidden until a city is chosen.
  - Pick St. Paul → radius appears, gold styling, `cp_location` written.
  - 25 mi keeps all 194 (metro-wide); **5 mi → 44**, all St. Paul-area venues.
  - Clear → back to 194, `cp_location` removed.
  - Reload with a saved pref → restores St. Paul / 5 mi and re-filters to 44.

## Deploy / rollback

Merge to `main` — Vercel auto-deploys. No schema/env change; the homepage stays
ISR-cached (all client-side). Rollback: revert this commit (new lib + component +
CSS + tests, and the explorer wiring, together).

## Follow-ups (same `{ lat, lng }` seam)

- **Typed ZIP entry** — add a real Census ZCTA `zip → { lat, lng }` table
  (`lib/zip-coords.ts`, drift-tested like `lib/places.ts`) and let the control accept
  a 5-digit zip. Needs a sourced dataset, not fabricated coords.
- **"📍 Use my location"** — the browser geolocation API gives exact coords with a
  permission prompt; one button feeding the same filter. Easy add.
- **URL-sync** the location for shareable "events near X" links (extend
  `serializeExplorer`/`parseExplorer`).
- **Map centering** — when a location is set, center/zoom the Map view on it.
