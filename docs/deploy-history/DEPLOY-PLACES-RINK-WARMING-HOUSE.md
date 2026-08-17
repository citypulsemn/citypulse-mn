# Deploy — Winning detail: rink "Warming house" badge

*Aug 17, 2026. Second rink fact. A background research agent verified warming-house
availability for all 22 outdoor rinks against their official city pages; every one
was confirmed. Now each outdoor rink shows a ✓ Warming house badge (the 5 indoor
arenas keep their Indoor badge instead).*

## The finding: universal — and why it still ships as a badge
The agent checked all 22 outdoor rinks and **every one has a warming house**
(none false, none unknown). So it doesn't differentiate *between* the outdoor
rinks — but it's still a genuine, verified amenity a parent cares about ("is
there somewhere warm to lace up and thaw out?"), and paired with the Indoor badge
it gives **every rink a clear type label**: 5 Indoor arenas, 22 outdoor rinks each
with a warming house. That the amenity is universal here is itself a useful
signal — these are all staffed, sheltered city rinks, not random frozen ponds.

## What shipped
- **`warmingHouse?: boolean`** on `PlaceDetails` + "Warming house" label; renders as
  the same gold ✓ badge ([lib/places.ts](../../lib/places.ts)).
- **`details: { warmingHouse: true }`** on all 22 outdoor rinks, `verifiedAt` bumped
  to 2026-08-17. Source strength varies and is honest about it:
  - **Strong** (official page names a Warming Room/House): the 6 St. Paul rec-center
    rinks, Edina Centennial Lakes, Maple Grove (Phenow Pavilion), South St. Paul
    (rink table), Bloomington (2026 briefing: "Every rink has a warming house").
  - **MPRB rinks** rely on the central ice-rinks page's system-wide warming-room
    hours + each park page's "Ice rink and warming room information" link.
  - **3 event/regional facilities** confirmed via authoritative secondary sources
    because their base city page under-describes it: **WinterSkate** (Rice Park —
    the stpaul.gov facility page doesn't mention WinterSkate at all; a dedicated
    warming house is documented in news coverage), **John Rose Oval** (CVB), **ROC**
    (its own page — warming house in the lower level). These are the softest of the
    22 and worth a re-check at the next verify pass.

## Verification (observed, not intended)
- **Live browser:** `/places/rink` shows 22 ✓ Warming house badges + 5 Indoor
  badges across the 27 rows (driven via the DOM; 0×0 pane blocks screenshots).
- **Tests +2** (1111 total): exactly 22 rinks carry the warming-house fact, and it
  **never lands on an enclosed indoor arena** (a warming house is an outdoor-rink
  amenity) — the honesty guard. Plus the existing `details` drift guard.
- Gate: `tsc` clean · 1111/1111 · `npm run build` clean · `npm audit` 0.

## Deploy steps
Merge to `main`; Vercel auto-deploys. No schema (registry is code), no secret.

## Note on presentation
Because the fact came back universal among outdoor rinks, an alternative to 22
identical badges is a single page-level line ("every outdoor rink here has a
warming house"). Shipped as badges to match the requested per-rink treatment and
to give every row a type label; trivial to switch to the page-note form later if
it reads as repetitive.

## Follow-ups
- **Beaches (45): lifeguarded** — still deferred (safety-sensitive + seasonally
  volatile; needs a re-verify cadence first).
- **Filter by detail** ("indoor only" / "has warming house") — extends the generic
  P4.3 filter to the new facts.

## Rollback
`git revert`. `warmingHouse` is an optional field; reverting removes it and the 22
badges, leaving Indoor + the ski details intact.
