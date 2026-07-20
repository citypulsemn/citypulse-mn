# Deploy Guide — Roadmap 1.6: Row Level Security

Locks down your database's public API so that only **published** events are readable through it — drafts, cancelled, and archived rows (and your admin/observability tables) become private. This closes the security note flagged back in the early sessions.

This is a **database-only** change: one SQL block in Supabase. **No code changes, no environment variables, no dependencies**, and — importantly — **no behavior change** for your site, pipeline, or admin panel.

---

## Why this is safe (and changes nothing you can see)

Your site, pipeline, and admin all connect through `DATABASE_URL` as the table **owner**, and a table owner **bypasses** its own RLS. RLS only governs Supabase's auto-generated REST API roles (`anon` = the public key, `authenticated`). So:

- The public site keeps showing published events (unchanged).
- The admin panel keeps seeing drafts/cancelled/archived (unchanged).
- The pipeline keeps writing normally (unchanged).
- **What changes:** anyone poking at the raw Supabase REST API can now read only published events — not your hidden judgment calls.

I verified this against a real Postgres engine before shipping: with the policy applied, the `anon` role sees only the 1 published row out of 4, while the owner role (your app) still sees all 4 including drafts.

## Quality bar (all green)
- RLS behavior proven with an authentic Postgres test (anon → published only; owner → all; admin tables → sealed).
- App suite unchanged: 128 tests pass, typecheck clean, build clean, **0 vulnerabilities**.

---

## Deploy steps (~2 minutes)

### 1. Sync the code
Unzip the new `citypulse-mn.zip`, copy contents over your project (**Replace**). The only meaningful change is `db/schema.sql` (plus new docs). Committing/pushing this keeps your repo in sync, but the change that matters happens in Supabase (next step).

### 2. Run the SQL in Supabase (the actual change)
Supabase → **SQL Editor** → **New query** → paste all of the updated `db/schema.sql` → **Run**. It's idempotent — it re-runs everything harmlessly and adds the new RLS block:
- enables RLS on `events` and
- creates the `events_public_read` policy (anon/authenticated may read only published).

✅ Expect success with no errors.

### 3. Push (optional but recommended)
GitHub Desktop → commit (`RLS hardening (roadmap 1.6)`) → **Push origin**. Vercel will redeploy, but since there's no code change this is just to keep the repo current.

---

## Verify

**On the live site:** just confirm nothing broke —
- [ ] The homepage still shows events.
- [ ] `/admin` still lists **drafts and archived** events (proves the owner bypass works — this is the thing to check).

**In Supabase (the security proof):** open `db/verify-rls.sql` in the SQL Editor and run it. It uses `set role anon` to simulate the public API. Expect:
- [ ] As your normal role: all statuses visible.
- [ ] As `anon`: **only `published`** rows; `visible_drafts` = **0**.
- [ ] `admin_audit` and `pipeline_runs` visible to anon = **0** (sealed).

If the admin panel ever stops showing drafts after this, that would mean your `DATABASE_URL` connects as a non-owner role — tell me and we'll scope it; but the standard Supabase connection string connects as the owner, so this is expected to be a no-op for the app.

---

## Rollback
If needed, disable it in Supabase SQL Editor:
```sql
alter table events disable row level security;
```
That instantly reverts to the prior behavior. (The policy definition can stay; disabling RLS makes it inert.)

---

## What's next on the roadmap
That completes **Phase 1 — the discoverability + foundation layer** (event pages, SEO, search, analytics, admin, and now security). 🎉

Phase 2 (audience) opens with the big one: **2.1 — the Instagram content generator**, the flywheel that turns your event database into your weekly IG posts. Or, for quick wins first: **2.5 Price/Area filters** and **2.3 Add-to-calendar**. Your call — we'll build it the same way.
