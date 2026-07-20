# Deploy Guide — Roadmap 1.1: Shareable Event & Day Pages

This ships two new public routes — `/event/{id}` and `/day/{YYYY-MM-DD}` — plus a Share button. It's a **code-only** update: no database migration, no new environment variables, no new dependencies, and the weekly pipeline is untouched.

---

## What you're deploying

- **`/event/{id}`** — a full, shareable page for any event (the in-app modal, "unfolded"). Shows a CANCELLED banner for cancelled events, an "already happened" banner for past/archived ones, and 404s for hidden (draft) events. Includes a static map thumbnail, a Share button, and a "More on {day}" strip.
- **`/day/{YYYY-MM-DD}`** — every date has a page listing that day's events.
- **Share button** — native share sheet on phones, copy-link on desktop; added to both the pages and the in-app modal.
- **SEO basics** — correct `<title>`, meta description, and OpenGraph/Twitter tags per page (the full structured-data + branded OG image layer is roadmap 1.2, next).

The in-app calendar/map experience is unchanged — the modal and the new pages now share one layout component, so they can't drift apart.

## Quality bar (all green)
- 83 automated tests pass (17 new), typecheck clean, production build clean, **0 npm vulnerabilities**.
- End-to-end smoke test confirmed: `/event/{id}` → 200 with correct meta; unknown event → 404; `/day/{valid}` → 200; `/day/garbage` → 404; ended banner renders for past events.

---

## Deploy steps (~5 minutes + Vercel build)

1. **Sync the code.** Unzip the new `citypulse-mn.zip`, copy its contents over your project folder, choosing **Replace**. Your `.env.local`, `node_modules`, and Git history are untouched (none are in the zip).

   Sanity check after copying — these new files should exist:
   - `app/event/[id]/page.tsx`
   - `app/day/[date]/page.tsx`
   - `components/EventDetailBody.tsx`, `ShareButton.tsx`, `EventDayCard.tsx`
   - `lib/event-view.ts`

2. **Push.** In GitHub Desktop you'll see the new/changed files — commit (`Shareable event & day pages (roadmap 1.1)`) → **Push origin**.

3. **Vercel auto-redeploys.** Watch **Deployments** until green.

4. **Nothing else.** No Supabase step, no env vars, no pipeline change.

---

## Verify on the live site

Replace `{id}` with a real event id from your Supabase `events` table (the `id` column), and `{date}` with a date that has events (e.g. an upcoming weekend).

- [ ] `https://citypulsemn.com/event/{id}` loads a full branded page.
- [ ] **Text that link to yourself** — it opens on your phone and (once 1.2 adds the image) will unfurl with a card; today it unfurls with title + description.
- [ ] Tap **Share** on the page → your phone's share sheet appears (or "Link copied ✓" on desktop).
- [ ] `https://citypulsemn.com/day/{date}` lists that day's events; each row links to its event page.
- [ ] A made-up id (e.g. `/event/zzz`) shows the 404 page — **this confirms hidden/draft events won't leak**.
- [ ] In the app, opening an event still works exactly as before, now with a Share control.

**Google (optional, do once):** in Google Search Console, request indexing on one event URL to prime the crawler. Full sitemap + structured data come with 1.2.

---

## How to find event ids to test
In Supabase → Table Editor → `events`, the `id` column holds the UUIDs used in `/event/{id}`. Or open any event in the app, tap Share, and the copied link *is* the URL.

---

## Rollback
If anything looks off: GitHub Desktop can undo the commit, or Vercel → **Deployments** → roll back to the previous build in one click. Because there's no database or env change, rollback is instant and total.

---

## What's next on the roadmap
**1.2 — SEO layer**: schema.org `Event` structured data (gets you into Google's events results), `sitemap.xml`, `robots.txt`, and dynamic branded OpenGraph images so shared links look premium. It builds directly on these pages — the natural next step.
