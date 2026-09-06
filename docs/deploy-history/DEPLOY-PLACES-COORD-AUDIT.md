# Deploy — 74 place pins moved to where their own addresses actually are (6 Sep 2026)

## Result

Every place in the registry was re-geocoded from the street address we ourselves
publish, using two independent providers. **74 pins were wrong and are now
fixed** — the worst by 10.5km, twenty-four of them by more than 2km. Nothing was
deleted, no addresses changed, and no place was added or removed.

Two new drift guards make this class of error fail the test suite instead of
reaching the map, and both of them caught real rows the audit itself had missed.

- `npx tsc --noEmit` clean · `npm test` 1957 passing · `npm run build` clean ·
  `npm audit` 0 vulnerabilities

## Why this happened at all

Arneson Acres, found on 5 Sep, was 2.7km from its own street address. The
coordinate came from a research agent and **nothing caught it**: it was in the
right city, inside the coverage box, and passed the registry's lat/lng guard,
which only catches a transposed or garbage pair — not a plausible-but-wrong one.
It surfaced because a second row happened to share the address and geocoded
elsewhere. That was luck, and luck is not a check.

The 74 rows here share one tell: **the number was round.** 44.87, 45.16, 44.682.
Three decimals is ~110m of precision — not something anyone copied off a map.
It is an agent estimating from a city name and moving on.

## The method, and why it took three passes

**Pass 1 — one geocoder.** Nominatim alone produced 119 disagreements, and most
were the geocoder's own failures. It put 2540 Nicollet Ave S five miles south of
itself and **Sweetland Orchard in Missouri.** Acting on that list would have
moved correct pins to wrong places. A list that is mostly noise does not get
read, and that is how a real error hides.

**Pass 2 — corroboration.** A second provider on different source data (US
Census TIGER) turned the question into a decidable one:

| verdict | meaning | count |
|---|---|---|
| agreed | at least one provider landed on us — acquitted | 180 |
| **confirmed** | both say we are wrong, and agree where | **72** |
| providers-disagree | both say wrong, but point different ways | 12 |
| one-provider | only one answered, and it disagrees | 237 |
| no-answer | neither resolved the address | 66 |

One provider disagreeing is a *question*; two agreeing with each other and
against us is a *finding*. This is the same shape as `lib/report-check.ts`, where
`unclear` never recommends removal.

**Pass 3 — a genuinely independent third opinion.** OSM imported TIGER road
geometry years ago, so for *interpolated* street addresses the two providers may
share an ancestor and be wrong together. So each confirmed row was also checked
against the **mapped feature by name** — a surveyed POI, not an interpolation.
38 of the 72 got that third confirmation. **In not one case did the mapped
feature back our stored coordinate.**

## What was changed, and what was deliberately not

**71 rows** took the two-geocoder consensus for their published address.

**3 rows were judged individually and did not:**

- `french-regional-park-beach` — **left alone.** Both geocoders put
  "12605 Rockford Rd" a kilometre north of the mapped park itself, which is
  street interpolation, not the beach. Our value sits on Medicine Lake's shore,
  where a beach belongs.
- `french-regional-sledding-hill` — snapped to the mapped park. Its stored value
  was ~1.5km southwest of the park boundary, i.e. not in the park at all.
- `nicollet-commons-splash-pad` — took the mapped park, not the consensus, which
  had interpolated a kilometre down Civic Center Pkwy.

**3 more rows** were found by the new guards, not the audit, and corrected from
fresh two-provider lookups: `highland-park-aquatic-center` and
`highland-park-sledding-hill` (both carrying one pin ~3km from either building),
and `como-regional-park-pool`.

**Left as found, on purpose:**

- `arboretum-applehouse` (7485 Rolling Acres Rd) — Nominatim disagrees by 4.4km,
  but Census has no match for the address and OSM has no AppleHouse feature.
  One provider is not a finding, and there is nothing to correct it *to*. It is
  grandfathered by name in the precision guard so the exception stays visible.
- `como-park-ski-center` — the two providers disagree with each other by 2.1km.
  No consensus to act on.
- The 12 `providers-disagree` and 237 `one-provider` rows. The audit names them
  every time it runs; none is corroborated.

## A decision that needs your eye: the coverage box moved north

`METRO_BOX.maxLat` went from **45.3 → 45.4**.

Two rows — Pinehaven Farm (Wyoming, 45.356) and Coon Lake County Park Beach
(Columbus, 45.326) — had been sitting inside the old edge *only because their
coordinates were wrong*. Correcting the pins pushed them out.

The box exists to catch a place invented in Duluth, not to hold a pin at a false
latitude, so I moved the edge rather than the fact. Both places are real, are
human-verified, and are the kind of drive Twin Cities families make in October.
**If you would rather the northern edge stay at Blaine + 15km, the fix is to drop
those two rows, not to restore the coordinates** — say the word and I will.

## The two new guards (`lib/__tests__/places.test.ts`)

1. **"coordinates are precise enough to have been read rather than guessed"** —
   rejects a pin written with fewer than 4 decimals. It reads the *source text*,
   not the parsed value, because `lat: 44.9520` is a real four-decimal
   coordinate whose number stringifies as `44.952`. It also asserts its own
   reach: if the scan ever stops finding rows, the guard fails rather than
   silently passing.
2. **"no two places at different addresses share a coordinate"** — Phalen
   Regional Park and the China Friendship Garden both carried `44.978,-93.056`.
   A shared pin across distinct addresses means one was copied, not looked up.
   It compares house number and zip, not prose, so two amenities in one park
   ("Theodore Wirth Pkwy" / "…Pkwy N") are still allowed to share a pin.

## Files

- `lib/coord-audit.ts` — new. The verdict logic, pure and golden-tested.
- `lib/__tests__/coord-audit.test.ts` — new, 14 tests, including that a single
  provider can never produce `confirmed`.
- `scripts/places-coord-audit.ts` — the audit. **Writes nothing, ever.**
- `lib/places.ts` — 74 coordinate lines; `METRO_BOX.maxLat`.
- `lib/__tests__/places.test.ts` — the two guards above.

## Deploy

Nothing to configure. No schema change, no new env var, no DB write.

```bash
git push origin main
```

Vercel redeploys on push. The places pages are ISR — pins update when each page
next regenerates.

## Verify

1. `/places/orchard` → Ferguson's Minnesota Harvest sits southwest of Jordan on
   the ridge, not in town. This one moved 10.5km.
2. `/places` map → Bloomington cluster: The Works Museum and Kids Empire are on
   France/Grand at 98th–106th, not up at 44.85.
3. `/places/nature-center` → Wargo and Belwin are on their own driveways.
4. Any place page → the static map pin and the address in the sidebar agree.
5. `npm test` → the two new guards pass; deliberately round one coordinate in
   `lib/places.ts` and confirm the precision guard fails.

## Rollback

Coordinates only — nothing structural.

```bash
git revert <sha>
```

Reverting restores the old pins *and* the old `METRO_BOX.maxLat`, which is
consistent: the two northern rows go back inside the old edge exactly because
their coordinates go back to being wrong.

## Re-running the audit

```bash
npx tsx scripts/places-coord-audit.ts --cache=coord-cache.json
```

Nominatim allows one request a second, so a full pass is ~10 minutes; the cache
makes a re-run fast. Add `--kind=orchard` for one kind, `--threshold=` to tighten
or loosen the 500m bar. **It never writes to the registry.** A confirmed finding
is still a question for a human — for a big park, the entrance and the centroid
are both honest answers.

## What is left in this seam

- 237 rows where only one provider answered. A third source with real address
  coverage (Mapbox — the token already exists in Vercel as
  `MAPBOX_GEOCODING_TOKEN`, and `lib/geocode.ts` already speaks it) would
  promote most of those to a verdict. It is not available locally, so this pass
  could not use it.
- 66 rows whose address neither provider resolved, mostly park names without a
  street number. Those cannot be checked this way at all.
