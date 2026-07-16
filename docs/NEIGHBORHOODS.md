# Neighborhoods

Roadmap 5.5. The area layer answers "Minneapolis or the west metro?" — locals think finer than that inside the core cities. This layer adds Uptown, Northeast, Lowertown, and the rest.

## Derived from coordinates, not addresses

Every event is already geocoded, so neighborhoods resolve by **nearest centroid within a per-neighborhood radius** (`lib/neighborhoods.ts`, pure). Computed at the read path like the 4.7 title hygiene: **no schema change, no backfill**, and the registry is tunable without touching data — adjust a centroid, redeploy, every event re-resolves.

- 16 well-known districts (10 Minneapolis, 6 St. Paul), deliberately coarse — defensible assignments beat granular wrong ones.
- **Suburban events resolve to null.** Their city name (Maplewood, Shakopee) already says where they are; a fake neighborhood would add nothing.
- Nearest-first resolves adjacent districts correctly (Target Field → North Loop, not Downtown), and the radius check keeps Como from claiming Maplewood.

## The golden set

Every centroid is validated against real venues at their real coordinates — 18 named cases a local would sign off on: First Avenue → Downtown, the Walker → Loring Park, Icehouse → Whittier & Eat Street, the Turf Club → Midway, CHS Field → Downtown St. Paul & Lowertown, Como Zoo → Como. Tune a centroid and these tests are the guardrail.

## Surfaces

- **`/neighborhoods`** — grid grouped by city, each card with a blurb and upcoming count. Only neighborhoods with upcoming events appear (an empty district card is a broken promise).
- **`/neighborhoods/[slug]`** — upcoming events in the district, soonest first, multi-day aware. Static params + 5-minute revalidate; SEO-titled "Things to Do in {Neighborhood}" for the evergreen queries Phase 6 builds on.
- **Event detail** — a tappable neighborhood chip next to the venue.
- Footer link in the standard row.

`EventRecord.neighborhood` (key, nullable) is available everywhere for future consumers — filters, digest sections, venue pages.
