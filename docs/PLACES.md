# Places

The evergreen half of the site: static maps and lists of the metro's go-to
spots — beaches, splash pads, and (as the registry grows) pools, parks, rinks,
sledding hills. City Pulse answers "what's happening?"; Places answers "where
can we go?" — the question families ask on a hot Saturday with nothing on the
calendar. Roadmap: `docs/ROADMAP-PLACES.md` (build plan) · `docs/ROADMAP-v6.md` Tier 1.2 (priority).

## Why it's built the way it is

- **Evergreen SEO.** A splash-pad page ranks and *keeps* ranking; events churn.
- **Zero pipeline risk.** Static registry data — no weekly research, no
  verification churn, no agent cost.
- **Registry in code, not a DB table** (`lib/places.ts`) — the proven
  venues/neighborhoods pattern: testable with drift guards, versioned in git,
  editable in any session, and **renders with zero queries** (ENGINEERING rule 2
  satisfied by construction — which is *why* the pages can be statically
  generated; see below). Graduate to a DB table only past ~300 entries or when
  public submissions open (P4).

## Data model (`lib/places.ts`)

A `Place` carries: `slug` (unique), `name`, `kind`, `lat`/`lng`, `address`,
`city`, `neighborhood` (a `NEIGHBORHOODS` key or `null`), `season`, `cost`
(`free` · `paid` · `donation`), `tags` (flat amenity strings), `intro` (house
voice), **`sourceUrl`** (the authoritative parks-board/city page — required, the
honesty anchor), `verifiedAt`, and `venueSlug` (for the `music-venue` kind →
links the existing venue page instead of duplicating it).

**Kinds:** `beach` · `splash-pad` · `pool` · `playground` · `park` · `rink` ·
`sledding` · `music-venue` · `farmers-market`. `KIND_META` holds each kind's
label/plural/blurb.

**Season is machine-readable.** `PlaceSeason` is a discriminated union:
`{ type: "year-round" }` or `{ type: "seasonal", openMonth, closeMonth, label }`.
The month numbers (1–12, inclusive) drive `openNow`; the `label` ("Memorial
Day–Labor Day") is what the page shows — month-level honesty, exact yearly dates
stay on `sourceUrl`. A season where `openMonth > closeMonth` **wraps the new
year** (a Dec–Feb rink), which `openNow` handles — winter kinds need no special
casing.

## Selectors (all pure, all tested)

- `placesByKind(kind)` — free-first, then alphabetical.
- `placesByNeighborhood(key)` — the bridge to neighborhood pages.
- `placeBySlug(slug)`.
- `kindsWithPlaces(now)` — kinds with ≥1 entry, each with count + open state
  (drives the index; honest emptiness — an unseeded kind never appears).
- `openNow(place, date)` — Chicago-frame season check (rule 10).
- `placesStaticMapUrl(places, token)` — the numbered-pin map URL (below).
- `placesSeasonBanner(places, now)` — the closed-season banner text, or null.

## Pages

- **`/places`** (`app/places/page.tsx`) — index: a card per kind with count and
  season state.
- **`/places/[kind]`** (`app/places/[kind]/page.tsx`) — the indexable unit:
  query-tuned title, an editorial header paragraph (`PLACES_KIND_INTRO` in
  `lib/editorial.ts`, Taren-editable, falls back to `KIND_META.blurb`), a
  numbered static map, the numbered list, a closed-season banner up top when
  nothing's open, canonical + sitemap entry. Unknown/unseeded kinds `notFound()`.

Both are **statically generated** (`generateStaticParams` on the kind page) with
`revalidate = 3600`. This is safe — and correct for evergreen SEO — precisely
because places read the in-code registry with zero DB queries; rule 2 forbids
DB-backed build prerenders, which these are not.

### Which places pages revalidate, and which never do

These two keep an hourly TTL because they genuinely read the clock:
`kindsWithPlaces` sets an `open` flag per kind, and `placesSeasonBanner` puts a
"Closed for the season" line on a kind page.

**The 519 detail pages and `/places/discover` set `revalidate = false`** — they
never expire, and the detail route also sets `dynamicParams = false` so an
unknown slug is a static 404 rather than a function invocation. Nothing in their
server output depends on the date; the "open this season" filter is client-side,
evaluated against the reader's own clock in `PlacesDiscover` / `PlacesBrowser`.

They previously carried `revalidate = 3600` with a comment about keeping a season
note fresh — a note that does not exist on those pages. The result was 519 pages
re-rendering hourly for byte-identical output, which was a measurable share of
the Fluid Active CPU overage on 26 Aug 2026 (`docs/deploy-history/DEPLOY-PLACES-STATIC.md`).

`lib/__tests__/places-static.test.ts` guards all of it, **including that the
open-now filter stays client-side** — if it ever moves to the server, these
frozen pages would claim a splash pad is open after it closed for the season.

Individual places do NOT get their own pages (thin content — see
`docs/INDEXING.md`); a place earns a detail page only with real depth (P4.1).

## The map

`PlacesMap` renders one server-side static `<img>` (zero JS, phone-first — an
interactive map is P4.2, gated on a vitals check). `placesStaticMapUrl` builds a
Mapbox Static Images URL with **numbered** gold pins (1..N) that match the
numbered list, auto-fit to the pins — distinct from `event-view`'s single-pin
`staticMapUrl`. Capped at `PLACES_MAP_MAX_PINS` (30) for Mapbox's URL-length
limit; a kind bigger than that paginates by area (a later refinement). Needs
`NEXT_PUBLIC_MAPBOX_TOKEN` — absent in local dev, so the map renders in
production only (the list stands on its own regardless).

Social cards (`app/places/opengraph-image.tsx`,
`app/places/[kind]/opengraph-image.tsx`) use the shared `OgCard` shell.

## Adding to the registry

- **A new entry:** append to `PLACES` with a real `sourceUrl` and today's
  `verifiedAt`. The drift guards (`lib/__tests__/places.test.ts`) enforce: unique
  slug, resolvable neighborhood key + venueSlug, https sourceUrl, real date,
  house-voice intro length, banned-word check, coordinates inside the metro
  bounding box, valid cost. Never invent a fact — trace every field to the source.
- **A new kind:** add it to `PlaceKind` + `KIND_META`, seed entries, and
  (optionally) a `PLACES_KIND_INTRO`. The index and kind pages pick it up
  automatically once it has entries; add it to the winter/summer season as
  appropriate.

## Status

P1.1 (registry + verified seed: 6 beaches + 6 splash pads) and P1.2 (index +
kind pages) shipped; P1.3 wired Places into the shared nav + footer and added OG
cards. Next: P2 (more kinds, neighborhood cross-linking, the venue bridge).
Deploy guides in `docs/deploy-history/DEPLOY-PLACES-*`.
