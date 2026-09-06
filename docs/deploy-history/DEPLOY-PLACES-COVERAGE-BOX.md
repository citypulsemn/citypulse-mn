# Deploy — making "exhaustive" measurable, and the first kind swept (6 Sep 2026)

## The ask

Bolster every Places kind and be exhaustive with each, across a stated area:
Delano/Rockford west, Stillwater east, Blaine/Coon Rapids north, Apple
Valley/Burnsville south — "don't be too restrictive".

## What shipped

Three instruments and one kind swept. The instruments matter more than the eight
rows, because "exhaustive" across 19 kinds and 56 cities is not a single
sitting — it is a repeatable process, and this is that process.

### 1. `METRO_BOX` — the area, written down

`lat 44.6..45.3, lng -93.95..-92.65`, padded outward from the corner cities
rather than drawn tight around them, which is what puts Forest Lake, Lakeville,
Monticello and Hudson inside without arguing them one at a time.

It is a **coverage target, not a filter**: nothing already listed is dropped for
sitting outside it (9 places do), and a notable spot past the edge is still worth
carrying.

### 2. `npm run places-coverage [-- --gaps]`

Turns the registry into per-kind counts inside the box, and — with `--gaps` —
the major cities that have **none** of a kind. That is the worklist.

The starting picture, 522 places, 513 in box:

| kind | in box | cities | kind | in box | cities |
|---|---|---|---|---|---|
| golf-course | 81 | 51 | rink | 27 | **9** |
| farmers-market | 72 | 54 | pool | 25 | 19 |
| dog-park | 58 | 37 | disc-golf | 24 | 22 |
| splash-pad | 49 | 36 | park | 21 | 12 |
| beach | 43 | 25 | museum | 20 | **5** |
| | | | trampoline | 17 | 14 |
| | | | playground | 15 | 14 |
| | | | indoor-playground | 13 | 11 |
| | | | nature-center | 12 | 12 |
| | | | sledding | **11** | **6** |
| | | | garden | 9 | 5 |
| | | | ski-hill | 6 | 6 |

The two that stand out are **ice rinks (27 across 9 cities)** and **sledding
hills (11 across 6)**. Every one of the 47 cities missing a rink has at least one,
and every city in Minnesota has a sledding hill. Those are the biggest real gaps.

### 3. `npm run places-candidates <kind>` and `npm run research-places <kind>`

Two different jobs:

- **candidates** asks OpenStreetMap for *every* feature of a kind in the box and
  subtracts what we have, matching by **proximity, not name** — "Bryant Lake
  Regional Park DGC" and "Bryant Lake Disc Golf" are one course. It buys the one
  thing search cannot: a defensible claim that we looked at everything in the box.
- **research-places** hands an agent the box, the gap cities and everything on
  file, and asks for what is missing — each lead carrying a page that names it.

**Neither writes to the registry.** `research-places` emits a draft file for a
human. That is deliberate and it earned its keep immediately (below).

## Disc golf: 24 → 32

Thirteen sourced leads came back. **Eight are listed; five were held.**

Every one of the eight was opened by hand against the operator's own page before
being listed, and the source confirmed the specifics each time — nine holes at
Tamarack, Prodigy T2 baskets and 5,000 feet at Bassett Creek, 21 holes dropping
to 18 in winter at Wintercrest, 12 holes at Alimagnet.

**One was rejected outright.** The agent proposed Moir Park (Bloomington) as a
9-hole course "established in 1979" and cited Bloomington's own park page. That
page lists the park's amenities and **disc golf is not among them**. The source
did not support the claim — the exact failure this week was spent fixing, caught
here by the check rather than by a reader.

Four more were held for want of a reachable source: Coon Rapids DGC and Kenwood
Trails cite PDGA pages that 403, and Lakewood Hills and Arcola Heights could not
be confirmed on the operator's own site. They are real leads. They are not
entries.

Coordinates came from Nominatim; two (Zachary, Arcola) matched OpenStreetMap
independently to within 25 metres, which is a useful cross-check on the method.

## Why this is not "all 19 kinds, done"

Because sourcing is the bottleneck and it does not compress. PDGA blocks
automated fetches, several city sites 403, and — as Moir Park shows — an agent's
citation cannot be taken on trust. At roughly one verified row per source check,
the remaining kinds are hundreds of checks. That is several sessions of work, and
pretending otherwise would just produce rows with dates nobody earned.

What is now in place is the machinery to do it kind by kind, and a number to
measure it against.

## Suggested order for the next passes

1. **Ice rinks** — biggest real gap, and city parks pages are the source.
2. **Sledding hills** — same shape, and OSM barely covers them, so the agent path
   matters more here.
3. **Pools / aquatic centers** — every city has one.
4. **Nature centers, gardens, museums** — smaller, and mostly institution sites
   that serve cleanly.

## Verify

```bash
npm run places-coverage -- --gaps
```

Disc golf should read 32 across 29 cities. Then load `/places/disc-golf` and
check one of the new eight — `/places/disc-golf/acorn-park-disc-golf-course`.

## Rollback

The eight entries are a contiguous block in `lib/places.ts` under the header
"DISC GOLF, coverage-box sweep (Sep 2026)"; deleting it and restoring `24` in the
`places.test.ts` count guard reverts them. `METRO_BOX` and the three scripts are
additive and inert if unused.

## Quality gate

`npx tsc --noEmit` clean · **1941/1941** tests · `npm run build` exit 0 ·
`npm audit` 0 vulnerabilities · eight source pages opened by hand, one lead
rejected on the evidence, coordinates cross-checked against a second provider.
