# Deploy — Winning detail (moat), kind 8: nature-center draws

*Aug 17, 2026. Adds the facts that differentiate one nature center from another —
after recon showed the obvious ones don't. Reuses the whole detail layer; no
nature-center-specific UI.*

## Recon shaped the choice
All 12 nature centers are **free** and all 12 have **trails** — so "Free admission"
and "Trails" would be redundant (free is already shown) and universal (zero
differentiation). Dropped both. The three that actually distinguish a visit:
- **`liveAnimals`** — live raptors / critter room / farm animals / bison (strictly
  *live* animals visitors can view, not taxidermy or "wildlife on the trails").
- **`indoorExhibits`** — an indoor interpretive center with public nature exhibits
  (weather-proof; a building that's offices/rentals only does not count).
- **`naturePlayArea`** — a dedicated kids' natural playscape.

New fields on `PlaceDetails` ([lib/places.ts](../../lib/places.ts)).

## How it was verified (honesty first)
One research agent checked all 12 against their official sites (fallback search on
403'd pages), `yes → badge`, `unknown → no badge`:
- **`liveAnimals` came back universal (12/12)** — every Twin Cities nature center
  reliably has live animals. Low-differentiation, but a genuine, verified draw that
  answers a real question ("will my kid see animals?" → yes) and, like the rink
  warming houses, the universality is itself a useful signal. Kept as a badge.
- **`indoorExhibits` 10/12** — the differentiator. **Dodge** (its site explicitly
  says it has no public indoor visitor center) and **Belwin** (a bison-prairie
  conservancy with no exhibit building) correctly get no badge.
- **`naturePlayArea` 8/12** — the four without a confirmed play area (Dodge,
  Westwood, Carpenter, Belwin) get none.
- Every center carries ≥1 badge (no honest-empties).

## Verification (observed, not intended)
- **Live browser** (`/places/nature-center`, DOM-driven): badges Live animals 12 ·
  Indoor exhibits 10 · Nature play area 8; three filter chips; Indoor-exhibits
  filter → 10 of 12. Console clean.
- **Tests +4** (1146 total): count locks; the trail outliers (Dodge, Belwin) carry
  no indoor-exhibits badge; filter order; keys guard.
- Gate: `tsc` clean · 1146/1146 · `npm run build` clean · `npm audit` 0.

## Note on the universal badge
`liveAnimals` on all 12 is low-signal on its own (same situation as rink warming
houses). It's honest and answers a real question, but if the row of identical
badges reads as noise, the leaner alternative is a one-line page note ("every
nature center here has live animals") — a trivial later swap. Shipped as a badge to
give each row a consistent draw label and to power the filter alongside the other
two.

## Deploy steps
Merge to `main`; Vercel auto-deploys. No schema (registry is code), no secret.

## Rollback
`git revert`. All three fields are optional; reverting removes the nature-center
badges + filters, leaving the other kinds' details intact.
