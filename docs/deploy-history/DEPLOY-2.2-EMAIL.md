# Deploy Guide — Roadmap 2.2: Email Capture

Adds a subscribe form to the site footer and stores signups in an owned email list — the audience asset that later powers the weekly digest and is genuinely monetizable (unlike rented Instagram reach).

This deploy has **two parts**: sync code, and run one SQL block in Supabase. **No new environment variables, no dependencies.**

---

## What you're deploying

- A tasteful **subscribe form** in the site footer (homepage, event pages, day pages): "The week ahead, in your inbox."
- Signups stored in a new **`subscribers`** table, deduped by email (re-subscribing says "you're already on the list," never errors).
- **Validation** + a hidden **honeypot** to deter bots. Each signup records its **source** (home/event/day).
- Admin **Stats** tab now shows **subscriber count** + **new-in-7-days** + a **Download CSV** button (behind admin auth) to move the list into an email tool later.

Full reference: `docs/EMAIL.md`.

## Quality bar (all green)
- 145 automated tests pass (5 new: email normalization + validation).
- Typecheck clean, production build clean, **0 npm vulnerabilities**.
- The `subscribers` table (PII) was proven **sealed** against a real Postgres engine: anon can't read or insert; the owner can; duplicates dedupe.
- Smoke test confirmed: form renders in the footer across pages; the CSV export returns **401 without** admin auth and valid CSV **with** it.

---

## Deploy steps

### 1. Sync the code
Unzip the new `citypulse-mn.zip`, copy contents over your project (**Replace**). Your `.env.local`, `node_modules`, and Git history are untouched.

New files to confirm: `lib/subscribe.ts`, `components/SubscribeForm.tsx`, `components/SiteFooter.tsx`, `app/admin/subscribers/`.

### 2. Run the SQL (adds the subscribers table)
Supabase → **SQL Editor** → **New query** → paste all of the updated `db/schema.sql` → **Run**. Idempotent — it only creates the new `subscribers` table (with RLS enabled/sealed) and skips everything that already exists. ✅ Success, no errors.

### 3. Push & redeploy
GitHub Desktop → commit (`Email capture (roadmap 2.2)`) → **Push origin**. Vercel redeploys.

*(No environment variables. Because it uses your existing `DATABASE_URL`, capture works as soon as the table exists.)*

---

## Verify on the live site

- [ ] Scroll to the footer on the homepage — the subscribe form is there.
- [ ] Enter a real email → **Subscribe** → you see "You're on the list."
- [ ] Enter the **same** email again → "You're already subscribed 🎉" (no error, no duplicate).
- [ ] Enter a bad email (e.g. `nope`) → "Please enter a valid email address."
- [ ] `/admin → Stats` shows the **Subscribers** count going up, and **Download CSV** downloads your list.
- [ ] In Supabase → **Table Editor → subscribers**, your test rows are there (lowercased, with a source).

---

## Notes

- **Single opt-in today.** The table already has `status` (`subscribed`/`pending`/`unsubscribed`) and confirm/unsubscribe timestamps, so **double opt-in** and one-click **unsubscribe** slot in cleanly when the weekly digest ships — both need an email-sending provider (Resend/Postmark), which is a Phase 3 step.
- **Privacy:** the list is sealed at the database level (RLS) — the public API can't read it. Only your app (as owner) and the admin export can.
- **Deliverability tip:** when you do start sending, verify your sending domain (SPF/DKIM) in whatever email tool you pick, and import this CSV as your seed list.

## Rollback
GitHub Desktop can undo the commit, or Vercel → **Deployments** → roll back. The SQL only *added* a table (safe to leave). To hide the form without a redeploy isn't possible (it's in the code), but rolling back the deploy removes it.

---

## What's next on the roadmap
You've now got acquisition (IG → site → **email**). Natural next steps: the quick UX wins **2.5 Price/Area filters** and **2.3 Add-to-calendar** (which also lights up the `ics_download` analytics event), or jump toward **Phase 3 (community)** and the **weekly digest** that this list is built for.
