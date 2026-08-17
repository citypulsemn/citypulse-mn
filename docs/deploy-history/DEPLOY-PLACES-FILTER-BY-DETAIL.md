# Deploy — Filter by detail (turn the verified badges into filters)

*Aug 17, 2026. The winning-detail moat now spans ski hills and rinks — every
verified fact renders as a gold ✓ badge. This makes those facts **actionable**:
a per-kind feature filter so a skater can ask "which are indoor?" and a parent
can ask "which have snow tubing?" and get the answer in one tap. Extends the
generic P4.3 filter bar (cost / open-this-season / city / near-me).*

## Design — only offer filters the data can honestly answer
- **`activeDetailKeys(places)`** ([lib/places.ts](../../lib/places.ts)) returns the
  labeled details at least one place in the set actually carries, in render order.
  So the rink page offers **Indoor · Warming house**, the ski page offers **Snow
  tubing · Night skiing · Terrain park · Rentals · Lessons**, and a kind with no
  verified details (beaches today) offers **none** — no dead options, honest to the
  data on hand.
- **`filterPlaces` detail axis** is AND and **strict**: a place must have the fact
  set to `true`. An absent/unverified fact never matches, so a filter can never
  over-promise something we haven't confirmed — the same honesty rule that governs
  the badges themselves. Selecting two mutually-exclusive facts (Indoor **and**
  Warming house) correctly yields the honest-empty state, not a fudged result.

## What shipped
- **Pure logic:** `PlaceFilters` gains a `details: (keyof PlaceDetails)[]` axis;
  `NO_PLACE_FILTERS` seeds it `[]`; `filterPlaces` ANDs each selected fact;
  new `activeDetailKeys()` selector ([lib/places.ts](../../lib/places.ts)).
- **UI:** a multi-select feature-chip group in
  [components/PlacesBrowser.tsx](../../components/PlacesBrowser.tsx), rendered only
  when the kind has verified details. Chips echo the gold ✓ badge style (outlined
  gold when off, filled gold with a ✓ when on) so they read as a different axis
  than the cost segmented control ([app/globals.css](../../app/globals.css),
  `.pf-details`). Composes with cost / season / city / near-me and the Clear reset.

## Verification (observed, not intended)
- **Live browser** (driven via the DOM; 0×0 pane blocks screenshots):
  - `/places/rink`: feature chips = **Indoor, Warming house**. "Indoor" → **5 of
    27** (exactly the arenas). "Indoor" + "Warming house" → **0 of 27**, honest-empty
    "No ice rinks match these filters" with Clear.
  - `/places/ski-hill`: chips = **Snow tubing, Night skiing, Terrain park, Rentals,
    Lessons**. "Snow tubing" → **5 of 7** (drops Hyland + Como, which lack it).
  - `/places/beach`: **no feature group** (no verified detail); cost/city intact.
  - Console clean, no errors.
- **Tests +5** (1116 total): `activeDetailKeys` offers exactly the set's facts in
  label order and is empty for a detail-less kind; the detail filter is strict
  (indoor → the 5 arenas), ANDs to empty for mutually-exclusive facts, and never
  matches an absent fact. Existing filter tests updated to the new `details` field.
- Gate: `tsc` clean · 1116/1116 · `npm run build` clean · `npm audit` 0.

## Value, composed
The badges were informative; now they're navigational. Filter to free, sort
nearest, and tap "Indoor" — the P4.3 axes and the moat facts stack on one page.
As each future kind gets verified details, its filters appear automatically (the
UI is driven by `activeDetailKeys`, not hard-coded per kind).

## Deploy steps
Merge to `main`; Vercel auto-deploys. No schema (registry is code), no secret.

## Follow-ups
- **Beaches (45): lifeguarded** — still deferred (safety-sensitive + seasonally
  volatile; needs a re-verify cadence first). When it lands, a "Lifeguarded" filter
  appears here for free.
- **Map reacts to filters** — the map above is mount-once and shows all pins; making
  it reflect the active filter/sort is a separate, larger design (kept out of scope).

## Rollback
`git revert`. The `details` filter axis is additive; reverting removes the feature
chips and the `activeDetailKeys` selector, leaving the badges and the cost/season/
city/near-me filters intact.
