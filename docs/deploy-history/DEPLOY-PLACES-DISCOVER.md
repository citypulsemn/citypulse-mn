# Deploy — Cross-kind discovery: the "Find a Place" finder

*Aug 17, 2026. A kind page answers "which pool?"; this answers "what can we do near
us — free, indoor, right now?" A new `/places/discover` pools every place (522) and
filters on the axes that cut ACROSS kinds. Turns the per-kind moat into a single
everything-finder.*

## Design — only honest cross-cutting axes
- **`crossKindDetailKeys(places)`** ([lib/places.ts](../../lib/places.ts)) returns a
  detail only when **≥2 different kinds carry it** — so the finder offers `indoor`
  (rinks + pools), `fenced` (dog parks + playgrounds), `cafe` (indoor playgrounds +
  museums), `socks required` (indoor playgrounds + trampoline), `restrooms` (splash
  pads + playgrounds). A single-kind fact (a pool's water slide) stays on that
  kind's page — it doesn't belong on the everything finder.
- **Reuses the pure, golden-tested logic:** `filterPlaces` (extended with an
  optional `kinds` filter for the kind picker), `placesByDistance` for near-me. No
  new filter engine.
- **List-first, no map:** 522 mixed places don't belong on one map; near-me sort is
  the spatial tool. Each row shows its **kind** as a link (a new `showKind` on
  `PlacesList`) since the list mixes pools, museums, parks, etc.

## What shipped
- **Pure logic:** `crossKindDetailKeys` + a `kinds?: PlaceKind[]` axis on
  `PlaceFilters`/`filterPlaces` ([lib/places.ts](../../lib/places.ts)).
- **UI:** `PlacesDiscover` client component (cost · open-this-season · kind picker ·
  cross-cutting feature chips · near-me · Clear) and the `/places/discover` page;
  `PlacesList` gains `showKind`; the `/places` index links to it.

## Verification (observed, not intended)
- **Live browser** (`/places/discover`, DOM-driven): 522 places pooled; feature
  chips are exactly **Indoor · Fenced · Café · Socks required · Restrooms**; 19 kind
  options; rows show their kind ("Beach", …). **Free + Restrooms → 48 of 522, mixing
  Splash Pad AND Playground** — the cross-kind payoff. `/places` links to the
  finder. Console clean.
- **Tests +5** (1179 total): `crossKindDetailKeys` is exactly the ≥2-kind facts in
  label order and excludes single-kind ones; the kind filter narrows (empty = all);
  a cross-kind AND genuinely mixes kinds — and the test notes that **free + indoor is
  honestly empty** (indoor arenas/aquatic centers are all paid), a reminder the
  filter never fabricates a match; the page/component wire-in tripwire.
- Gate: `tsc` clean · 1179/1179 · `npm run build` clean · `npm audit` 0.

## Deploy steps
Merge to `main`; Vercel auto-deploys. No schema, no secret.

## Follow-ups
- A map of the *filtered* discover results (the per-kind reactive map doesn't fit
  522 pins; a filtered subset would) — a later enhancement.
- Chip presets ("Free & indoor", "Fenced near me") as one-tap starting points.

## Rollback
`git revert`. The `/places/discover` page, `PlacesDiscover`, `crossKindDetailKeys`,
and the `kinds`/`showKind` additions are all additive; reverting removes the finder
and leaves the per-kind pages untouched.
