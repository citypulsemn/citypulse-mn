# Minneapolis Park Board import

The third primary source, after `docs/SPORTS-IMPORT.md` and
`docs/MUSIC-IMPORT.md`. Same machinery, run by `npm run import-venues`.

It exists because **`family` had 170 upcoming listings and 2 verified**, and the
Park Board publishes its whole programme through The Events Calendar's REST API,
open and unauthenticated.

## Run it

```bash
npm run import-venues -- --dry-run
npm run import-venues
```

Weekly, with the First Avenue source, in `.github/workflows/weekly-research.yml`.

## What it gave us

216 entries over a three-month window, of which **80 became listings**: movies in
the park (*Goonies*, *The Greatest Showman*, *In the Heights*), bandstand
concerts, Minnehaha and Lake Harriet park markets, nature-garden programmes,
Farview Park's back-to-school ice cream social.

**family: 170 → 240 upcoming, 2 → 73 verified.** Site-wide 34% → 38%.

## The thing this source has that no other does: a category

First Avenue publishes a genre taxonomy and tags nothing with it, so the music
importer files everything as `music` and eats a known error rate. The Park Board
actually tags its events, and those tags are a *primary-source category* — the
strongest signal available, from the people running the thing.

| Their tag | Ours |
|---|---|
| `Music in the Parks` | `music` |
| `Movies in the Parks` | `family` |
| `Events- MPRB` / `Events- Non-MPRB` | `family` |
| `Public Meetings` | **not listed** |
| `Environmental Volunteer Opportunities` | **not listed** |

So "Minneapolis Police Band" at the Minnehaha Bandstand files as music and
"Goonies" at Boom Island as family, without a keyword scorer guessing at either.

## Two deliberate exclusions

**`Public Meetings` (10).** Board meetings, budget hearings, "Open House for Lake
Nokomis Shoreline Improvements". Public and minuted, and not a thing to do on a
Saturday.

**`Environmental Volunteer Opportunities` (101).** This is the judgment call, and
it is reversible in one line — `mplsParksCategory` in `lib/music-sources.ts`.

They are real, free and public: Peace Garden Volunteering, Meadow Makers,
buckthorn mornings. But they are **recurring weekly shifts rather than events**,
and there are 101 of them in three months against a `family` category of 170.
Listing them would more than double the category with near-identical repeats and
read as padding — which the voice guide is explicit about. If you'd rather have
them, delete the `has("volunteer")` line.

## Venues register themselves

Hand-registering was right for eight sports teams and six First Avenue rooms. It
is wrong for forty-four parks: the Board publishes each venue's address and
coordinates, so typing them out would add forty-four chances to fumble a
coordinate and nothing else. `mplsParksVenuesFrom` builds the registry from the
feed.

Skipped rather than guessed at:

- a venue with **no coordinates** — this importer keeps Mapbox out of its path
- a "venue" that is **just a street address** (`4291 Queen Ave S, Minneapolis`),
  which names no place a reader can use

## Only the bandshell can prove a negative

Every derived park venue is **`authoritative: false`** — add-and-confirm only.

A public park is not a bookable room. The Board's calendar has no reason to know
about a permitted festival in Loring Park, and reading its silence as "nothing on
there" would hide one. The Lake Harriet Bandshell is the single exception: a
bookable stage the Board programmes exclusively, and a run against it produced
zero phantoms.

That exception is what let `resolve-conflicts` settle the ten wrong bandshell
bands — see `docs/deploy-history/DEPLOY-RESOLVE-CONFLICTS.md`.

## Things that bit

**Tribe 404s past the last page**, so the page count comes from the payload's
`total_pages`. A guess either 404s — which the all-or-nothing rule turns into
"source unavailable" — or silently truncates the calendar, and a truncated
calendar is the input that makes this importer hide real shows. Capped at 20
pages.

**Entity decoding was a hand-written list.** It had `&amp;`, `&#038;` and
`&#8217;`, and the Board promptly published "Early Birders &#8211; May-August" —
whose en-dash wasn't on it, and which would have reached readers verbatim.
Numeric and hex entities are now decoded as a class; an unknown *named* entity is
left visible rather than mangled.

**The script was called `import-music`** and was adding nature walks. Renamed to
`import-venues`.

## Known shape of what landed

**37 of the 80 are Eloise Butler Wildflower Garden** — Garden Storytime, Knitting
in Nature, Early Birders, Flower Hour, Brush with Nature. All real, free, public
programmes at a genuinely popular nature garden, but it does mean one venue now
supplies about 15% of the family category. Worth knowing before reading the
family page.
