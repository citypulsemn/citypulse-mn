# Deploy — Winning detail (moat): disc-golf course facts

*Aug 17, 2026. Badges what a disc golfer picks a course on: a full 18+ holes, a
wooded/technical layout, and whether it's beginner-friendly. Cost is already
filterable (16 of 24 are free), so "free" was not badged. Reuses the detail layer;
no new UI.*

## What it badges
`full18Holes` (a full 18+ hole course vs a short 9) · `wooded` (heavily-treed /
technical) · `beginnerFriendly` (explicitly good for new players) — new fields on
`PlaceDetails` ([lib/places.ts](../../lib/places.ts)).

## How it was verified (honesty first)
One research agent checked all 24 against official park pages, using UDisc/PDGA as
an authoritative source for the objective hole count, `yes → badge`,
`unknown → no badge`:
- **`full18Holes` 12/24** — hole count is the primary decision. The audit caught two
  mistagged courses: **Hansen was tagged 18-hole but is a 12-hole course**, and
  Brockway's "10-hole" tag is officially 9 — neither gets a full-18 badge.
- **`wooded` 4/24** — only where a source describes it as wooded/technical woods
  (Savanna Dunes, Red Oak, Garlough, Silver View). "Tree-lined" or "mature oaks"
  alone did not qualify.
- **`beginnerFriendly` 2/24** — only the two explicitly beginner-labeled courses
  (Theodore Wirth's beginner tees, Hansen "ideal for families, kids"). Not inferred
  from "9-hole".
- **9 carry no badge** — short open 9-hole courses with no distinctive verified
  feature. Honest emptiness (they still list; they just don't over-claim).

## Verification (observed, not intended)
- **Live browser** (`/places/disc-golf`, DOM-driven): badges 18+ holes 12 · Wooded
  4 · Beginner-friendly 2; three filter chips; 18+ holes filter → 12 of 24. Console
  clean.
- **Tests +4** (1162 total): count locks; a verified short course never claims
  full-18 (Hansen 12-hole, Riverfront 13-hole); a plain open 9-holer carries no
  badge; keys guard.
- Gate: `tsc` clean · 1162/1162 · `npm run build` clean · `npm audit` 0.

## A dev-environment note (not a code issue)
While verifying, the dev server threw two `.next` cache 500s — once from stale HMR
vendor chunks, once because a full `npm run build` ran while `next dev` was live
(they share `.next`). Both were cleared by wiping `.next` and restarting dev; the
production build passed clean throughout. **Lesson: don't run `npm run build` with
the dev server running.**

## Deploy steps
Merge to `main`; Vercel auto-deploys. No schema (registry is code), no secret.

## Rollback
`git revert`. All three fields are optional and disc-golf-only; reverting removes
the badges + filters cleanly.
