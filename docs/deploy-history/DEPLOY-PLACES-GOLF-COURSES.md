# Deploy — golf courses, a new Places kind (0 → 85, public metro-wide)

*August 2026. A brand-new Places kind, seeded exhaustively in one pass.
Registry-only.*

## What shipped

A new **`golf-course`** kind with **85 public courses** across the seven-county
metro — every municipal, county, and daily-fee course anyone can book a tee time
at. Private members-only clubs are excluded by design (same logic as private
YMCAs in the pools kind).

New wiring:
- `PlaceKind` gains `"golf-course"`; `KIND_META` and the `PLACES_KIND_INTRO`
  ([lib/editorial.ts](../../lib/editorial.ts)) entries added; a **`GOLF_SEASON`**
  const (April–October — frost out to frost in). The `kindsWithPlaces` exact-list
  test was updated to include the new kind.
- Every course: `cost: "paid"` (greens fees), clubhouse coordinates from its
  street address, and an official course/city/county source URL. **One entry per
  facility** — co-located par-3 "academy" nines (Braemar, Brookview, Baker
  National, etc.) are noted in the main entry, not double-pinned.

## Method

Five regional research agents (Mpls/St Paul munis, north, west, south, east)
swept official course and city/county pages in parallel — with explicit
no-delegation instructions, so results came back as clean JSON. I then
consolidated across regions, **deduped** (Theodore Wirth, Columbia, and
Meadowbrook each surfaced in two sweeps), and applied the honesty filters below.

## Honest exclusions (verified, not dropped silently)

- **Closed:** Elm Creek Golf Links (Plymouth — two agents disagreed on status; no
  official confirmation, so excluded), Mississippi Dunes (Cottage Grove, 2017),
  Afton Alps golf, Rich Acres (Richfield, airport expansion), Hollydale
  (Plymouth, now housing).
- **Private members-only:** TPC Twin Cities (host of the 3M Open), Interlachen,
  Town & Country, Brackett's Crossing, Mendakota, Southview, Hastings CC,
  Bent Creek, Dellwood, Indian Hills, Forest Hills, and others.
- **Out of the 7-county metro:** Riverwood National (Otsego, Wright County), and
  courses in Le Sueur / Wright proper.
- **Not real courses:** "Colby Lake" (a Woodbury city park), "Dakota Pines,"
  "Rice Lake" — none exist as courses; flagged and omitted.

## Coordinates

Clubhouse-level, geocoded from each course's official street address. Because a
golf course covers 100+ acres, a clubhouse pin that's off by a couple hundred
meters still lands squarely on the course — the coordinate-precision concern from
the beach pass doesn't apply here.

## A note on a handful of sources

Where a course had no clean official website, I used its **Explore Minnesota**
(state tourism) or GolfPass/Chronogolf listing as the source (all https,
authoritative-enough to attest the course exists): Pheasant Acres, Woodbury Par
3, Valley View, Sawmill, Arbor Pointe, Parkview, Country Air, Ridges at Sand
Creek, Rich Valley, Fountain Valley. Worth swapping to the course's own page on a
later verify pass if it turns up.

## Verification

Gate: `tsc` clean · **961** tests (drift guards validated all 85 — unique slugs,
https sources, metro bounding box, intro length, banned words, resolvable
neighborhood keys) · `npm run build` clean (golf-course now prerenders) · `npm
audit` 0. Dev render: `/places/golf-course` → "**85** across the Twin Cities
metro"; the **Golf Courses card shows on the `/places` index**.

## Deploy steps

Push to `main`. Registry + kind wiring only — no schema, no env, no deps. The
sitemap picks up `/places/golf-course` automatically (it lists every seeded kind).

## Verify checklist (production)

- [ ] `citypulsemn.com/places/golf-course` shows 85 and the clustered map.
- [ ] The Golf Courses card appears on `/places` and links through.
- [ ] Spot-check a few pins land on the right course; a few source links open.

## Rollback

`git revert`. Registry + kind wiring only; nothing else depends on the new kind.
