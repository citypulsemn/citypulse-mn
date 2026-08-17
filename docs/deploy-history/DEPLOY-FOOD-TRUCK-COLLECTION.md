# Deploy — Food Truck Festivals collection (demand-validated evergreen)

*Aug 16, 2026. A new collection targeting the sharpest demand cluster the GSC
"what's ranking" report surfaced: "mn/minnesota food truck festival" — repeated,
high-CTR, position-1 queries. Unlike the Places kinds (which rank for nothing
yet), this is a page built against **measured** search demand.*

## Why this, and why a collection
The GSC read showed food-truck-festival *event* pages ranking well (position 1–4,
20–27% CTR) for a whole query family. There was no single evergreen page
aggregating them — so the demand was landing on scattered one-off event pages
that vanish after the event. A permanent topical page captures the cluster,
compounds, and routes that traffic into the funnel.

Collections were already the right tool: named filter + SEO landing page + JSON-LD
+ feed-subscribe + place-guide cross-links + sitemap + `/collections` index entry,
all for free from one spec. No new page infrastructure.

## What shipped
- **New `food-truck-festivals` collection** ([lib/collections.ts](../../lib/collections.ts)):
  `query: "food truck"`, `window: "all"`. `matchesQuery` requires BOTH tokens in
  title/venue/city/description, so it catches the named rallies and festivals
  (Anoka, Rosemount, "MN Food Truck Festival") without dragging in every brewery
  that merely mentions a food truck. **Evergreen — no year in the title** (like
  `/this-week`; a hardcoded "2026" would go stale and need yearly edits).
- **New optional `seoTitle` on `CollectionSpec`** — lets the `<title>` carry the
  searched phrase ("Minnesota Food Truck Festivals — Twin Cities Calendar") while
  the on-page H1 and the collection card stay short ("Food Truck Festivals").
  Used in the collection page's `generateMetadata`
  ([app/collections/[slug]/page.tsx](../../app/collections/[slug]/page.tsx));
  every existing collection is unchanged (falls back to `title`).

Auto-wired by existing code: the `/collections` index lists it, the sitemap
includes it, and `/collections/food-truck-festivals` renders its own SEO page.

## Verification (observed, not intended)
- **Live dev server, rendered HTML:** `/collections/food-truck-festivals` serves
  `<title>Minnesota Food Truck Festivals — Twin Cities Calendar | City Pulse MN</title>`,
  H1 "Food Truck Festivals", the www canonical, and **21 matched events** — a
  genuinely populated page, not an empty SEO shell.
- **Tests +2** (part of 1080 total): the collection is registered, evergreen (no
  year in title/seoTitle), all-window, query-driven; selection includes food-truck
  events and excludes food-only and truck-only titles (the both-tokens guard).
- Gate: `tsc --noEmit` clean · 1080/1080 · `npm run build` clean · `npm audit` 0.

## Deploy steps
Merge to `main`; Vercel auto-deploys. No schema, no secret. The page is
on-demand-rendered + ISR-cached (30 min) like every collection; the sitemap picks
it up so the ops-digest Index count ticks up by one.

## Verify checklist (post-deploy)
- `/collections/food-truck-festivals` returns 200 with the SEO title + events.
- It appears on the `/collections` index and in `/sitemap.xml`.
- **Slow proof:** re-run `gsc-report` in ~4–6 weeks — watch for the page accruing
  impressions on the "food truck festival" query family (topical pages take weeks
  to index and rank).

## Note on the cultural-festivals cluster
The other demand signal (Lebanese / St Maron / cultural festivals) is more
diffuse — no single query catches it, and those events already fall under the
existing `festivals-and-markets` collection. The real lever there is pipeline
*coverage* (capturing every cultural festival), not another page — left as a
research/coverage item, not built here.

## Rollback
`git revert`. Removing the spec drops the collection from the index/sitemap and
404s the slug; `seoTitle` is additive and optional. No data to undo.
