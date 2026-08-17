# Deploy — Winning detail (moat): museum family-decision facts

*Aug 17, 2026. Badges the museum decisions cost doesn't answer: is it hands-on for
kids, is there a café, does it have a planetarium. Reuses the detail layer (café
shared with indoor playgrounds); no new UI.*

## What it badges
`handsOn` (interactive / hands-on exhibits) · `cafe` (on-site café, reused) ·
`planetarium` (a planetarium or dome/Omnitheater) — new fields on `PlaceDetails`
([lib/places.ts](../../lib/places.ts)). "Free" was deliberately NOT badged — cost
is already a filter, and 3 of 20 are free.

## How it was verified (honesty first)
One research agent checked all 20 against their official sites (fallback search on
403s), `yes → badge`, `unknown → no badge`:
- **`handsOn` 12/20** — the science/kids museums (Science Museum, Children's, Bakken,
  Bell's Touch & See), the "get hands-on" labs (Mill City, History Center), the
  interactive model railroad, and the living-history sites where visitors take part
  (Fort Snelling, Gibbs Farm, The Landing, riding/driving at the Transportation
  Museum). Look-only art galleries correctly get none.
- **`cafe` 5/20** — Mia, Walker, History Center (Café Minnesota), Mill City (Bushel
  and Peck), American Swedish Institute (FIKA).
- **`planetarium` 2/20** — exactly the two dome-theater science museums: Science
  Museum (Omnitheater) and Bell (MacMillan Planetarium). Sparse but precisely the
  ones a visitor seeking that would want.
- **5 carry no badge** — Weisman, Museum of Russian Art, MN Museum of American Art
  (look-only galleries), James J. Hill House (mansion tour), Hennepin History
  (page unreachable). Honest emptiness, not an omission.

## Verification (observed, not intended)
- **Live browser** (`/places/museum`, DOM-driven): badges Hands-on 12 · Café 5 ·
  Planetarium 2; three filter chips; Hands-on filter → 12 of 20. Console clean.
- **Tests +4** (1158 total): count locks; planetarium is exactly the two dome
  museums; the look-only galleries carry no badge; keys guard.
- Gate: `tsc` clean · 1158/1158 · `npm run build` clean · `npm audit` 0.

## Deploy steps
Merge to `main`; Vercel auto-deploys. No schema (registry is code), no secret.

## Rollback
`git revert`. `handsOn`/`planetarium` are optional; `cafe` is shared with indoor
playgrounds — this revert leaves that kind's café badges intact.
