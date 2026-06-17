# Database

Standard Postgres. Works identically on **Supabase** or **Neon** (or any Postgres) — you only change `DATABASE_URL`. Schema lives in [`db/schema.sql`](../db/schema.sql).

## Provision (pick one)

**Supabase** — full platform; the built-in **Table Editor** gives you a spreadsheet-like view to eyeball drafts and flip them to published.
1. Create a project at supabase.com.
2. **SQL Editor** → paste `db/schema.sql` → Run.
3. Connection string: **Project Settings → Database → Connection string → "Transaction" (pooled)**. That's your `DATABASE_URL`.

**Neon** — pure serverless Postgres, scales to zero, first-class Vercel integration.
1. Create a project at neon.tech.
2. **SQL Editor** → paste `db/schema.sql` → Run.
3. Connection string: **Dashboard → Connection Details → pooled connection string**. That's your `DATABASE_URL`.

> Use the **pooled** connection string in both cases. `lib/db.ts` sets `prepare: false` for pgbouncer compatibility.

## The `events` table

| column | type | notes |
|---|---|---|
| `id` | uuid | primary key, auto |
| `event_key` | text | **unique** — the dedup key (see below) |
| `title` | text | |
| `category` | text | one of `music, sports, family, arts, food, weird, festival` (CHECK) |
| `venue`, `address`, `city` | text | address is required for geocoding |
| `lat`, `lng` | float8 | filled by the geocoder |
| `start_at`, `end_at` | timestamptz | stored as instants; rendered as Central time for the UI |
| `price` | text | display string (`"$45"`, `"$18–$120"`, `"Free"`) |
| `price_tier` | text | `Free / $ / $$ / $$$` (CHECK) |
| `ticket_url`, `description`, `image`, `source_url` | text | |
| `status` | text | `draft / published / archived` (CHECK) — **site serves only `published`** |
| `last_seen_at` | timestamptz | last pipeline run that re-found the event |
| `created_at`, `updated_at` | timestamptz | `updated_at` auto-maintained by trigger |

Indexes cover the hot paths: `(status, start_at)`, `(category)`, `(start_at)`, and `lat` / `lng` for bounding-box map queries. A view `published_events` returns exactly what the site reads.

## The dedup key (why weekly runs don't duplicate)

The weekly pipeline re-discovers the same events every run. Without a stable identity, each run would insert copies. Instead, every event gets a deterministic `event_key`:

```
event_key = sha256( normalize(title) | normalize(venue) | start_DATE )  // first 32 hex chars
```

`normalize()` lowercases, strips accents/punctuation, and collapses whitespace. The key uses the start **date**, not time, so a corrected start time still matches. The pipeline writes with `INSERT … ON CONFLICT (event_key) DO UPDATE`, so a re-found event **updates in place**. See `lib/event-key.ts` (unit-tested in `lib/__tests__/event-key.test.ts`).

**Status is sticky on update:** the upsert sets `status` only on INSERT. When an agent re-finds an event you already published, the UPDATE branch leaves `status` alone — so your review decision is preserved.

## Lifecycle

- New events arrive as `draft`. You promote good ones to `published` (the review gate).
- `archivePastEvents()` flips `published` events whose end (or start) is in the past to `archived`, so the site stays current without deleting history.
- Nothing is hard-deleted by the pipeline.

## Time zones

`start_at` / `end_at` are `timestamptz` (true instants). The website's calendar logic treats event times as local wall-clock, so `getEvents()` renders them in **America/Chicago**:

```sql
to_char(start_at at time zone 'America/Chicago', 'YYYY-MM-DD"T"HH24:MI')
```

This keeps "7:30 PM" showing as 7:30 PM regardless of the server's time zone. When the agent supplies a local ISO string (e.g. `2026-06-20T19:30`), store it as Central; the simplest path is to set the DB session/though the column default to Central, or store the offset explicitly.

## Promote drafts to published

In the Supabase Table Editor: filter `status = draft`, review, set the good ones to `published`. Or by SQL:

```sql
update events set status = 'published'
where status = 'draft' and id = '…';
```

## Reading directly

```sql
-- everything the site shows
select * from published_events;

-- events in a map viewport (bounding box)
select * from events
where status = 'published'
  and lat between 44.90 and 45.05
  and lng between -93.35 and -93.05;
```
