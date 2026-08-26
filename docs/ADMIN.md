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

## Undoing a bulk change

`admin_audit` is the undo, and it is the ONLY durable one. The importers and
cleanup scripts each write a backup file too, but those are a convenience for
the operator running them — do not plan a rollback around a path someone typed
on the day. Every hide records the status it set and the event it set it on, so
the database can reverse itself.

Restore everything one action hid, but only rows still sitting in that state —
so a later, deliberate decision is never clobbered:

```sql
update events e
set status = 'published'
from admin_audit a
where a.event_id = e.id
  and a.action = 'dedupe_flagged'        -- the action to reverse
  and e.status = a.patch->>'status'      -- untouched since
  and e.start_at >= now();
```

Actions this workstream wrote, all reversible the same way:

| Action | What it did |
|---|---|
| `hide_bad_sports_data` | phantom / wrong-opponent sports listings |
| `import_sports_hide` | the same, from the weekly importer |
| `import_music_hide` | a room dark that night, or the show found elsewhere |
| `hide_placeholder_title` | titles naming no event |
| `dedupe_flagged` | one copy of a duplicate |
| `resolve_conflict` | the unverified side of a clash |

`import_sports_retime` is the exception — it changed a time, not a status, and
its `patch->>'from'` holds the original:

```sql
update events e
set start_at = (a.patch->>'from')::text::timestamp at time zone 'America/Chicago'
from admin_audit a
where a.event_id = e.id and a.action = 'import_sports_retime';
```

Check before you write:

```sql
select a.action, count(*) from admin_audit a join events e on e.id = a.event_id
where e.status = a.patch->>'status' and e.start_at >= now() group by a.action;
```
## Data model

Two idempotent tables in `db/schema.sql`, both with RLS enabled and no anon policy (reached only through the service `DATABASE_URL`):
- `pipeline_runs` — one row per pipeline run.
- `admin_audit` — one row per admin action.

## Implementation notes

- Reads: `lib/admin.ts` (`getAdminEvents`, `getDuplicatePairs`, `getPipelineRuns`, `getContentStats`) — with sample-data fallback when there's no DB, so the UI renders locally.
- Mutations: `lib/admin-actions.ts` (server actions) — `hideEvent`, `restoreEvent`, `archiveEvent`, `archiveDuplicate`, `updateEvent`.
- Patch validation: `parseEventPatch` (pure, unit-tested).
- The UI uses server-action `<form>`s and `<details>` disclosures, so it works on mobile with minimal client JS.
