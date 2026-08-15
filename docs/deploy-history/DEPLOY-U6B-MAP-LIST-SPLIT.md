# Deploy — U6b: side-by-side map + list on desktop

*Roadmap UX2 U6 (Taren's list #2, desktop) — slice b. Aug 14, 2026. Size M.*

## What shipped

On desktop, the **Map** view is now a two-pane layout: the map beside a scrollable
**companion list** of the same filtered events — "browse the list while seeing the
pins." Clicking a list row **flies the map to that event's pin and highlights it**
(gold outline). The three views were previously mutually exclusive (map OR list);
now map mode shows both.

- ≥1000px: `.map-split` grid — map (flexible) + a 380px scrollable list. Verified:
  `802px 380px` at 1280px, 22 rows, list scrolls internally.
- <1000px: the companion list is hidden and the map is full-width (the List view
  already covers reading on narrow screens). Verified: split `block`, list `none` at
  860px.

## Design decisions

- **Additive to `MapView`, not a rewrite.** `MapView` gained one optional prop,
  `focusId`. An effect finds that event's marker (markers are stored parallel to the
  events array), flies to it (`map.flyTo`, min zoom 12.5), and toggles a
  `.cp-marker-focus` class (gold outline + glow) on it — removing it from the others.
  Nothing about the existing map behavior changed.
- **Row click = locate on the map** (fly + highlight), which is the natural action in
  *map* mode; the pin's popup still has "View details" → the modal. The companion row
  is a real `<button>` (keyboard-accessible, `aria-pressed`).
- **Compact rows** (time · title · venue · city), sorted chronologically; the list
  scrolls internally to roughly the map's height so the map stays in view.
- **Reused everything else** — the filtered `windowedEvents`, the existing MapView,
  the app's palette/tokens. One new thin component + CSS.

## Files

- `components/MapView.tsx` — `focusId` prop + the fly-to/highlight effect.
- `components/MapEventList.tsx` — new companion list (compact rows, focus on click).
- `components/EventsExplorer.tsx` — `mapFocusId` state; the map view now renders
  `.map-split` = `MapView` + `MapEventList`.
- `app/globals.css` — `.map-split` / `.map-list` / `.map-list-row` /
  `.cp-marker-focus`.

## Verification (observed)

- `npx tsc --noEmit` clean · `npm run build` clean · `npm audit` 0.
- `npm test` — **1045 passed** (no new unit tests — this is imperative map + a thin
  component; verified by smoke).
- **Live smoke** (dev has no Mapbox token, so the map itself shows its "needs token"
  fallback — expected):
  - 1280px: `.map-split` `display: grid`, columns `802px 380px`; companion list
    `display: flex`, `overflow-y: auto`, 22 rows.
  - Clicking a row → exactly one `.map-list-row.on` (the focus/highlight state that
    drives the map fly-to).
  - 860px: split `block`, list `none` — map full-width.
  - **Token-gated (prod-only):** the `map.flyTo` + `.cp-marker-focus` pin highlight
    render only where a Mapbox token exists; the code is additive and tsc-clean and
    rides the existing marker infrastructure. Confirm on the deployed site: in Map
    view on desktop, clicking a companion row flies the map to that pin and outlines
    it gold.

## Deploy / rollback

Merge to `main` — Vercel auto-deploys (the token is set there). No schema/env change.
Rollback: revert this commit (the `focusId` prop, the new component, the render
split, and the CSS together).

## Follow-up

Post-deploy, do the token-gated visual check above on the live site (dev can't render
the real map). A hover-to-preview-pin (in addition to click-to-fly) is a possible
future refinement.
