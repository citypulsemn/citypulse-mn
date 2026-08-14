# Deploy — G1.2: Disc Golf, a new Places kind (17 courses)

*August 2026. Tier 1 (audience / SEO). Code + data only, no schema.*
*(Shipped in two commits: the initial 10, then an expansion pass to 17.)*

## What shipped

A new `/places/disc-golf` page — **17 verified public disc golf courses across the
metro** — another evergreen, indexable Places URL for the G1.2 SEO push.

## Expansion pass (+7, verified vs official city pages)

Oakwood (Cottage Grove, free 18h) · Red Oak (Burnsville, free 20h — Yelp listed it
"closed" but the city page confirms it active) · Kenneth Rosland (Edina, free) ·
Garlough (West St. Paul, free 9h) · Brockway (Rosemount, free 10h) · Kaposia Park
(South St. Paul, 26 baskets, pass) · North Valley (Inver Grove Heights, 18h,
seasonal pass). The St. Paul/Ramsey sweep surfaced only regular golf — no honest
disc-golf additions there beyond Highland.

- **New `PlaceKind` "disc-golf"** in [lib/places.ts](../../lib/places.ts): union +
  `KIND_META` + 10 `Place` rows + editorial intro. Zero page/route code again —
  `/places` grew a Disc Golf card, `/places/disc-golf` prerendered from the
  `[kind]` route, sitemap auto-included. All `YEAR_ROUND` (courses don't close;
  peak is spring–fall, noted in the intro).

### Coverage (10) — each verified against an official park-agency/city page
- **Minneapolis (MPRB):** Wabun (9h, free) · Theodore Wirth (18h, fee)
- **St. Paul:** Highland Park (18h, free)
- **Anoka County:** Savanna Dunes @ Bunker Hills (18h, permit) · Riverfront 13 (13h, permit)
- **Blaine:** Lochness Park (9h, free)
- **Eagan:** Northview Park (9h, free)
- **Three Rivers:** Elm Creek · Hyland Hills · Bryant Lake (all 18h, pass)

4 free / 6 permit-or-pass — the free courses lead the free-first sort.

## Honest scope — this is an INITIAL set, not exhaustive

The metro has 40+ public disc golf courses. This ships the ones I could verify
against an official source in this pass; the page and blurb do **not** claim "every
one." **Deferred** for the next pass (surfaced but not yet address/coord/source-
verified): Kaposia Park (South St. Paul), Oakwood Park (Cottage Grove), Brockway
(Rosemount), Garlough Park (West St. Paul), North Valley Park (Inver Grove Heights),
Red Oak Park (Burnsville), Rosland Park (Edina), Lions Park (Shakopee), Staring
Lake / Bandimere / Riley Lake (Eden Prairie city courses — the city .gov page 403s
the fetcher), and more. Same source-driven method applies.

### Process note
The five regional research agents hit the account **session limit** mid-run (one,
Three Rivers, completed; four failed — reset 12:40am Central). Per the standing
lesson, I finished the research in the **main loop** via official-page WebFetch
(MPRB, St. Paul, Anoka County, Blaine, Eagan disc-golf pages) rather than
re-spawning agents. That's why this is a solid first batch rather than the full 40.

## Verification

Gate: `tsc` clean · **1002** tests · `npm run build` clean (`/places/disc-golf`
statically generated) · `npm audit` 0. Places drift guards pass for all 10 rows
(unique slugs, `https` official sources, intro length + banned-word check, metro
bounding box); `kindsWithPlaces` exact-list test updated to include `disc-golf`.

**Browser-verified (dev):** `/places/disc-golf` renders "10 across the Twin Cities
metro", the intro, free-first ordering with FREE/PAID badges and 9/18 HOLE +
BEGINNER FRIENDLY tags, and per-row official-source links; `/places` shows the
Disc Golf card ("10 spots →"). No console errors.

## Deploy steps

Push to `main`. Code + data only, no schema, no env. Sitemap gains
`/places/disc-golf` automatically.

## Rollback

`git revert`. Pure registry addition; reverting removes the kind and its page.
