# Deploy — Places P1.1: the registry + selectors (verified seed)

*August 2026. First item of the Places roadmap (`docs/PLACES-ROADMAP.md`). The
data layer only — no user-facing page ships here (that's P1.2), so nothing
changes for visitors on this deploy. It lands the shape everything else builds
on, verified against real sources.*

## What shipped

**[lib/places.ts](../../lib/places.ts)** — the places registry (in code, not a
DB table, same as venues/neighborhoods → ENGINEERING rule 2 by construction):

- **Types:** `Place`, `PlaceKind` (9 kinds declared), `PlaceCost`, `PlaceSeason`,
  `KindMeta`. `KIND_META` covers all nine kinds so pages don't break as kinds
  get added.
- **Selectors (pure):** `placesByKind` (free-first, then alphabetical — free is
  half the point), `placesByNeighborhood` (the bridge to neighborhood pages),
  `placeBySlug`, `kindsWithPlaces(now)` (only kinds with ≥1 entry, with counts +
  open state — for the P1.2 index, honest-emptiness built in), and
  `openNow(place, date)`.

**The verified seed — 12 entries, both cities, both launch kinds:**

- **6 beaches:** Lake Nokomis Main, Lake Harriet North, Bde Maka Ska Thomas,
  Cedar Lake Point, Lake Hiawatha (Minneapolis) · Phalen Regional Park (St. Paul).
- **6 splash pads:** Bottineau Field, Phelps Field, Currie, Franklin Steele
  Square (Minneapolis) · Roy Wilkins/Lewis, Conway (St. Paul).

Every entry's existence, kind, season, cost, and street address were checked
against the parks-board / city page in its `sourceUrl` on `verifiedAt`
(2026-08-07). Sources: Minneapolis Park & Recreation Board (beaches + splash-pad
lists and individual park pages) and Saint Paul Parks & Recreation (splash pads
+ Phalen beach). All twelve are **free**; all run the summer season.

## Design decisions I settled (the three I flagged in review)

1. **Season is machine-readable, not a fuzzy string.** `PlaceSeason` is a
   discriminated union: `{ type: "year-round" }` or `{ type: "seasonal",
   openMonth, closeMonth, label }`. The month numbers drive `openNow`; the
   `label` ("Memorial Day–Labor Day") is what the page shows — month-level
   honesty, exact yearly dates stay on `sourceUrl`. `openNow` also handles a
   season that **wraps the new year** (a Dec–Feb rink), so P2.1's winter pair
   needs no special-casing.
2. **Neighborhood keys are stored, not derived.** Places are curated, so each
   carries a `NEIGHBORHOODS` key directly (validated by a drift guard) or `null`.
   As predicted, most of these are `null` — the registry only covers the 16
   in-city Minneapolis/St. Paul districts, and lake beaches / suburban spots sit
   outside them. The two southwest-lakes beaches are the connective-tissue proof;
   the rest honestly say `null`.
3. **Code plus a verified seed, not 35 rows in one go.** Per the plan, this lands
   the shape and a real, publishable starter set. The full ~35 is a follow-up
   curation pass; the selectors don't care about the count.

## Verification (observed, not intended)

- **Tests +20 (916/916):** drift guards (unique slugs; every neighborhood key
  and venueSlug resolves; https `sourceUrl` required; real `verifiedAt`; intro
  length + **banned-brochure-word** check; seasonal months in 1–12; **coordinates
  inside the metro bounding box** — catches a transposed lat/lng; valid cost) ·
  `openNow` season math (year-round always; summer open July/closed Jan; May–Sep
  boundaries; the Dec–Feb winter wrap) · selectors (kind filter free-first,
  empty for an unseeded kind, neighborhood filter finds the two southwest-lakes
  beaches and no null ones, `placeBySlug`, `kindsWithPlaces` lists only the two
  seeded kinds with correct counts/open state).
- **Gate:** `tsc` clean · 916/916 · `npm run build` clean · `npm audit` 0.

## Deploy steps

Push to `main`. Pure `lib/` + tests, no route, no schema, no env, no deps.
**Nothing is user-reachable until P1.2** — this is a safe, invisible deploy.

## Verify checklist

- [ ] Build is green on Vercel (no route change to smoke).
- [ ] (Spot-check, optional) open any entry's `sourceUrl` → the place, season,
      and free admission match.

## Rollback

`git revert`. Self-contained; nothing imports `lib/places.ts` yet.

## Next

**P1.2** — `/places` index + `/places/[kind]` pages with a **new** multi-numbered
-pin static-map builder (the existing `staticMapUrl` is single-pin), free-first
list, seasonal banner via `openNow`, canonicals + sitemap. Then P1.3 wire-in.
