# Deploy Guide — Roadmap 1.5: Admin Dashboard

A password-protected `/admin` for running City Pulse from your phone — hide/edit/archive events, review duplicates, check pipeline health, and see content stats, all without logging into Supabase.

This deploy has **three parts**: sync code, run one SQL block in Supabase, and set two environment variables in Vercel.

---

## What you're deploying

- **`/admin`** behind HTTP Basic auth (noindexed, robots-disallowed). Four mobile-first tabs:
  - **Events** — newest-first, search + status filter; per event: **Hide/Publish**, **Edit** (title, venue, city, start/end, price, ticket URL, description), **Archive** (two-tap confirm).
  - **Duplicates** — same-day similar-title pairs the auto-collapse missed; archive the stray copy.
  - **Pipeline** — last 8 research runs with counts, per-band breakdown, duration, and failures highlighted.
  - **Stats** — content health (published, upcoming, added-last-7-days, hidden/cancelled/archived) + published-by-category chart.
- **Audit trail** — every admin action is logged.
- **Pipeline observability** — the weekly pipeline now records each run.

Full reference: `docs/ADMIN.md`.

## Quality bar (all green)
- 128 automated tests pass (12 new: patch validation + Basic-auth helpers).
- Typecheck clean, production build clean, **0 npm vulnerabilities**.
- Smoke test confirmed: no credentials → **401**; wrong password → **401**; correct credentials → **200** with the UI rendered and **noindex** present; all four tabs load; the **public site stays open** without credentials.

---

## Deploy steps

### 1. Sync the code
Unzip the new `citypulse-mn.zip`, copy its contents over your project folder (**Replace**). Your `.env.local`, `node_modules`, and Git history are untouched.

New files to confirm: `middleware.ts`, the `app/admin/` folder, `lib/admin.ts`, `lib/admin-actions.ts`.

### 2. Run the SQL (adds two tables)
Supabase → **SQL Editor** → **New query** → paste all of the new `db/schema.sql` → **Run**. It's idempotent — it only creates the new `pipeline_runs` and `admin_audit` tables (with RLS enabled) and skips everything that already exists. ✅ Success with no errors.

### 3. Set the admin password in Vercel (required)
Vercel dashboard → your **citypulse-mn** project → **Settings → Environment Variables**. Add:

| Name | Value | Environments |
|---|---|---|
| `ADMIN_USER` | a username you pick (e.g. `taren`) | Production (+ Preview if you want) |
| `ADMIN_PASSWORD` | a strong password | Production (+ Preview) |

**If `ADMIN_PASSWORD` is not set, `/admin` stays locked (401) for everyone** — that's the safe default, but it means you must set it to get in.

### 4. Push & redeploy
GitHub Desktop → commit (`Admin dashboard (roadmap 1.5)`) → **Push origin**. Vercel redeploys. (Setting env vars in step 3 before this deploy is fine; if you set them after, trigger a redeploy so they take effect.)

---

## Verify on the live site

- [ ] Visit `https://citypulsemn.com/admin` → the browser shows a **username/password prompt**. Enter your `ADMIN_USER` / `ADMIN_PASSWORD`.
- [ ] The **Events** tab lists your real events. Hide one → refresh the public site in another tab → it's gone within ~5 minutes (ISR). Publish it back.
- [ ] **Edit** an event's time or title → Save → it updates on the public event page within ~5 minutes.
- [ ] **Archive** requires the second "Confirm archive" tap.
- [ ] **Duplicates**, **Pipeline**, and **Stats** tabs load. (Pipeline will say "no runs yet" until the next weekly run — that's expected; it populates after the next Monday run or a manual "Run workflow".)
- [ ] Open `/admin` in a private window with no credentials → you're blocked (401).
- [ ] The public site works normally for everyone without any prompt.

---

## Notes

- **Basic auth over HTTPS** is appropriate for a single operator; the browser remembers the credentials for the session. The upgrade path (Supabase Auth, multiple roles) is noted in `docs/ADMIN.md` for when you need it.
- **Phone use:** the whole panel is mobile-first — this is designed to be used from the cabin.
- **Audit:** every hide/edit/archive writes a row to `admin_audit`. Nothing is ever hard-deleted; Archive is recoverable (set the event back to Published).

## Rollback
GitHub Desktop can undo the commit, or Vercel → **Deployments** → roll back in one click. The SQL only *added* tables (safe to leave). To fully disable the admin area, remove `ADMIN_PASSWORD` in Vercel — it locks immediately.

---

## What's next on the roadmap
**1.6 RLS** is the natural companion (quick database-security hardening — restrict the public events table to published rows at the database level). After that, Phase 1 is complete and Phase 2 (audience) opens: **2.1 the Instagram content generator** — the flywheel — or **2.5 Price/Area filters** and **2.3 Add-to-calendar** as quick wins.
