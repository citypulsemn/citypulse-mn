# Deploy Guide — Roadmap 2.4: Collections

Adds curated, shareable **collection pages** — named views like "Free This Week," "Live Music," and "Family Fun" that each get their own SEO landing page, branded share image, and URL. They're the destinations your Instagram posts and emails link to, and they turn repeated searches into evergreen pages Google can index.

**Code-only** update: no database migration, no environment variables, no dependencies.

---

## What you're deploying

- **`/collections`** — an index of all curated collections (each with a live event count).
- **`/collections/[slug]`** — a landing page per collection: hero, events grouped by day, a branded 1200×630 OG share image, full SEO metadata, and `ItemList` structured data.
- A **Browse by collection** strip on the homepage, plus all collections added to the sitemap.
- Eight curated collections to start: this-weekend, free-this-week, live-music, family-fun, date-night, arts-and-culture, festivals-and-markets, only-in-minnesota.

Selection reuses the exact same filter logic as the on-site filters (2.5), so a collection returns the same events the equivalent hand-set filters would. Full reference: `docs/COLLECTIONS.md`.

## Quality bar (all green)
- 178 automated tests pass (8 new: window math incl. the weekend Fri–Sun window, price/category/area/date composition, chronological sort, and registry integrity).
- Typecheck clean, production build clean, **0 npm vulnerabilities**.
- Smoke-tested: index renders, a collection page renders with hero + canonical + Twitter card + `ItemList` JSON-LD, the OG image renders (verified visually — on-brand navy/gold card), unknown slugs 404, and the sitemap lists every collection. All 8 pages are pre-rendered at build.

---

## Deploy steps (~5 minutes + Vercel build)

1. **Sync the code.** Unzip the new `citypulse-mn.zip`, copy contents over your project (**Replace**). Your `.env.local`, `node_modules`, and Git history are untouched.

   New files to confirm: `lib/collections.ts`, the `app/collections/` folder, `components/CollectionsStrip.tsx`.

2. **Push.** GitHub Desktop → commit (`Collections (roadmap 2.4)`) → **Push origin**.

3. **Vercel auto-redeploys.** Watch **Deployments** until green.

4. **Nothing else** — no Supabase step, no env vars.

---

## Verify on the live site

- [ ] Homepage shows a **Browse by collection** strip; tapping a pill opens that collection.
- [ ] `https://citypulsemn.com/collections` lists all collections with counts.
- [ ] Open **Live Music** (or any) → hero + events grouped by day, each linking to its event page. (If a collection is quiet right now it'll say "Nothing here right now" — it fills in as matching events publish.)
- [ ] Paste a collection link into iMessage / the Facebook debugger → it unfurls with the branded "COLLECTION" card.
- [ ] `https://citypulsemn.com/collections/does-not-exist` → 404.
- [ ] `https://citypulsemn.com/sitemap.xml` now includes the collection URLs.

### Use it
Link collections from your Instagram bio and posts, and (soon) from the weekly email. In Google Search Console you can watch these pages get indexed over the next week or two — they're built to rank for things like "free events this week twin cities."

---

## Notes

- **Editing the set is one file:** add or change an entry in `COLLECTIONS` in `lib/collections.ts` and everything (landing page, OG image, index card, sitemap, homepage strip) follows automatically.
- Pages revalidate every 5 minutes, so new events appear without a redeploy.
- Idea source: your search analytics (2.5's `search`/`price_toggle`/`area_toggle` events) show what people look for — good candidates for the next collection.

## Rollback
GitHub Desktop can undo the commit, or Vercel → **Deployments** → roll back in one click. No database or env change means rollback is instant.

---

## What's next on the roadmap
That rounds out **Phase 2 (audience)**: content generator, email capture, add-to-calendar, filters, and now collections. Natural next: **Phase 3 (community)** and the **weekly email digest** — the payoff for the 2.2 subscriber list, and a place collections shine (each week's digest is essentially a collection in the inbox).
