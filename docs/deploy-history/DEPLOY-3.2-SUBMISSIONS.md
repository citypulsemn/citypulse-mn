# Deploy Guide — Roadmap 3.2: Submit an Event

Adds a public **Submit an event** form so the community and organizers can surface events, feeding a moderation queue you control. Nothing goes live automatically — you approve or reject each one from the admin dashboard. Approving creates a real, geocoded, published event; rejecting hides it. Your curation stays editorial.

Setup is light: **one database step**, then deploy. No new environment variables.

---

## What you're deploying

- A public **`/submit`** page (linked from the site footer and the sitemap) with a friendly form: title, category, date/time, venue, city, optional address, price, link, description, and an optional contact email.
- An **Admin → Submissions** tab: each pending submission with **Approve & publish** and **Reject** (with an optional internal note).
- Approving geocodes the venue automatically, converts the time correctly (Central → UTC), computes the dedup key, and publishes a normal event — indistinguishable from pipeline events.

Full reference: `docs/SUBMISSIONS.md`.

## Quality bar (all green)
- 202 automated tests pass (12 new: field validation — required fields, past/too-far dates, bad category, URL/email format, length caps, start/end composition — and the submission→event mapper incl. correct timezone instant, geocode fallback, and stable dedup key).
- Typecheck clean, build clean, **0 npm vulnerabilities**.
- Verified live: the form renders and validates, `/admin/submissions` is behind admin auth (401 without, moderation queue with), and the footer/sitemap links are in place. The `/submit` page is static (no build-time database access — so it won't hit the collections-style build issue).

---

## Step 1 — Database (adds one table)

In **Supabase → SQL Editor**, paste the contents of `db/schema.sql` and run it. It's idempotent (safe to re-run) and adds the `event_submissions` table — **sealed** with row-level security (no public read/write; only your server actions touch it, like the subscribers table). Your existing tables are untouched.

## Step 2 — Deploy the code

Unzip the new `citypulse-mn.zip` and copy **all** contents over your repo, replacing everything. Commit (`Submit an event (roadmap 3.2)`) → push. Vercel redeploys.

New files to confirm landed: `app/submit/`, `app/admin/submissions/`, `components/SubmitForm.tsx`, `lib/submissions.ts`.

That's it — no environment variables. Geocoding on approval reuses your existing Mapbox token (the same one the weekly pipeline uses); if it's not set, approved events just default to a downtown map pin you can adjust later.

---

## Verify on the live site

- [ ] `citypulsemn.com/submit` loads and shows the form; the footer link works.
- [ ] Submit a test event. You should see the thank-you message.
- [ ] In **Admin → Submissions**, your test event appears. Click **Approve & publish**.
- [ ] The event now shows on the homepage/calendar (with a map pin), like any other event.
- [ ] Submit another and **Reject** it — it disappears from the queue and never publishes.
- [ ] Try submitting with a blank title or a past date — you get inline errors instead of a bad submission.

---

## How it protects quality
- **Moderation-first:** nothing publishes without your approval, so spam or off-brand events never reach the site.
- **Sealed table:** the submissions queue isn't publicly readable — only the admin dashboard (behind your password) can see it.
- **Honeypot + validation:** an invisible field catches bots, and every field is validated server-side.
- **No duplicates:** approving uses the same dedup key as the pipeline, so if the weekly agents already found the event, approval updates it in place instead of creating a second copy.

## Rollback
Roll back the deploy in Vercel. The `event_submissions` table can stay — it's inert without the form. Existing events are unaffected.

---

## What's next on the roadmap
Phase 3 continues with **3.3 Saved events** — a per-user "my list," which introduces your first *per-user* row-level security policy (a nice step up from the sealed tables so far) and pairs naturally with a future personalized digest.
