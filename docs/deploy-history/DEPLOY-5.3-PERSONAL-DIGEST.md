# Deploy Guide — Roadmap 5.3: Personalized Digest

**The weekly email now leads with each subscriber's own plans.** Instead of the same eight picks for everyone, a subscriber who saved Trampled by Turtles gets a subject line that says so, a "You saved these — happening this week" section at the top, and the general picks reordered toward the categories they actually save. A reminder beats a recommendation.

**One database step (one column), one deploy. No new secrets.**

---

## The identity bridge — the design decision that made this possible

Subscribers are email addresses. Savers are anonymous cookies. Nothing linked them — until now: **when someone subscribes, the server action reads the same anonymous save-cookie from their browser and stores it on the subscriber row.** The link is created only at the moment a person voluntarily hands over their email, from their own browser, using data that was already first-party.

The lifecycle is deliberate:
- **Re-subscribing refreshes the link.** That's also how *existing* subscribers opt in: submit the footer form once from the browser they save events in. (Harmless — the upsert just keeps them subscribed.)
- **Unsubscribing severs it.** `saver_token` is nulled — no reason to keep a link to someone who left.
- **It's used for exactly one thing**: showing subscribers their own saved events in their own email. It appears nowhere else.

Honest limitation, documented: someone who saves on their phone but subscribed from a laptop stays unpersonalized until they resubmit from the phone. The durable fix is roadmap 5.4 (magic-link saved lists) — this ships the value now without that machinery.

## What a personalized email looks like

Verified with a full render (screenshot in the build log, validated visually):

- **Subject**: `You saved "Trampled by Turtles" — happening this week` (or `You saved 2 events…`)
- **Intro**: "Your week, starting with the plans you already made."
- **"You saved these — happening this week"**: their saves starting (or still running — multi-day aware, all-day labeled honestly) within 7 days, soonest first, capped at 5.
- **"Also worth your time"**: the same curated picks, reordered by their save-derived category affinity — stable within categories so curation survives, with anything already featured above removed.
- Plain-text version mirrors all of it.

**The degradation guarantee, tested literally**: no token, no saves, or nothing imminent ⇒ the email is *byte-identical* to the standard digest (the test compares HTML strings). Nobody's email gets worse; some people's get better. And every failure in the personalization path falls back to the standard digest — personalization can never cost anyone their email.

## Quality bar (all green)
- **409 tests (24 across the two digest suites, 12 new)**: the week window, ongoing-multi-day saves counting, the cancelled-save filter, the cap, affinity ranking with deterministic ties, stable reordering, no-double-feature, subject forms, HTML *and* plain-text sections, and the byte-identical degradation.
- Typecheck clean, build clean, **0 vulnerabilities**.
- Full personalized email rendered and visually inspected — the fair leads all-day, the concert shows 8 PM, picks reorder music-first.

---

## Step 1 — Database

**Supabase → SQL Editor** → run `db/schema.sql` (idempotent; adds `subscribers.saver_token`).

## Step 2 — Deploy

Unzip `citypulse-mn.zip` over your repo, commit (`Personalized digest (roadmap 5.3)`) → push.

## Step 3 — Try it yourself (2 minutes)

1. On your phone, save two or three upcoming events on the site.
2. In the same browser, subscribe in the footer with your email (if you're already subscribed, submitting again is exactly the right move — it links your saves).
3. Run the digest dry-run: **GitHub → Actions → Send Weekly Digest → Run workflow → dry run** (or `npm run digest -- --dry-run`). The log now reports `N personalized` — yours should be ≥ 1.
4. Next real send: your email leads with what you saved.

## Verify
- [ ] Dry-run log shows `… · 1 personalized` (or more) after you've linked yourself.
- [ ] Your next digest opens with "You saved these — happening this week."
- [ ] A second address that never saved anything receives the standard digest, unchanged.

## Rollback
Roll back the deploy — emails revert to the standard render. The column is inert without the code.

---

## What's next

**5.6 Ops digest** is the natural next bite: coverage grades, verification flags, and pipeline health in one weekly email to *you* — the instruments exist, they just live in an admin you have to remember to open. Or **5.4 saved-list durability** (magic link), which upgrades today's identity bridge into something that survives browsers and devices. And the **multi-day collapse** data op remains open — the State Fair is still quadrupled until we run it.
