# Deploy — Making the moat pay off: Places structured data + fact-rich metadata

*Aug 17, 2026. The winning-detail moat built ~500 verified facts across 12 kinds.
This turns them into SEO signal: schema.org `amenityFeature` in JSON-LD on every
Places kind page, plus a fact-enriched meta description. Google now reads exactly
what each pool/rink/orchard offers — unique, un-scrapeable content the roadmap's
thesis says should rank (once the pages are indexed).*

## Why this, why now
The GSC read (Aug 16) found the Places vertical ranked for ~nothing and wasn't even
indexed. Indexation is the precondition (Taren's pending Request-Indexing step), but
the *content signal* is what makes a page worth ranking once crawled — and the moat
is exactly that signal, previously visible only as on-page badges, invisible to
search engines. This exposes it in the machine-readable layer.

## What shipped
- **`lib/seo/places-jsonld.ts`** (pure, golden-tested):
  - `placeJsonLd(place, kind, opts)` — a schema.org object per place: a kind-mapped
    `@type` (`Museum` / `SportsActivityLocation` / `Park` / `TouristAttraction`
    default), name, deep-link `url` (`/places/[kind]#slug`), `PostalAddress`,
    `GeoCoordinates`, `isAccessibleForFree` (from cost), and **`amenityFeature`** —
    a `LocationFeatureSpecification` list built from the place's VERIFIED `details`.
  - `placesItemListJsonLd(places, kind, opts)` — an `ItemList` embedding those,
    rendered through the shared **`jsonLdSafe`** (the R0.6 `<`→`<` escape;
    never raw `JSON.stringify`).
  - `placesFactSummary(places)` — an honest, keyword-rich clause for the meta
    description (the filterable facts in label order), null for a moat-less kind.
- **`app/places/[kind]/page.tsx`** — renders the ItemList `<script type="application/
  ld+json">`, and `generateMetadata` appends "…filter by {facts}." to the
  description when the kind has verified facts.

## Honesty carries through
`amenityFeature` only ever lists a detail that is `true` — the exact same source-
verified set the badge shows. The structured data can't over-promise a fact the
page itself wouldn't. Kinds with no verified details (beaches, sledding, etc.) emit
plain Place items with no amenityFeature and keep the generic description — no
invented signal.

## Verification (observed, not intended)
- **Live browser** (server-rendered JSON-LD parsed in-page):
  - `/places/pool`: ItemList of 25 `SportsActivityLocation` items; Chaska pool
    carries `amenityFeature: [Indoor, Water slide, Zero-depth entry]`,
    `isAccessibleForFree: false`. Meta description: *"…filter by indoor, water
    slide, and zero-depth entry."*
  - `/places/beach` (no moat): 45 `Park` items, **no** amenityFeature anywhere,
    generic description. Console clean.
- **Tests +12** (1174 total): amenity features are exactly the true details in
  label order and never a false/absent one; `@type` mapping; deep-link url; geo
  omitted at 0,0; cost→isAccessibleForFree; ItemList positions; **the R0.6 breakout
  guard** (a `</script>` in a place name is escaped, no raw `</script>`);
  `placesFactSummary` grammar + null for moat-less kinds.
- Gate: `tsc` clean · 1174/1174 · `npm run build` clean · `npm audit` 0.

## Deploy steps
Merge to `main`; Vercel auto-deploys. No schema, no secret. After deploy, spot-check
one kind page in Google's Rich Results Test (paste the URL) to confirm the ItemList
+ amenityFeature parse.

## Follow-ups
- **Still gated on indexation** — this pays off once `/places/*` is crawled
  (Taren's Request-Indexing + the GSC re-check). Worth confirming amenityFeature
  appears in the next GSC/Rich-Results pass.
- Consider per-place detail pages (`/places/[kind]/[slug]`) later — a dedicated URL
  per place would let each Place object stand alone rather than nested in an
  ItemList. Bigger change; not needed for the amenityFeature signal.

## Rollback
`git revert`. The JSON-LD and the description clause are additive; reverting removes
the `<script>` and restores the generic description. No data change.
