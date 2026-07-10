# Collections

Roadmap 2.4. Collections are **curated, shareable views** — named filter combinations with their own SEO landing pages. They give the site linkable, indexable pages ("Free This Week", "Live Music", "Family Fun") that IG posts and emails can point to, and they turn repeated searches into editorial destinations. Curation is editorial only — never for sale (per the monetization philosophy).

## What ships

- **`/collections`** — an index of all curated collections, each card showing a live event count.
- **`/collections/[slug]`** — a landing page per collection: hero (title + tagline), events grouped by day (reusing `EventDayCard`), a branded 1200×630 OG image, full SEO metadata (title, description, canonical, OpenGraph/Twitter), and `ItemList` JSON-LD.
- A **Browse by collection** strip on the homepage, and all collections in the sitemap.

## How selection works

`lib/collections.ts` (pure, unit-tested):
- `COLLECTIONS` — the curated registry (slug, title, tagline, and any of: categories, prices, areas, query, window).
- `selectCollection(events, spec, now)` — applies, as AND: a time window, category, price (`lib/filters`), area (`lib/areas`), and text query (`lib/search`), then sorts chronologically. It reuses the exact same predicates the on-site filters use, so a collection and the equivalent hand-set filters return the same events.
- `collectionWindow(kind, now)` — `weekend` (coming Fri–Sun), `week` (7d), `month` (30d), or `all`.

## The current set

this-weekend · free-this-week · live-music · family-fun · date-night · arts-and-culture · festivals-and-markets · only-in-minnesota.

## Adding or editing a collection

Add an entry to `COLLECTIONS` in `lib/collections.ts` — that's it. The landing page, OG image, index card, sitemap entry, and homepage strip all derive from the registry. `generateStaticParams` pre-renders every collection at build.

## Notes

- Pages revalidate every 5 minutes, so newly published events appear automatically.
- Collections are the on-ramp to future personalization (a "For You" view is just a per-user collection) and a natural anchor for sponsorship ("this collection presented by …") down the line.
