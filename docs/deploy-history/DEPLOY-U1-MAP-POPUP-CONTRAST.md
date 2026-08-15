# Deploy — U1: map popup contrast (light-on-light fix)

*Roadmap UX2 U1 (Taren's list #4). Aug 14, 2026. Size XS.*

## What shipped

Fixed the Mapbox popup that rendered near-white text on a white box — the event
name and details were effectively invisible when you selected a pin. Now the popup
is the intended dark-navy box with cream text, on both the homepage event map and
the Places maps.

## Root cause

The vendor `mapbox-gl/dist/mapbox-gl.css` is imported from the client map components
(`components/MapView.tsx`, `components/PlacesMapInteractive.tsx`), so it loads **after**
`app/globals.css` (imported once in the root layout). Its
`.mapboxgl-popup-content { background:#fff }` ties the site's intended
`background: var(--navy-900)` on specificity (one class each) and wins on source
order. The box went white while `.pop-title` (cream) and `.pop-meta` (light) kept
their dark-box colors → light on light. The author had already hit this and fixed
only the popup *tip* with `!important` (`globals.css:162`); the content box was missed.

## Fix

`app/globals.css` — added `!important` to `background` and `color` on
`.mapboxgl-popup-content`, mirroring the tip fix on the next line, with a comment
explaining the cascade. One line changed; markers/pins untouched (they were fine).

## Verification (observed)

- `npx tsc --noEmit` clean · `npm run build` clean · `npm audit` 0.
- **Live smoke** on `/places/beach` (a page that loads the vendor CSS): injected a
  real `.mapboxgl-popup-content` node and read computed styles with the vendor rule
  confirmed present on the page (real competition):
  - vendor white rule loaded: **true**; site `!important` rule present: **true**
  - box `background-color`: **rgb(14, 24, 48)** (navy `--navy-900`, not white)
  - box + title `color`: **rgb(241, 236, 224)** (cream) → high contrast, readable.

## Deploy / rollback

Merge to `main` — Vercel auto-deploys. CSS-only, no schema/env. Rollback: revert the
one line.
