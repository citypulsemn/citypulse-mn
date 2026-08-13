# Deploy — interactive (clustered) Places map

*August 2026. Places P4.2 (was gated on a vitals check). Turns the static pin
image on `/places/[kind]` into a pan/zoom Mapbox GL map. This is also the
**prerequisite for the exhaustive-coverage plan**: the static map capped at 30
pins, so "every splash pad in the metro" literally could not render — a clustered
GL map has no such cap.*

## What shipped

- **[components/PlacesMapInteractive.tsx](../../components/PlacesMapInteractive.tsx)**
  — a `"use client"` map. `mapbox-gl` is imported *inside* the effect, so its
  ~200 KB ships to the client only on mount, not in the page bundle (First Load
  JS for `/places/[kind]` stays ~107 KB). Native GL **clustering** via a GeoJSON
  source (`cluster: true`): points collapse into gold count-bubbles that break
  apart as you zoom — the thing that scales to thousands of entries on the GPU.
  Click a cluster → zoom to expand; click a point → a popup that **deep-links to
  its list row** (`#slug`; the row has `scroll-margin-top` so the sticky TopBar
  doesn't hide it). Navigation + geolocate ("near me") controls. Fits bounds to
  the set on load.
- **[lib/places-map.ts](../../lib/places-map.ts)** — `placesToGeoJSON()` (pure,
  unit-tested): the map shell stays thin, and the one real footgun — GeoJSON's
  `[lng, lat]` order vs the registry's `lat, lng` — is pinned by a test. Also
  drops entries with non-finite coordinates rather than dumping them at 0,0
  (honest data — an ungeocoded place is excluded from the map and still listed).
- **[app/places/[kind]/page.tsx](../../app/places/[kind]/page.tsx)** — renders the
  interactive map instead of the static image.
- **[components/PlacesList.tsx](../../components/PlacesList.tsx)** — comment
  updated: the list is now the accessible (keyboard/screen-reader) path, since GL
  cluster layers aren't per-point focusable; popups bridge map → list via `#slug`.

## Design decisions

- **Clustering from day one**, even though today's registry is only 84 entries —
  because the coverage plan is to go exhaustive (thousands). Building the scalable
  map first unblocks that; a DOM-marker map (like the event map) would jank at
  scale.
- **List is the content, map is the enhancement.** The list carries every name,
  cost, tag, intro, and the authoritative source link, and is fully accessible.
  The map is a spatial index on top.
- **Dark-v11 style** to match the site and the event map. Swappable to an
  outdoors/streets style later if wayfinding to parks/beaches wants it.
- **Lazy by construction** (in-effect import) so Core Web Vitals aren't paying for
  Mapbox on first paint — the original reason this was gated.
- **Cost:** Mapbox GL draws from Mapbox's *map-load* quota (free tier ~50k/mo),
  **not** Supabase egress — unrelated to the recent egress work.

## Verification (honest limits)

Gate: `tsc` clean · **961** tests (+7 for `placesToGeoJSON`) · `npm run build`
clean (`/places/[kind]` prerenders, First Load JS ~107 KB) · `npm audit` **0**.

Local dev has **no `NEXT_PUBLIC_MAPBOX_TOKEN`**, so — as with every map on this
site — the live map can't be exercised locally. Verified structurally: on
`/places/beach` the component mounts, shows its no-token fallback note, and the
21-row list renders intact with `#slug` anchors; the old static figure is gone.
**The interactive map (clustering, popups, pan/zoom) is verified in production**,
where the token exists — see the checklist.

## The 30-pin cap is retired, but the static helper is still here

`placesStaticMapUrl` / `PLACES_MAP_MAX_PINS` / `components/PlacesMap.tsx` are now
**unused** (the kind page no longer renders them). Left in place this session to
avoid churning their tests; they're a clean removal candidate for a follow-up (or
a keep, if we ever want a no-JS static fallback).

## Deploy steps

Push to `main`. Code-only, no schema, no new env (the Mapbox token already
exists in Vercel). Vercel auto-deploys.

## Verify checklist (production)

- [ ] `citypulsemn.com/places/beach` shows a real map that pans/zooms.
- [ ] Zooming out clusters the pins into gold count-bubbles; zooming in splits them.
- [ ] Clicking a point opens a popup (name · city · cost · season) with a "See
      details ↓" link that jumps to the matching list row.
- [ ] The "near me" (geolocate) control works on mobile.
- [ ] No console errors on the page.

## Rollback

`git revert`. The static `PlacesMap` + `placesStaticMapUrl` are still present, so
a one-line swap back on the kind page also works if needed.

*(Shipped alongside, in its own commit: a `nanoid` security bump —
GHSA-2v37-7h3g-55p8, a transitive advisory that landed mid-session, fixed via
`npm audit fix`.)*
