# Deploy — Places: outdoor neighborhood rinks (Ice Rinks 11 → 27)

*Roadmap v6 Tier 1.2 (compounding Places SEO — the winter kinds). Aug 14, 2026.*

## What shipped

Expanded the existing **`rink`** kind from 11 to **27 entries** by adding **16
free, city-flooded outdoor neighborhood rinks with warming houses** — the
bread-and-butter of a Twin Cities winter that the kind was missing. The registry
already had the destination outdoor rinks (John Rose Oval, Centennial Lakes, Maple
Grove loop, ROC), the downtown skate (Wells Fargo WinterSkate), and the indoor
arenas (Parade, Braemar, Bloomington, TRIA, Schwan Super Rink); this fills the gap
with the neighborhood park rinks people actually walk to.

- **16 new entries**, all `cost: "free"`, all `season: WINTER` (Dec–Feb, cold
  permitting), each with a warming house:
  - **Minneapolis (9, MPRB):** Logan Park, Bryant Square, Van Cleve, Matthews,
    Powderhorn, Webber, Linden Hills, North Commons, Longfellow.
  - **St. Paul (5, stpaul.gov):** Phalen Rec, Langford Park, North Dale Rec,
    Edgcumbe Rec, Palace Rec.
  - **South-metro suburbs (2):** Lorraine Park (South St. Paul), Brookside Park
    (Bloomington).
- **Geographic spread:** every quadrant of Minneapolis (NE/N/SW/S), the St. Paul
  East Side / North End / West End / St. Anthony Park / Highland edge, plus two
  suburbs. No overlap with the 11 existing rinks.

## Design decisions

- **All free, all `WINTER`.** These are city-flooded park rinks — free, seasonal,
  weather-dependent. `WINTER` (Dec–Feb, `openMonth 12 → closeMonth 2`, wraps the
  new year) reads them closed all summer, which is honest. The 16 free entries sort
  **above** the paid indoor arenas (free-first is the registry's rule and half the
  point of the kind).
- **No scaffolding change.** The kind, its `KIND_META` blurb ("Outdoor and indoor
  rinks, warming houses, and open skate"), and the editorial intro ("**Free
  neighborhood rinks**, the world's biggest refrigerated oval…") already anticipated
  neighborhood rinks — so this is a pure data addition. No meta/intro/test-list edit
  needed (the kind was already in the `kindsWithPlaces` drift-guard list).
- **`neighborhood: null` on all 16.** Consistent with the registry's handling of
  specific spots; the city name carries the location. (Neighborhood-key linking for
  the 9 Minneapolis rinks is a possible future enrichment — see follow-ups.)
- **Honest sourcing.** Every entry verified against its official page — the
  Minneapolis Park Board park page, the stpaul.gov facility page, or the city rinks
  page. Season operation confirmed by the 2025–26 closing dates (MPRB closed Feb 15,
  2026; St. Paul ~Feb 13, 2026) — proof each rink ran this past season. The
  verification confirms each rink **exists and is city-operated**, not a live
  ice-condition read (these are weather-dependent). Candidates that were *not* on
  this season's official lists (e.g. Bottineau, Kenwood, several St. Paul rinks the
  city dropped for 2025–26) were **excluded** rather than guessed.

## Files

- `lib/places.ts` — 16 new `rink` entries inserted after Schwan Super Rink (the
  end of the rink block), under a section comment. One fix during the gate: South
  St. Paul's source was `http://`; the drift guard requires `https://`, verified
  the site serves https (200), corrected.
- **No other files.** Route, index, OG, `generateStaticParams`, and sitemap all
  derive from the registry.

## Verification (observed)

- `npx tsc --noEmit` — clean.
- `npm test` — **1010 passed**; `places.test.ts` 43/43. The https drift guard
  correctly **failed first** on the `http://` South St. Paul URL, then passed after
  the fix — the guard doing its job. Slug-uniqueness, metro bounding box, banned
  words, `verifiedAt` format all green across all 16.
- `npm run build` — clean, 40/40 static pages.
- `npm audit` — **0 vulnerabilities**.
- **Live smoke** (`/places/rink`, fresh dev server): 200, title "Ice Rinks in the
  Twin Cities, Mapped," h1 "Ice Rinks," "**27** across the Twin Cities metro," a
  27-item numbered list, all 16 new rinks present, **free-first sort confirmed**
  (free rinks alphabetical, paid arenas last), FREE/OUTDOOR/WARMING HOUSE tags
  rendering (spot-checked Logan Park), canonical
  `https://www.citypulsemn.com/places/rink`, all network 200.
  - *Seasonal note:* in August the 16 `WINTER` rinks are out of season but still
    listed (the page persists year-round for SEO). The page-level "closed for the
    season" banner intentionally does **not** fire for the rink kind because the
    indoor arenas are `YEAR_ROUND` and keep the kind "open" — pre-existing behavior
    for this mixed indoor/outdoor kind, unchanged here. Seasonal honesty is carried
    by the intro copy ("Most outdoor ice runs December through February").

## Deploy steps

1. Merge to `main` — Vercel auto-deploys. **No schema, no env change.**
2. Confirm live: `https://www.citypulsemn.com/places/rink` shows 27 entries; the
   sitemap already lists `/places/rink` (no new URL — same kind), so no Index-line
   delta this time.

## Rollback

Pure additive data. Revert this commit to drop the 16 entries; the page falls back
to the prior 11. No migration.

## Follow-ups (not this item)

- **Verified-and-addable St. Paul rinks** on the 2025–26 list, ready for a future
  pass: Battle Creek (75 Winthrop St S), Desnoyer Park (525 Pelham Blvd).
- **More MPRB neighborhood rinks** confirmed on the 2025–26 list (address pull
  needed per park): Bohanon, Lynnhurst, Lake Hiawatha, Pearl, Armatage, McRae,
  Kenny, Lyndale Farmstead, Shingle Creek — plus 8 more Bloomington rinks.
- **Neighborhood-key linking** for the 9 Minneapolis rinks would enrich the P2.2
  "Places in {neighborhood}" strips.
- Next winter kinds in Tier 1.2 order: expand **ski/tubing** (the 4 ski areas) →
  **trampoline/climbing gyms** (a new kind).
