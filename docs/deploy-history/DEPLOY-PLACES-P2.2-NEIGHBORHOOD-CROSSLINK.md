# Deploy — Places P2.2: neighborhood cross-linking

*August 2026. First integration item of Places Phase 2 — the two halves of the
site (events + Places) start feeding each other.*

## What shipped

**A "Places in {label}" strip on neighborhood pages**
([NeighborhoodPlaces](../../components/NeighborhoodPlaces.tsx), rendered by
[app/neighborhoods/[slug]/page.tsx](../../app/neighborhoods/[slug]/page.tsx)).
Below a district's events, it lists the evergreen Places that sit in that
district — grouped by kind, each linking **into** its kind page anchored to the
entry (`/places/beach#lake-harriet-north-beach`), with a "· seasonal" hint when
a place is closed for the season. Honest emptiness: the strip renders nothing
for districts with no registry places (most of them, for now).

This is the **neighborhood → Places** direction. The **Places → neighborhood**
direction already shipped in P1.2 (PlacesList renders each place's neighborhood
as a link), so the loop is now closed both ways.

**New pure helper** ([lib/places.ts](../../lib/places.ts)): `groupPlacesByKind`
— groups a set of places by kind in `KIND_META` order, dropping empty kinds.
Golden-tested; the component is a thin shell over it + the existing
`placesByNeighborhood` selector.

## Why it's small

The heavy lifting was already in place: `placesByNeighborhood` (P1.1, tested) and
the reverse link (P1.2). P2.2 is the last connector — a strip that turns the
data relationship into a visible cross-link, enriching the neighborhood pages
(more internal links, the cheapest ranking signal) at essentially zero risk.

## Verification (observed, not intended)

- **Live in dev:** `/neighborhoods/southwest-lakes` shows **"Places in Southwest
  & the Lakes"** → a *Beaches* group with **5 links**, each pointing at
  `/places/beach#<slug>`; the anchor target (`id="…"`) exists on the beach page,
  so the deep-link scrolls to the entry. `/neighborhoods/loring-park` (no
  registry places) shows **no strip**. No console errors.
- **Tests +5 (932/932):** `groupPlacesByKind` (groups a district's beaches into
  one kind group; keeps `KIND_META` order across a mixed set; empty→empty) plus
  wiring tripwires (the page renders `<NeighborhoodPlaces>`; the component uses
  `placesByNeighborhood` + `groupPlacesByKind`, deep-links into the kind page,
  and returns null when empty).
- **Gate:** `tsc` clean · 932/932 · `npm run build` clean · `npm audit` 0.

## Where the strip actually appears

Only districts with registry places show it today: **Southwest & the Lakes**
(5 beaches), **Northeast** (1 splash pad), **South Minneapolis** (1 splash pad).
It grows automatically as the registry does — no per-neighborhood wiring.

## Deploy steps

Push to `main`. New component + one pure helper + a neighborhood-page line + CSS.
No schema, no env, no deps. Neighborhood pages stay on-demand ISR (they're
DB-backed for events; the strip reads the static registry, no new DB pressure).

## Verify checklist

- [ ] `/neighborhoods/southwest-lakes` shows a "Places in …" strip; a link jumps
      to that beach on `/places/beach`.
- [ ] A district with no places (e.g. Loring Park) shows no strip.

## Rollback

`git revert`. Additive component + helper + one line; nothing depends on it.

## Next in P2

- **P2.3 — venue bridge:** a `/places/music-venues` page rendered from the
  existing venue registry (+ intros), linking through to full schedules via
  `venueSlug`. (Design note: venues carry no static coordinates — coords are
  derived from their events — so that page is a list, or needs a coord source
  before it gets a map.)
- **P2.1 — more kinds:** pools, curated parks, the fall rink/sledding pair. Data
  curation, zero new code (the season math already handles the winter wrap).
