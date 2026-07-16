# City landing pages

Roadmap 6.2 — the other SEO axis. 5.5 built the neighborhood layer inside the two core cities; this builds the city layer for the whole metro: `/cities/st-paul`, `/cities/bloomington` — the "things to do in {city}" searches.

## Derived from the area machinery

`lib/cities.ts` derives pages from `CITY_AREA` (lib/areas.ts) the way venue pages derive from the sweep registry — without touching it. Matching goes through the **same `normalizeCity` the area filter uses**, so "Saint Paul", "St. Paul", and "st paul, MN" all land on one page: one normalization, everywhere. Display names come from `displayCityName` ("st louis park" → "St. Louis Park").

## The thin-content rule

~110 metro cities are mapped; most are quiet most weeks. **All slugs render** (stable URLs, honest empty states — `/cities/edina` never 404s into oblivion), but the **index and the sitemap only surface cities with upcoming events**. A hundred empty pages is spam, not SEO. The sitemap's filter is upcoming-or-still-running, matching the index exactly.

## Cross-linking both directions

- City pages for Minneapolis / St. Paul list their districts with upcoming events ("By neighborhood: Uptown · Northeast · …") — the 5.5 honesty rule applies.
- Neighborhood pages link **up**: the eyebrow city name goes to its city page.
- Footer gains Cities; unmapped cities (Duluth) 404.

On-demand ISR per the recorded rule; `/cities` index prerenders (one query). Golden-tested: 21 cases covering name canonicalization, the variant family, unknown cities, and slug round-trips for all ~110 pages.
