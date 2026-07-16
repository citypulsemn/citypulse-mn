# Venue pages

Roadmap 6.1 — the first Growth-phase surface. `/venues/first-avenue`: every upcoming show at a room, its address, a map, and Place JSON-LD. People search "first avenue schedule," not "events aggregator" — these pages are where that search should land.

## A page layer over the 4.2 registry

`lib/venue-pages.ts` derives the public surface from the pipeline's venue registry **without touching it** (lib/venues.ts stays pure sweep config). Registry-first means stable URLs, curated names, and no junk slugs from one-off listings — the ~40 rooms people actually search for, not every string that ever appeared in a venue field.

- **Slugs** derive from names (`palace-theatre`), with curated overrides where names are awkward (`first-avenue`, not `first-avenue-7th-st-entry`).
- **Matching** free-text event venue strings uses normalized forms + an alias table: "First Ave", "7th St Entry", "The Dakota", "Como Zoo", "Xcel" all find their rooms. Unknown venues stay unmatched — no page claims them. Golden-tested with 15 realistic strings.
- **Coordinates and address derive from the venue's own events** — the MOST COMMON value, not the mean, so one bad geocode is outvoted instead of dragging the pin into the river. Past events count: history knows where the building is even in a quiet week.

## The page

Header (name, address, neighborhood chip via 5.5, directions link) · Mapbox **Static Images** map (a plain `<img>` — zero JS on an SEO page; gracefully absent without token/coords) · upcoming events soonest-first, multi-day aware · Place JSON-LD with geo + postal address · `"{Name} — Schedule & Upcoming Events"` metadata with canonical.

**On-demand ISR, no generateStaticParams** — the recorded rule from the 5.5 build incident. `/venues` index prerenders (one query, like the homepage); the 42 slug pages render on first visit, cached 5 minutes.

## Reach

Index groups active venues by city with counts; quiet venues follow as a compact link list, so all 42 pages stay reachable and crawlable year-round. Venue names on event detail pages link to their venue page. Footer link added. Sitemap now carries all venue URLs — and the neighborhood URLs 5.5 should have added (omission caught and fixed here).
