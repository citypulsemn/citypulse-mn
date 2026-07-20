# Deploy Guide — Roadmap 1.2: SEO Layer

This makes your event pages discoverable: **schema.org structured data** (gets City Pulse into Google's "events near me" results), a **sitemap** and **robots.txt** (so Google crawls everything), and **dynamic branded OpenGraph images** (so shared links unfurl with a premium navy/gold card). Builds directly on the 1.1 event pages.

It's a **code-only** update — no database migration, no new environment variables, no new npm dependencies, pipeline untouched.

---

## What you're deploying

- **Event structured data** — every event page emits schema.org `Event` JSON-LD: name, start/end with correct Central-time offsets (CST/CDT handled), venue + address + geo, price offers (free → `0`, ranges → low end), `EventCancelled` for cancelled events, and an image. This is what Google reads for the events surface.
- **Day structured data** — day pages emit an `ItemList` linking each event.
- **`/sitemap.xml`** — homepage + every published event page + every day page, refreshed hourly.
- **`/robots.txt`** — allows all public routes, disallows `/admin`, points crawlers to the sitemap.
- **Dynamic OG image** — `/event/{id}/opengraph-image` renders a 1200×630 branded card per event (navy field, gold double-border, category-colored eyebrow, Oswald title, date · venue, wordmark, skyline mark). Every event gets one — even the ~all of them without a photo — so shared links always look premium. A sample is included as `sample-og-card.png`.

The Oswald font is bundled into the repo (`app/event/[id]/Oswald-SemiBold.ttf`) so the image renders with no runtime network dependency.

## Quality bar (all green)
- 98 automated tests pass (15 new, covering the JSON-LD mapper: timezone offsets, free/priced/ranged/unknown prices, cancelled, no-end, suburb address, ungeocoded, image).
- Typecheck clean, production build clean, **0 npm vulnerabilities**.
- End-to-end smoke test confirmed on a running server: `robots.txt` correct; `sitemap.xml` lists 49 URLs; event JSON-LD parses with the right `@type`, TZ offset, offers, and geo; day `ItemList` present; **OG image returns a valid 1200×630 PNG** (plus a branded fallback for missing events).

---

## Deploy steps (~5 minutes + Vercel build)

1. **Sync the code.** Unzip the new `citypulse-mn.zip`, copy its contents over your project folder, choosing **Replace**. Your `.env.local`, `node_modules`, and Git history are untouched.

   New files to confirm after copying:
   - `app/sitemap.ts`, `app/robots.ts`
   - `app/event/[id]/opengraph-image.tsx` and `app/event/[id]/Oswald-SemiBold.ttf`
   - `lib/seo/event-jsonld.ts`, `lib/seo/site.ts`
   - Changed: `next.config.ts` (adds font bundling for the OG route)

2. **Push.** GitHub Desktop → commit (`SEO layer: structured data, sitemap, OG images (roadmap 1.2)`) → **Push origin**.

3. **Vercel auto-redeploys.** Watch **Deployments** until green.

4. **Nothing else** — no Supabase step, no env vars.

> Note: the `SITE_URL` used for canonical/sitemap/JSON-LD URLs is hardcoded to `https://citypulsemn.com` in `lib/seo/site.ts`. If your primary domain ever changes, that's the one line to update.

---

## Verify on the live site

- [ ] `https://citypulsemn.com/robots.txt` shows `Disallow: /admin` and the `Sitemap:` line.
- [ ] `https://citypulsemn.com/sitemap.xml` lists your event and day URLs.
- [ ] **Rich Results Test** — go to `search.google.com/test/rich-results`, paste a live event URL. Expect **"Event" detected with 0 errors**. Test one of each: a normal event, a free event, and (if you have one) a cancelled event.
- [ ] **OG card** — open `https://citypulsemn.com/event/{id}/opengraph-image` directly; you should see the branded navy/gold card. Then paste an event link into iMessage or the Facebook Sharing Debugger (`developers.facebook.com/tools/debug`) and confirm it unfurls with that card. (Facebook caches aggressively — use "Scrape Again" if you re-test.)

## One-time Google setup (recommended, ~10 min)

This is what actually turns the structured data into traffic:

1. Go to **Google Search Console** (`search.google.com/search-console`) and add `citypulsemn.com` as a property (verify via a DNS TXT record at GoDaddy — Search Console walks you through it).
2. **Sitemaps** → submit `sitemap.xml`.
3. Over the next 1–2 weeks, watch **Pages** (indexing) and the **Performance** report. The event carousel eligibility shows up under the rich-results reports.

---

## Rollback
GitHub Desktop can undo the commit, or Vercel → **Deployments** → roll back in one click. No database or env change means rollback is instant and total.

---

## What's next on the roadmap
With pages (1.1) and SEO (1.2) done, the Phase-1 "discoverability" foundation is complete. Natural next steps: **1.3 Search** and **2.5 Price/Area filters** (cheap UX wins while indexing cooks), then **1.4 Analytics** + **1.6 RLS**, then the **1.5 Admin panel**. Per the roadmap's execution order.
