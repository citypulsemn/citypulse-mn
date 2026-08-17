# Deploy — Per-place detail pages (`/places/[kind]/[slug]`)

*Aug 17, 2026. The biggest remaining SEO lever: a dedicated, indexable URL for each
of the ~500 places, each with a self-contained schema.org object (instead of one
nested in the kind page's ItemList). Every kind-page and discover-list row now links
to its place's own page — real internal-link equity, and a landing page a search for
"Chaska Community Center Pool" can actually match.*

## What shipped
- **Route:** `app/places/[kind]/[slug]/page.tsx` — statically prerendered for every
  place (`generateStaticParams` over `kindsWithPlaces` × `placesByKind`). Safe to
  prerender (registry is code, not a DB — ENGINEERING rule 2).
- **Pure helpers** ([lib/places.ts](../../lib/places.ts)): `placeForKindSlug(kind,
  slug)` returns the place only when the slug belongs to that kind — so
  `/places/rink/<a-pool-slug>` **404s** instead of rendering a mismatched page.
- **Standalone JSON-LD** ([lib/seo/places-jsonld.ts](../../lib/seo/places-jsonld.ts)):
  `placeDetailJsonLd` = `placeJsonLd` + `@context` + the house-voice intro as
  `description`. Each page gets a self-contained, indexable structured-data object
  (with `amenityFeature` from the verified details), rendered through the shared
  `jsonLdSafe` (R0.6 escape).
- **The page:** kind breadcrumb → `/places/[kind]`, name H1, cost + address + city +
  neighborhood + Directions, a single-pin static map (`staticMapUrl`, the same helper
  the event/venue pages use), the verified detail badges, gray tags, the **official
  source link** (honesty anchor), a subscribe band, and the related-kinds mesh.
- **Internal links:** `PlacesList` now links each place name to
  `/places/[kind]/[slug]` — so every kind page and the cross-kind finder feed the
  detail pages. (The map-popup `#slug` deep-link to the list row still works.)
- **Sitemap:** [app/sitemap.ts](../../app/sitemap.ts) now lists every per-place URL
  (plus `/places/discover`, which was also missing). Per-place `lastmod` is the
  place's own `verifiedAt` — honest freshness for stable registry content, not the
  daily-rolling `today` the event-derived surfaces use. **Without this the detail
  pages would sit undiscovered, exactly the "unknown to Google" trap from Aug 16.**
- **Metadata:** title `"{name} — {kind} in {city} | City Pulse MN"`, description = the
  place's unique house-voice intro, canonical `/places/[kind]/[slug]`, OG/Twitter.

## Verification (observed, not intended)
- **Live browser:**
  - `/places/pool/chaska-community-center-pool`: title "Chaska Community Center Pool
    — Pool in Chaska"; JSON-LD `@context: schema.org`, `@type: SportsActivityLocation`,
    `amenityFeature: [Indoor, Water slide, Zero-depth entry]`, `description` = the
    intro; badges + official source link render; page loads 200 (all resources).
  - `/places/pool` list: all 25 names link to `/places/pool/<slug>`.
  - `/places/rink/chaska-community-center-pool` → **404** (wrong-kind guard). *(This
    intentional 404 is the only "error" in the console — the guard doing its job, not
    a page fault.)*
  - Static map image is null locally (no `NEXT_PUBLIC_MAPBOX_TOKEN`); renders in prod.
- **Tests +5** (1187 total): `placeForKindSlug` (right kind resolves, wrong kind →
  null, every place resolves under its own kind); `placeDetailJsonLd` stands alone
  with `@context` + description + amenity features and survives the R0.6 breakout
  guard; the page/list wire-in tripwires.
- Gate: `tsc` clean · 1187/1187 · `npm run build` clean (prerendered ~500 pages) ·
  `npm audit` 0.

## Deploy steps
Merge to `main`; Vercel auto-deploys. No schema, no secret. After deploy, drop one
place URL into Google's Rich Results Test to confirm the standalone Place object
parses. **Still gated on indexation** — like the kind-page structured data, these
pay off once Google crawls them (Taren's Request-Indexing). But per-place URLs are
exactly the granular, unique pages that indexation likes.

## Follow-ups
- Optionally point the map-popup "See details" link at the detail page instead of
  the `#slug` row anchor now that a full page exists.
- Once indexed, the per-place pages are the granular URLs a long-tail search
  ("splash pad with a playground in Bloomington") can match — worth watching in GSC.

## Rollback
`git revert`. The route, `placeForKindSlug`, `placeDetailJsonLd`, and the name link
are additive; reverting removes the detail pages and reverts the names to plain text.
