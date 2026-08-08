# Deploy — Places: parks + playgrounds (two new kinds)

*August 2026. A comprehensiveness pass — two new evergreen, year-round kinds.
The registry jumps 57 → 75. Pure data curation; the code already supported both
kinds, so zero page/route changes.*

## What shipped

**Parks (new kind) — 13 curated "worth crossing town for" destinations**, each
verified against an official parks page on `verifiedAt` (2026-08-07):

- Minneapolis: Minnehaha Regional Park (the falls), Theodore Wirth (the biggest
  city park), Gold Medal Park (the Guthrie mound), Boom Island (riverfront).
- St. Paul: Como Regional Park (zoo + conservatory), Crosby Farm (river bluff).
- Regional/suburban: Lebanon Hills (Eagan, Dakota County), Hyland Lake Park
  Reserve (Bloomington), Elm Creek Park Reserve (Maple Grove), Silverwood (St.
  Anthony), Battle Creek (Maplewood), Bunker Hills (Coon Rapids), and the
  **Minnesota Landscape Arboretum** (Chaska) — the one **paid** park.

**Playgrounds (new kind) — 5 destination-tier play areas:**
- Chutes and Ladders / Hyland (Bloomington, award-winning) · Madison's Place
  (Woodbury, inclusive) · Wabun (Minneapolis' first inclusive) · Central Park
  (Maple Grove) · Hamlet Park (Cottage Grove). All free.

The registry is now **75 entries across 5 kinds** (21 beaches · 19 splash pads ·
17 pools · 13 parks · 5 playgrounds), plus the Venues cross-link.

## Zero code, and it enriches the neighborhood strips

As with every kind, this is registry rows only — the index grew Parks and
Playgrounds cards, the pages prerendered from the `[kind]` route, and the sitemap
picked up the URLs. **Bonus:** several parks land inside registry neighborhoods
(Minnehaha, Como, Downtown Minneapolis, Northeast, Highland Park), so the P2.2
"Places in {district}" strips get richer for free.

Only additions beyond the rows: `PLACES_KIND_INTRO` paragraphs for `park` and
`playground`.

## Verification (observed, not intended)

- **Live in dev (fresh server):** `/places` shows six cards — Beaches 21, Splash
  Pads 19, Pools 17, **Playgrounds 5, Parks 13**, Venues →. `/places/park` lists
  13 with the paid **Arboretum sorted last** (free-first holding), and five
  entries carry neighborhood links (Northeast, Como, Highland Park, Downtown
  Minneapolis, Minnehaha). No server errors.
- **Gate:** `tsc` clean · **936/936** (drift guards validated all 75 entries;
  caught + fixed an `http://` Gold Medal Park source — the guard requires https,
  and the site's official https page was confirmed to resolve) · `npm run build`
  clean · `npm audit` 0.

## Honesty notes

- **Sources** are official MPRB / St. Paul / county / Three Rivers / Anoka /
  city pages; Crosby Farm uses its Explore Minnesota (state tourism) profile.
- **Cost:** parks are free except the Arboretum (paid); Bunker Hills' intro
  flags its required vehicle permit. All playgrounds are free.
- **Season:** both kinds are `year-round`.
- **Coordinates** come from each place's real street address.
- **A few co-locations across kinds are intentional** — e.g., Madison's Place
  (playground) shares a Woodbury campus with the sports-center splash pad, and
  Chutes and Ladders sits inside Hyland Lake Park Reserve. They're distinct,
  separately-named destinations, so both earn a listing.

## Deploy steps

Push to `main`. Registry data + two editorial intros + two test bounds. No
schema, no env, no deps, no route changes.

## Verify checklist

- [ ] `/places` shows Parks (13) and Playgrounds (5) cards.
- [ ] `/places/park` and `/places/playground` render; the Arboretum is last
      (paid) on the parks list.
- [ ] Spot-check a few new `sourceUrl` links resolve to the park/playground.

## Rollback

`git revert`. Pure data + two intros + two test bounds.

## P2.1 status

Pools ✓, parks ✓, playgrounds ✓. The **rink + sledding winter pair** remains,
best seeded closer to the season (the season math's Dec–Feb wrap is already
proven). Farmers markets are a further optional kind.
