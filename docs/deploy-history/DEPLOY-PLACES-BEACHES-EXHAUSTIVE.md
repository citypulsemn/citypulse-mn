# Deploy — beaches, metro-wide exhaustive sweep (21 → 45)

*August 2026. Second category of the exhaustive-coverage expansion (after splash
pads). Registry-only.*

## What shipped

The `beach` kind went from **21 → 45**. The existing 21 were the MPRB city lakes
(Nokomis, Harriet, Bde Maka Ska, Cedar, Hiawatha, Wirth) plus the big Three
Rivers regional beaches. This adds the **county and suburban lake beaches**:

- **Ramsey County (9):** Long Lake (New Brighton — the county's only lifeguarded
  beach), White Bear Lake, Tony Schmidt (Lake Johanna), Lake Josephine, Lake
  McCarrons, Lake Owasso, Turtle Lake, Snail Lake, Lake Gervais.
- **Anoka County (4):** Coon Lake (Columbus), Lake George (Oak Grove),
  Martin-Island-Linwood (Linwood Twp), Rice Creek Chain (Lino Lakes).
- **Dakota County (1):** Schulze Lake at Lebanon Hills (Eagan).
- **Carver / SW Hennepin (5):** Lake Ann + Greenwood Shores + Roundhouse
  (Chanhassen), Lake Minnewashta (Carver Co.), Lake Waconia (Carver Co.).
- **Washington County (5):** Square Lake (lifeguarded), Big Marine, Lake Elmo
  swim pond (paid, chlorinated), Point Douglas + St. Croix Bluffs (St. Croix
  River beaches).

Existence for each is from the **county's own official swimming-beach list**
(Ramsey, Anoka, Washington, Dakota, Carver) — the sourceUrl on every entry.

## Method + an honest process note

Source-driven, same as splash pads. This time the **research agents hit the
account's session usage limit mid-run** and were terminated, so I completed the
pass **directly in the main loop** with WebSearch/WebFetch against the official
county pages — slower but fully under control and verified.

**Coordinates — the honest limit.** The official beach pages list which beaches
exist but rarely publish street addresses. So:
- Where an official **street address** was available (the 4 Anoka parks, Schulze
  Lake, the Chanhassen/Waconia beaches), coordinates are placed from it.
- For the Ramsey County lakes and the Washington river beaches, coordinates are
  **beach-level from known lake geography** — the exact method the existing MPRB
  beaches used. They land on the right lake/park (roughly 100–300 m), not
  surveyed points. **A coordinate-refinement pass (with a geocoding token) is a
  good follow-up**, and the verify checklist below flags it.

## Deferred / excluded (reported, not dropped silently)

- **Carver Lake (Woodbury)** and **Shady Oak Beach (Minnetonka, paid)** —
  confirmed to exist, but I didn't have a confident official source URL to anchor
  them; next pass.
- **Anoka city beaches** (Moore Lake/Fridley, Centerville, Lakeside Commons
  beach/Blaine) — confirmed via aggregators, need an official address; next pass.
- **Lake Byllesby (Cannon Falls)** — Dakota County's second beach, excluded as
  edge-of-metro (Goodhue-side), consistent with the splash-pad call.
- **Como Lake (St. Paul), Lily Lake (Stillwater)** — swimming not permitted /
  closed. Excluded.

## Verification

Gate: `tsc` clean · **961** tests · `npm run build` clean · `npm audit` 0. Dev
render of `/places/beach`: count line "**45** across the Twin Cities metro", 45
rows.

**Test fix:** the `placesStaticMapUrl` "pin per beach" test capped its loop at
`PLACES_MAP_MAX_PINS` — beaches now exceed 30, and the static builder (unused
since the interactive clustered map shipped) caps pins at 30. This is the same
30-pin ceiling that motivated the interactive map; the separate cap test already
covers the behavior.

## Deploy steps

Push to `main`. Registry data only — no schema, no env, no deps. The sitemap
already lists `/places/beach`.

## Verify checklist (production)

- [ ] `citypulsemn.com/places/beach` shows 45 and the clustered map.
- [ ] Spot-check the **geography-derived** pins land on the right lake — Ramsey
      County (White Bear, Josephine, Owasso, Snail) and the St. Croix river
      beaches (Point Douglas, St. Croix Bluffs) most of all.
- [ ] A couple of county source links open the official beach page.

## Rollback

`git revert`. Registry-only.

## Next categories

Pools and rinks/sledding are the remaining bounded ones; parks and playgrounds
are the "truly every one, clustered" categories. Plus the deferred beaches above.
