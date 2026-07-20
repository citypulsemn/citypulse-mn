# Deploy Guide — Roadmap 1.4: Analytics

Adds privacy-friendly analytics: **page views + Web Vitals** on every route, plus **custom events** for the interactions that matter — with `ticket_click` as the north-star metric. No cookie banner, invisible to visitors.

**Code + one Vercel toggle.** No database migration, no environment variables. It does add two small official Vercel dependencies (`@vercel/analytics`, `@vercel/speed-insights`), so this deploy includes updated `package.json`/`package-lock.json`.

---

## What you're deploying

- **Vercel Web Analytics** — page views, top pages (your event/day pages included), referrers, devices — cookieless, GDPR-friendly.
- **Vercel Speed Insights** — Core Web Vitals per route.
- **Custom events**, all funneled through one swappable wrapper (`lib/track.ts`):
  - `ticket_click` ⭐ (id, category, title) — the proof-of-value number
  - `event_open` (id, category, surface: calendar/map)
  - `share_click` (id, title)
  - `search` (query, result count) — now live (was stubbed in 1.3)
  - `chip_toggle` (category), `preset_select` (preset)
- **Zero cookie banner required.**

Full reference: `docs/ANALYTICS.md`.

## Quality bar (all green)
- 116 automated tests pass (5 new: the wrapper's property sanitizer and no-op safety).
- Typecheck clean, production build clean, **0 npm vulnerabilities** (both new packages are clean).
- Smoke test confirmed the app, event page, JSON-LD, and OG image all still render, with the analytics script injecting.

---

## Deploy steps

### 1. Sync the code
Unzip the new `citypulse-mn.zip`, copy its contents over your project folder, choosing **Replace**. Your `.env.local`, `node_modules`, and Git history are untouched.

**Important:** this update changed `package.json` **and** `package-lock.json` (the two new dependencies). Both are in the zip and in sync — your Vercel build runs `npm ci`, which needs them to match, so make sure both copied over.

New files to confirm: `components/TicketButton.tsx`, `docs/ANALYTICS.md`.

### 2. Push
GitHub Desktop → you should see the changed `package.json`/`package-lock.json` plus the component changes → commit (`Analytics (roadmap 1.4)`) → **Push origin**.

### 3. Vercel redeploys
Watch **Deployments** until green.

### 4. Enable Analytics in Vercel (required — this is the toggle that turns it on)
Data won't collect until you enable it on the project:
1. Vercel dashboard → your **citypulse-mn** project → **Analytics** tab.
2. Enable **Web Analytics**.
3. Enable **Speed Insights**.

That's it — the code that reports to them is already deployed. (No env vars, no keys.)

> **Plan note:** Web Analytics and Speed Insights are included on Vercel's free **Hobby** plan with a monthly events allowance; custom events count toward it. For a growing local site this is typically fine to start — if you ever approach the cap, Vercel shows it in the Analytics tab and the Pro plan raises it. Nothing breaks if the cap is hit; collection just pauses until the next cycle.

---

## Verify on the live site (give it a few minutes of real traffic)

- [ ] Visit the site, open a few events, click a **Tickets & Info** link, run a search, toggle a chip.
- [ ] Vercel dashboard → **Analytics → Web Analytics**: page views appear (may take a few minutes).
- [ ] **Custom Events** section: you see `ticket_click`, `event_open`, `search`, etc. Click `ticket_click` → break down by `title` to get "top events by ticket clicks." Click `search` → see the actual queries people typed.
- [ ] **Speed Insights** tab: Web Vitals begin populating.
- [ ] No cookie-consent banner appears anywhere (correct — it's cookieless).

Note: analytics only reports from the **production** deployment with Analytics enabled. Locally and in Vercel preview deployments, tracking safely no-ops — so don't expect events from your dev machine.

---

## Rollback
GitHub Desktop can undo the commit, or Vercel → **Deployments** → roll back in one click. Disabling the Analytics toggles in the dashboard also stops collection immediately. No database or env change, so rollback is clean.

---

## What's next on the roadmap
Per the execution order, **1.6 RLS** (quick database-security hardening) pairs naturally here, then the **1.5 Admin panel** (which will surface a 7-day snapshot). Note: the admin snapshot's *queryable* first-party data — and trending — arrive with **5.4**, which adds an `event_stats` table; until then the Vercel dashboard is where you read these numbers. Also worth doing soon: **2.5 Price/Area filters** and **2.3 Add-to-calendar** (which adds the `ics_download` event).
