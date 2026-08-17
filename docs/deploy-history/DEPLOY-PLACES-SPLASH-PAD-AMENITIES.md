# Deploy — Winning detail (moat), kind 4: splash-pad amenities

*Aug 17, 2026. Extends the verified-detail layer to the 49-pad splash-pad set —
the two facts a parent actually decides on: is there a **playground** at the same
park (a combo trip), and are there **restrooms** on site. Reuses `PlaceDetails` +
the badges + the per-kind filters + the reactive map; all four come along for free.*

## Design — what to badge, and what NOT to
The pads already carried loose hand-assigned gray tags (adjacent-playground 33,
restrooms 20, shade 10). Two honesty calls up front:
- **Shade is deliberately NOT a verified badge.** It's subjective and almost never
  stated on an official page — promoting it to a gold ✓ would assert a fact no
  source confirms. It stays a gray amenity tag.
- **The gray tags were NOT trusted as truth.** The gold badge means *source-
  verified*, so each pad was re-checked against its official park page; only
  source-confirmed facts became badges. This also **audited** the old tags.

## How it was verified
Three background research agents split the 49 pads and checked each against its
official city/park page (with one fallback search where a page 403'd or was thin),
returning `yes` only on explicit confirmation and `unknown` otherwise. Verdicts
folded in strictly: `yes → badge`, `unknown → no badge` (honest emptiness).
- **Playground on site: 43 / 49** confirmed (6 unknown — e.g. Nicollet Commons, a
  downtown plaza with no playground; Wayzata Panoway; Phalen beach pad).
- **Restrooms: 38 / 49** confirmed (11 unknown — several St. Paul pad pages are
  silent on restrooms; left unbadged rather than assumed).
- **2 pads get no badge at all** — **Cologne City Square** and **Ramsey
  Waterfront** — neither fact was confirmable. They render with no detail badges,
  which is the correct honest state, not an omission.
- Secondary sources (used where the official page 403'd/was thin) are noted in the
  research record; portable/seasonal restrooms count as restrooms but were flagged.

## The tag audit (a real find) — and its resolution
Two pads carried a hand `restrooms` tag the pad's cited page does **not** confirm:
**Conway Park** and **Boulevard Plaza**. At ship time their gold restrooms badge was
left absent while the gray tag remained (the two-layer split working). A follow-up
re-check (next commit) resolved both, and it split two ways — which is exactly why
a re-verify beats a blind delete:
- **Boulevard Plaza → promoted.** The `/1485/` marketing page we'd cited omits
  restrooms, but the official Coon Rapids **facilities** page explicitly lists
  "Restrooms". So it earned a real badge (`restrooms: true`) and its `sourceUrl` was
  repointed to the page that documents it. Verified restrooms count 38 → **39**.
- **Conway Park → dropped.** The stpaul.gov page stays silent and a rec-center
  listing indicates no restrooms at the site; the unbacked gray `restrooms` tag was
  removed. No badge, no tag — honest.

## What shipped
- **Schema:** `adjacentPlayground?` + `restrooms?` on `PlaceDetails`; labels
  "Playground on site" / "Restrooms" ([lib/places.ts](../../lib/places.ts)).
- **Data:** `details` on 47 of 49 pads (43 playground, 38 restrooms, 34 both),
  `verifiedAt` bumped to 2026-08-17 on those. The 2 unconfirmable pads unchanged.
- **Free carry-through:** the badges render via the existing `PlacesList`; the
  per-kind filter chips (`activeDetailKeys`) and the reactive map pick the new facts
  up automatically — no splash-pad-specific UI code.

## Verification (observed, not intended)
- **Live browser** (`/places/splash-pad`, driven via the DOM): badges render
  **Playground on site ×43, Restrooms ×38**; feature chips = **Playground on site,
  Restrooms**; "Playground on site" → **43 of 49**, + "Restrooms" (AND) → **34 of
  49**; console clean.
- **Tests +5** (1127 total): locks the verified counts (49 pads / 43 / 38), guards
  that splash-pad details use ONLY the two family keys, that the 2 unconfirmable
  pads carry no details, and that the audited gray tags never leak into a gold badge.
- Gate: `tsc` clean · 1127/1127 · `npm run build` clean · `npm audit` 0.

## Deploy steps
Merge to `main`; Vercel auto-deploys. No schema (registry is code), no secret.

## Follow-ups
- ~~Re-verify or drop the Conway / Boulevard Plaza gray `restrooms` tags.~~
  **Done** (see resolution above): Boulevard promoted to a badge, Conway dropped.
- **Beaches (45): lifeguarded** — still deferred (safety-sensitive + seasonally
  volatile; needs a re-verify cadence first).
- Other family kinds (playgrounds, parks) could get restrooms similarly if demand
  warrants — same method.

## Rollback
`git revert`. The two fields are optional; reverting removes them and the splash-pad
badges/filters, leaving the ski / rink details intact.
