# Admin dashboard

Roadmap 1.5. A password-protected `/admin` for running City Pulse from a phone — no Supabase login needed for day-to-day curation.

## Access & security

- Protected by **HTTP Basic auth** in `middleware.ts`, checked against `ADMIN_USER` / `ADMIN_PASSWORD` env vars. No password configured → the whole area is locked (fails closed).
- Every mutation **re-checks auth server-side** (`assertAdmin`) — defense in depth behind the middleware.
- `/admin` is **noindexed** (meta) and **disallowed in robots.txt**, so it never appears in search.
- Upgrade path (per roadmap): swap Basic auth for Supabase Auth when multiple operators or roles are needed.

## Tabs

**Events** — newest-first list with search (title/venue/city) and a status filter. Per row:
- **Hide** (→ `draft`) / **Publish** (→ `published`). Because status is sticky, a hidden event stays hidden through pipeline re-runs.
- **Edit** (expandable) — title, venue, city, start/end, price, ticket URL, description. Saves recompute the price tier and re-time to America/Chicago. Edits appear on the public site within the 5-minute ISR window (the event page is revalidated immediately on save).
- **Archive** (two-tap confirm) — removes from the site, recoverable.

**Duplicates** — same-day, similar-title pairs the auto-collapse didn't catch (a manual backstop). Archive the stray copy, or leave both if they're genuinely different.

**Pipeline** — the last 8 research runs: upserted / cancelled / collapsed / archived counts, per-band breakdown, duration, and failures highlighted. Fed by the `pipeline_runs` table the pipeline now writes on every run.

**Stats** — content health from the database (published, upcoming, added last 7 days, hidden/cancelled/archived, and a published-by-category bar chart). Engagement metrics (ticket clicks, searches, Web Vitals) live in the Vercel Analytics dashboard; an on-site engagement snapshot arrives with roadmap 5.4.

## Audit trail

Every mutation writes a row to `admin_audit` (action, event_id, patch, timestamp) — cheap insurance and a record of what changed when.

## Data model

Two idempotent tables in `db/schema.sql`, both with RLS enabled and no anon policy (reached only through the service `DATABASE_URL`):
- `pipeline_runs` — one row per pipeline run.
- `admin_audit` — one row per admin action.

## Implementation notes

- Reads: `lib/admin.ts` (`getAdminEvents`, `getDuplicatePairs`, `getPipelineRuns`, `getContentStats`) — with sample-data fallback when there's no DB, so the UI renders locally.
- Mutations: `lib/admin-actions.ts` (server actions) — `hideEvent`, `restoreEvent`, `archiveEvent`, `archiveDuplicate`, `updateEvent`.
- Patch validation: `parseEventPatch` (pure, unit-tested).
- The UI uses server-action `<form>`s and `<details>` disclosures, so it works on mobile with minimal client JS.
