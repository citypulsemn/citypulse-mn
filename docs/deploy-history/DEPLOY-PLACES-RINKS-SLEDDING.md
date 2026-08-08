# Deploy — Places: ice rinks + sledding hills (the winter pair)

*August 2026. Completes P2.1's four kinds. Seeded off-season on purpose — the
season math handles the winter wrap, so they show honestly as "closed for the
season" now and light up when the snow flies. Registry 75 → 84.*

## What shipped

**Ice rinks (new kind) — 4:**
- John Rose Minnesota Oval (Roseville — world's largest outdoor refrigerated
  rink, paid) · Centennial Lakes skating (Edina — quarter-mile of canals, free)
  · Groveland Ice Rinks (St. Paul, free) · Parade Ice Garden (Minneapolis, indoor
  **year-round**, paid).

**Sledding hills (new kind) — 5, all free:**
- Theodore Wirth · Columbia Park (one of the steepest) · Powderhorn (the Art Sled
  Rally hill) — Minneapolis · Battle Creek (Maplewood) · Como Park (St. Paul).

The registry is now **84 entries across 7 kinds** (21 beaches · 19 splash pads ·
17 pools · 13 parks · 5 playgrounds · 4 rinks · 5 sledding), plus Venues. Only
`farmers-market` remains unseeded.

## The season model earns its keep

Both kinds run `WINTER` — a `December–February` window where `openMonth (12) >
closeMonth (2)`, so `openNow` **wraps the new year**: closed all summer, open in
winter. This is exactly what the model was built for at P1.1, now used for real:

- **`/places/sledding` shows the banner** "Closed for the season — these reopen
  around December" today, because every sledding hill is winter-only.
- The `/places` index card reads "**Sledding Hills · 5 spots · seasonal, closed
  now**".
- **Ice Rinks stay "open"** on the index because Parade Ice Garden is indoor,
  `year-round` — so the kind isn't wholly off-season. Honest either way.

Zero page/route code again — the index cards, pages, sitemap, and banners all
updated from the registry rows. Added: one `WINTER` season constant and
`PLACES_KIND_INTRO` for `rink` and `sledding`.

## What I left out (honest scoping)

- **Wells Fargo WinterSkate** — it relocated (Landmark Plaza → CHS Field) and
  moves; no stable location to pin.
- **The Depot rink** — a listing flags it closed; skipped rather than list a dead
  rink.
- **Hyland Hills** — it's a paid downhill ski/tubing area, not a free
  bring-your-own-sled hill, so it doesn't belong under `sledding`.

## Verification (observed, not intended)

- **Live in dev (fresh server):** `/places` shows eight cards including Ice Rinks
  (4) and Sledding Hills (5 · seasonal, closed now). `/places/sledding` → 5 rows
  with the closed-season banner. No server errors.
- **Tests +4 (939/939):** every sledding hill reads closed in July, open in
  January (the wrap); the sledding page banners off-season and is clear in
  winter; rinks mix winter-outdoor and year-round-indoor (Parade open in July,
  the Oval closed). Drift guards validated all 84 entries.
- **Gate:** `tsc` clean · 939/939 · `npm run build` clean · `npm audit` 0.

## Honesty notes

- **Sources** are official city/county/park pages (Roseville, Edina, St. Paul,
  Ramsey County, MPRB — including MPRB's winter-activities sledding page for the
  Minneapolis hills).
- **Season is month-level and weather-dependent** — "December–February" is the
  honest core; exact open dates live on each `sourceUrl`.
- **A couple of intentional co-locations across kinds** — the Battle Creek and
  Como sledding hills sit in parks that are also `park` entries (different
  amenity, different season); each earns its own listing.

## Deploy steps

Push to `main`. Registry data + one season constant + two editorial intros + two
test bounds. No schema, no env, no deps, no route changes.

## Verify checklist

- [ ] `/places` shows Ice Rinks and Sledding Hills cards; Sledding reads
      "closed now".
- [ ] `/places/sledding` shows the closed-for-season banner (until December).
- [ ] Come winter, both pages show open with the map pins.

## Rollback

`git revert`. Pure data + a season constant + two intros + two test bounds.

## Places kinds — status

beach · splash-pad · pool · park · playground · rink · sledding all seeded (84
entries). Only **farmers-market** is left in the model unseeded — a natural next
kind whenever you want it. P2.1 (the "four more kinds") is complete.
