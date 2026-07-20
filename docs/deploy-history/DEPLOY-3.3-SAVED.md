# Deploy Guide — Roadmap 3.3: Saved Events

Adds a personal list: tap **♡ Save** on any event and it lands on **`/saved`**. No login, no account — and under the hood it introduces the project's **first per-user row-level security policy**.

Setup: **one database step**, then deploy. No new environment variables.

---

## What you're deploying

- A **♡ Save** button on every event (next to *Add to calendar*), with instant optimistic feedback.
- A **`/saved`** page listing what the visitor saved, newest first, with one-tap removal. Linked in the footer ("Collections · Saved · Submit an event").
- A new `save_toggle` analytics event, so you can see what people actually save.

## How it works without logins

Each visitor gets an anonymous, unguessable token in an **httpOnly cookie**, created on their *first save*. Their saved list is keyed to that token. Nothing personal is stored — the token is the whole identity.

**The honest trade-off:** saves live with the browser, so they don't follow someone to a new device or survive clearing cookies. That's the cost of no accounts, and it's the right call unless/until you want logins. Worth knowing so it's not a surprise.

Full reference: `docs/SAVED.md`.

## Quality bar (all green)
- 207 automated tests pass (5 new: the UUID guard that protects every id reaching the database — including SQL-injection-shaped input — and the saved-order restoration logic).
- Typecheck clean, build clean, **0 npm vulnerabilities**.
- **Per-user RLS verified against real Postgres** (see below).
- Verified live: `/saved` shows an empty state for a new visitor, the API returns an empty list without a cookie, the Save button renders, and `/saved` is both `noindex` and disallowed in `robots.txt`.
- **No caching regression:** the homepage and event pages still cache exactly as before (the Save button hydrates client-side rather than making those pages read the cookie per-request — a deliberate design choice, since reading cookies server-side there would have made them dynamic and slower).

## The per-user RLS policy (the roadmap headline)

Your other private tables are *sealed* (no public access at all). This one is different: it allows access, but **only to your own rows**. I verified it against a real Postgres engine, not just by reading the SQL:

| Test | Result |
|---|---|
| Anon with no token | **0 rows visible** (table invisible by default) |
| Visitor A | sees only their own saves — **0** of Visitor B's |
| Visitor B tries to delete A's save | **0 rows affected** |
| Visitor B tries to insert a row impersonating A | **rejected** by the policy |

You can reproduce this in Supabase with `db/verify-rls-saved.sql`.

---

## Step 1 — Database (adds one table)

In **Supabase → SQL Editor**, paste the contents of `db/schema.sql` and run it. It's idempotent (safe to re-run) and adds the `saved_events` table plus its per-user policy. Existing tables are untouched.

> If `/admin/digest` or `/admin/submissions` ever showed a server error, it was because an earlier schema step hadn't been run — this single run also fixes those, since it creates any missing tables from 3.1/3.2 too.

## Step 2 — Deploy the code

Unzip the new `citypulse-mn.zip`, copy **all** contents over your repo (replace), commit (`Saved events (roadmap 3.3)`) → push. Vercel redeploys.

New files to confirm landed: `app/saved/`, `app/api/saved/`, `components/SaveButton.tsx`, `lib/saved.ts`, `lib/saver.ts`.

---

## Verify on the live site

- [ ] Open any event → you see **♡ Save**. Tap it → it fills in and reads **Saved**.
- [ ] Go to `/saved` (or the footer "Saved" link) → your event is listed.
- [ ] Tap the ✕ on it → it disappears; reload and it's still gone.
- [ ] Open the site in a **private/incognito window** → `/saved` is empty there (separate visitor, separate list). That's the per-user isolation working.
- [ ] After a day, `save_toggle` appears in **Vercel → Analytics → Custom Events**.

---

## Rollback
Roll back the deploy in Vercel. The `saved_events` table can stay — it's inert without the UI, and rolling back doesn't delete anyone's saves.

---

## What's next on the roadmap
**Phase 3 (community) is now complete** — digest, submissions, and saved events. Natural next moves:
- **Phase 4 (revenue)** — with the caveat you set from the start: curation is never for sale.
- **Phase 5 discovery depth**, including **5.4 event_stats** (first-party, queryable analytics — trending events and an engagement snapshot in the admin, instead of only the Vercel dashboard).
- A nice follow-on now unlocked: a **personalized digest** ("your saved events this week"), since saved events + the weekly email now both exist.
