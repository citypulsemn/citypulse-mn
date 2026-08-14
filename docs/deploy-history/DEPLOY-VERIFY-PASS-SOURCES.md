# Deploy — Places source verify pass (retro backlog)

*August 2026. Data-quality. Data-only (lib/places.ts).*

## What shipped

Knocked out the Places data-quality verify backlog from `docs/RETRO-AUG-2026.md` §2:
swapped aggregator/tourism sources for the venue's own official page wherever one
exists, and re-verified the entries in passing.

**12 entries upgraded to official sources:**
- **Golf ×8** (was ExploreMinnesota / GolfPass) → the course's own site:
  Arbor Pointe, Rich Valley, Fountain Valley, Parkview (Eagan), Ridges at Sand
  Creek, Pheasant Acres, Valley View (Belle Plaine → vvgolf.com), Woodbury Par 3
  (→ eaglevalleygc.com, Woodbury's city golf facility).
- **Park/pool ×2** (was ExploreMinnesota) → Crosby Farm Regional Park →
  `stpaul.gov`; Bunker Beach Water Park → `anokacountyparks.com`.
- **Farmers markets ×2** with official pages → Victoria (`victoriamn.gov`),
  Linden Hills (Neighborhood Roots, the operator).

**Data-integrity win:** two courses that aggregators flagged "closed" — **Valley
View (Belle Plaine)** and **Country Air (Lake Elmo)** — were verified **still
open** (par-71 tee times / 2026 reviews). Stale "closed" flags; nothing wrongly
removed. (Same lesson as Red Oak disc golf earlier — don't trust an aggregator's
"closed" without a second source.)

**Left as-is by design (honest floor — no official site exists):**
- **Country Air Golf Park** — small pitch-and-putt, no official website → stays on
  its ExploreMinnesota listing.
- **~7 small farmers markets** (Camden, Hugo, Carver, Jordan, Uptown, Markets on
  Main) — no own site; a small market's directory listing (NFMD), the MDA's MN
  Grown directory, or the market's own Facebook page *is* its official presence.
- **Beach / geography-derived coordinates** — refinement still deferred until a
  geocoding token is in `.env.local`.

You can't cite an official page that doesn't exist; these are the best-available
authoritative source for each.

## Verification

Gate: `tsc` clean · **1003** tests (Places drift guards validate every new
`sourceUrl` — all `https`, well-formed) · `npm run build` clean · `npm audit` 0.

Remaining non-official source counts after the pass: golfpass 0, ExploreMN 1
(Country Air), NFMD 2, swcrier 1, Facebook 1, Meet Minneapolis 2 — all places
without an official web page.

## Deploy steps

Push to `main`. Data-only, no schema, no env.

## Rollback

`git revert`. Source-URL text changes only.
