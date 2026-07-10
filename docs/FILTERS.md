# Price & Area filters

Roadmap 2.5. A collapsible **Filters** panel lets people narrow events by **price** (Free / $ / $$ / $$$) and **metro area** (Minneapolis, St. Paul, North/South/East/West suburbs, Elsewhere). Everything composes as **AND** with search, category chips, and the range presets — and narrows all surfaces at once (calendar dots, map pins, day lists).

## How it works

- **Selection is client-side** — instant, no backend. The filtered set is computed once and threaded into every surface, so the calendar, map, and day panel always agree.
- `lib/filters.ts` (pure, unit-tested): `PRICE_TIERS`, `matchesPrice`, `matchesArea`, `applyPriceArea`. Empty selection = no constraint.
- `lib/areas.ts` (pure, unit-tested): `AREAS` (the buckets) and `areaOf(event)` via a normalized city→area map (`normalizeCity` folds "Saint"→"St", strips periods and the state suffix). Unmapped cities fall into **Elsewhere** so nothing is ever dropped.
- `components/FilterPanel.tsx`: a "Filters" toggle (with an active-count badge) revealing price and area pills, plus a "Clear filters" link.
- In `EventsExplorer` the chain is: search → **price/area** → category chips → time window. The match-count whisper and empty state now cover filters too (with a single **clear all**).

## Analytics

Toggling a filter fires `price_toggle` (`tier`) and `area_toggle` (`area`) through the standard `track()` seam — visible in the Vercel custom-events breakdown, useful for seeing what people filter for (feeds Collections ideas in 2.4).

## Notes & future

- Area mapping is data-driven from a metro city list (~90 cities). To extend, add entries to `CITY_AREA` in `lib/areas.ts`.
- A lat/lng fallback (assign an area by coordinates when a city isn't mapped) is a natural future enhancement; today unmapped cities are "Elsewhere."
- This unblocks **2.4 Collections** — curated views are essentially saved filter combinations.
