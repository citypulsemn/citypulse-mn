# Deploy Guide — Roadmap 3.1: Weekly Email Digest

Sends your subscribers a branded weekly email with the best events across the metro, every Thursday morning — the payoff for the email list you started collecting in 2.2, and the loop that pulls people back to the site. It also adds a working one-click **unsubscribe**.

This one has **more setup than usual** because it sends real email: a database step, a Resend account with a verified domain, and a few secrets. Take it in order and it's straightforward. **Until you finish the Resend + secrets steps, nothing sends** — the job just logs, so you can deploy the code safely first.

---

## What you're deploying

- A weekly digest email (subject like *"This week in the Twin Cities: Trampled by Turtles + 3 more"*) with ~8 curated events, each linking back to its page, plus a gold "See everything" button. Preview: `sample-digest-email.html` (open it in a browser).
- A **`/unsubscribe`** page (one-click, works from the email's List-Unsubscribe header too).
- An **Admin → Digest** tab: live email preview, this week's subject, subscriber count, and recent sends.
- A **GitHub Actions** workflow that sends every Thursday (with a manual "dry run" option).

## Quality bar (all green)
- 190 automated tests pass (12 new: HMAC token make/verify incl. tamper rejection, digest selection/cap/sort, email subject/HTML/text rendering, and HTML-escaping).
- Typecheck clean, build clean, **0 npm vulnerabilities** (Resend is called over plain `fetch` — no SDK dependency).
- Verified live: unsubscribe accepts a valid token (200) and rejects a tampered one (400), one-click POST works, the admin page is behind auth, and the rendered email was **visually confirmed** on-brand.

---

## Step 1 — Database (adds one table)

In **Supabase → SQL Editor**, paste the contents of `db/schema.sql` and run it. It's idempotent (safe to re-run) and adds the `digest_sends` table (send log). Your existing tables are untouched.

## Step 2 — Resend account + verified domain (the important part)

Email only lands in inboxes if it's sent from a domain you've verified. Resend makes this painless:

1. Create a free account at **resend.com**.
2. **Add Domain** → enter `citypulsemn.com`. Resend shows a few DNS records (SPF, DKIM, and a return-path).
3. Add those records in **GoDaddy** (your DNS host) → wait for Resend to show the domain as **Verified** (usually minutes, up to a few hours).
4. Create an **API key** (Resend → API Keys). Copy it — you'll paste it in Step 4.

Sender address: `hello@citypulsemn.com` (the default `DIGEST_FROM`). You don't need a mailbox for it — Resend sends on the domain's behalf.

## Step 3 — Deploy the code

Unzip the new `citypulse-mn.zip`, copy contents over your project (**Replace**), commit (`Weekly email digest (roadmap 3.1)`), push. Vercel redeploys. Confirm the new `app/unsubscribe/` and `app/admin/digest/` folders and the `lib/digest*.ts` files landed.

## Step 4 — Secrets (two places)

Pick one long random string for `UNSUBSCRIBE_SECRET` (e.g. from a password manager) and use the **same value in both places**.

**In Vercel** (Settings → Environment Variables) — so the `/unsubscribe` links in emails validate:
- `UNSUBSCRIBE_SECRET` = your random string

**In GitHub** (repo → Settings → Secrets and variables → Actions → New repository secret) — so the Thursday job can send:
- `DATABASE_URL` = your Supabase connection string (same one Vercel uses)
- `RESEND_API_KEY` = the key from Step 2
- `UNSUBSCRIBE_SECRET` = the **same** random string as in Vercel
- `SITE_URL` = `https://citypulsemn.com`
- `DIGEST_FROM` = `City Pulse MN <hello@citypulsemn.com>`

Redeploy Vercel once after adding its variable.

## Step 5 — Test before the first real send

1. In GitHub → **Actions → Weekly Email Digest → Run workflow**, set **dry run = true**, run it. Check the log: it should build the digest and report how many it *would* send, without sending.
2. Subscribe yourself on the site, then run the workflow **for real** (dry run = false). You should get the email. Click **Unsubscribe** in it and confirm the page says "You're unsubscribed."
3. From then on it runs automatically every Thursday.

---

## Verify checklist

- [ ] `db/schema.sql` ran; `digest_sends` exists.
- [ ] Resend domain shows **Verified**.
- [ ] Vercel has `UNSUBSCRIBE_SECRET`; GitHub has all five secrets (same `UNSUBSCRIBE_SECRET`).
- [ ] Dry-run workflow succeeds.
- [ ] Real run delivers an email to your inbox; links open the right event pages.
- [ ] Unsubscribe link works and Admin → Digest shows the send in "Recent sends."

---

## Notes & troubleshooting

- **Nothing sends / "no RESEND_API_KEY":** the key isn't set as a GitHub secret (it's needed there, where the job runs — not just in Vercel).
- **Email lands in spam:** the domain isn't fully verified, or DKIM/SPF DNS records are missing — recheck Resend's domain page.
- **Unsubscribe says "Link expired":** `UNSUBSCRIBE_SECRET` differs between Vercel (which serves the page) and GitHub (which signed the link). They must match.
- **Empty week:** if no events fall in the next 7 days, the job skips and records a note rather than sending a blank email.
- Change the send day/time by editing the `cron` in `.github/workflows/weekly-digest.yml` (currently Thursdays 15:00 UTC ≈ 10am Central).

## Rollback
Remove the GitHub `RESEND_API_KEY` secret to instantly stop sends (the job becomes a safe no-op), or roll back the deploy in Vercel. The database table can stay — it's inert without the job.

---

## What's next on the roadmap
Phase 3 (community) continues. Natural follow-ups: **3.2**, and **3.3 saved events** (a per-user "my list," which introduces the first per-user RLS policy). The digest also sets up nicely for later personalization — a per-subscriber "for you" digest is a small step once saved events exist.
