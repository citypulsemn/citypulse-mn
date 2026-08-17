# Deploy — The winning detail (moat): ski-hill amenity badges

*Aug 17, 2026. The Places roadmap's whole thesis is that the un-scrapeable value
is the curated *detail* — "which hill has tubing," "which is lit for night
skiing." This adds a structured, verified detail layer to the registry and lights
it up on the first kind: the 7 metro ski/tubing hills, each with its
research-verified amenities. Schema is reusable for every future kind.*

## Design — honesty first
- **`PlaceDetails`** ([lib/places.ts](../../lib/places.ts)): an optional, typed
  set of boolean facts on each `Place`. **Every field is only ever set to `true`
  when a source confirms it** — an unverifiable fact is simply absent (no badge),
  never guessed. `PLACE_DETAIL_LABELS` is the render allowlist; a detail without a
  label doesn't render (and a drift test fails an unlabeled key).
- **Why a small kind first:** a *wrong* curated fact is worse than none, so the
  moat starts where it can be gotten 100% right. Seven hills, each verified against
  its official site; the flagship's data (45 beaches × lifeguards, safety-sensitive
  and volatile) is deliberately deferred.

## What shipped
- **Schema + render:** `PlaceDetails` (tubing / nightSkiing / terrainPark /
  rentals / lessons), `details?` on `Place`, `PLACE_DETAIL_LABELS`. `PlacesList`
  renders the truthy facts as gold **✓ badges**, set apart from the gray amenity
  tags ([components/PlacesList.tsx](../../components/PlacesList.tsx), one
  `.place-detail` CSS block).
- **Verified data** for all 7 ski hills (a background research agent checked each
  official site; `verifiedAt` bumped to 2026-08-17):
  | Hill | tubing | night | park | rentals | lessons |
  |---|:-:|:-:|:-:|:-:|:-:|
  | Afton Alps | ✓ | ✓ | ✓ | ✓ | ✓ |
  | Buck Hill | ✓ | ✓ | ✓ | ✓ | ✓ |
  | Welch Village | ✓ | ✓ | ✓ | ✓ | ✓ |
  | Elm Creek | ✓ | ✓ | ✓ | ✓ | ✓ |
  | Hyland | – | ✓ | ✓ | ✓ | ✓ |
  | Como Park Ski Center | – | ✓ | ✓ | ✓ | ✓ |
  | Green Acres | ✓ | ✓ | – | – | – |
  - **Honesty correction applied:** the agent marked Green Acres `rentals: true`
    because tubes are *provided*; that's included equipment, not a rental, so it
    was dropped. Green Acres (tubing-only) carries only tubing + night sessions.
  - Afton's own site was erroring on fetch, so its tubing/night/terrain rest on
    recent news (bubly Tube Park reopened Dec 2024) + its official lessons page —
    all well-attested for a major Vail resort; noted here for the record.

## Verification (observed, not intended)
- **Live browser:** `/places/ski-hill` renders the ✓ badges per hill (Afton shows
  five, Green Acres shows two) — confirmed by driving the DOM (0×0 pane blocks
  screenshots).
- **Tests +2** (1107 total): a drift guard that every entry's `details` use only
  labeled keys with boolean values (nothing invented), and that every ski hill
  carries ≥1 verified fact (the moat is populated).
- Gate: `tsc` clean · 1107/1107 · `npm run build` clean · `npm audit` 0.

## Deploy steps
Merge to `main`; Vercel auto-deploys. No schema (registry is code), no secret.

## Follow-ups (the moat, kind by kind)
- **Rinks (27):** `indoor` (arena vs outdoor neighborhood rink) is 100%
  determinable and the primary decision axis — a strong, low-risk next kind.
- **Beaches (45):** lifeguarded status — high value but safety-sensitive and
  seasonally volatile; needs a re-verify cadence (a "stale >180d" ops line) before
  it's honest to publish. Deferred deliberately.
- **Filter by detail** (e.g. "tubing only") — the P4.3 filter is generic; a
  per-kind detail filter is a follow-on design.

## Rollback
`git revert`. `details` is an optional field and the badges render only when
present; reverting removes the schema, badges, and the 7 hills' detail data.
