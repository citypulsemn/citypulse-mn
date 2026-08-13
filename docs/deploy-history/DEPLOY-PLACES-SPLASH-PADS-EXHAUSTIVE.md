# Deploy — splash pads, metro-wide exhaustive sweep (19 → 49)

*August 2026. First category of the exhaustive-coverage expansion (owner's call:
"find every instance of every place"). Splash pads are naturally bounded, so
they're the right category to make genuinely complete. Registry-only; the
interactive map (shipped just before) is what makes 49 pins usable.*

## What shipped

The `splash-pad` kind went from **19 → 49** verified entries — a source-driven
sweep of all seven metro counties. Minneapolis (5, all MPRB) and St. Paul (4,
all city) are now **confirmed complete** against the park board's and the city's
own splash-pad lists; the other 40 are municipal, county, and Three Rivers
features across the suburbs, each with an official `sourceUrl`.

## Method — source-driven, not search-driven

Enumerated from **authoritative lists** (MPRB, St. Paul Parks, each suburb's
Parks & Rec, and the Anoka/Dakota/Ramsey/Washington/Carver county + Three Rivers
park districts), fanned out as parallel research agents by region, then
**consolidated, deduped against the existing 19, and verified** — every entry
carries the official page it was checked against. Minneapolis was also
cross-checked by hand (MPRB names exactly five splash pads; we had all five).

**Honest exclusions** (the "reported with reasons" rule), each checked and left
out on purpose:
- **Spraygrounds inside paid aquatic centers** (Apple Valley Splash Valley,
  Chaska CC, Edina Lil' Lagoon, New Hope) — those are the *pool* category, not
  free-standing splash pads.
- **Playground misters** (French Regional, Golden Valley Brookview) — not a pad.
- **Bunker Beach** (Coon Rapids) — already a `pool` entry; it's a paid waterpark.
- **Out-of-metro** (Lake Byllesby / Cannon Falls — Goodhue County, and currently
  closed for repairs).
- **Not-yet-built / event-only** (Roseville Rosebrook 2027, Oakdale pop-ups,
  Victoria pop-up, Osseo/Hugo proposals) and dozens of suburbs with **no** splash
  pad (Minnetonka, Edina, Plymouth, Brooklyn Center, Savage, Prior Lake,
  Maplewood, White Bear Lake, Stillwater, …) — all confirmed absent, not guessed.

## Honest limits

- **Coordinates are park-level**, geocoded from each entry's official street
  address (accurate to the park, roughly 100–200 m — not surveyed points for the
  exact pad). Same standard as the existing 19. `placesToGeoJSON` still drops any
  non-finite coord rather than dropping a pin at 0,0.
- **A few deliberately-broad includes** (Taren wants exhaustive): Wayzata's
  Panoway plaza jets, Shoreview Commons' destination-playground sprays, Brooklyn
  Park's Zanewood (best official source is the city's Summer Splash event page),
  and the "Mini-Mississippi" water-play area. Each is a real, free, public
  interactive water feature; the intros say what each actually is.
- **Jordan (Lagoon Park)** — the official `jordanmn.gov/lagoon-park` page is a
  client-rendered SPA that 404s to bots but resolves in a real browser; it's the
  canonical page and passes the https drift guard.
- **Not yet swept:** St. Anthony Village (a Central Park splash pad surfaced but
  wasn't researched) — a candidate for the next pass.

## Verification

Gate: `tsc` clean · **961** tests (the places drift guards validated all 30 new
entries — unique slugs, https sources, `verifiedAt`, intro length 20–300, no
banned words, metro bounding box) · `npm run build` clean · `npm audit` 0.
Dev render of `/places/splash-pad`: count line "**49** across the Twin Cities
metro", 49 list rows, 49 unique `#slug` anchors. The interactive map renders in
production (token is prod-only) — and 49 > the old static map's 30-pin cap, which
is exactly why the clustered map shipped first.

## Deploy steps

Push to `main`. Registry data only — no schema, no env, no new deps. Statically
generated; the sitemap already lists `/places/splash-pad`.

## Verify checklist (production)

- [ ] `citypulsemn.com/places/splash-pad` shows 49 and the clustered map.
- [ ] Spot-check 3–4 new pins land on the right park (e.g. Ramsey Waterfront,
      Cottage Grove Highlands, Crystal Becker).
- [ ] A couple of source links open the official page.

## Rollback

`git revert`. Registry-only; reverting restores the 19-entry list.

## Next categories (same method)

Pools, beaches, rinks, sledding are the other bounded ones; parks and playgrounds
are the "truly every one, clustered/zoom-gated" categories per the owner's call.
Each is its own session: enumerate from official lists → dedupe → verify → write.
