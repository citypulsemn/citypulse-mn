# HOTFIX — /admin/stats server-side exception

## What happened, honestly

The engagement queries in `getEngagement()` had never actually executed anywhere before production. My smoke test verified the **no-database path** (the graceful zeros you saw in the screenshot) — but locally there's no `DATABASE_URL`, so the real SQL path was never run. On the live site those queries ran for the first time and threw — most likely because the `event_stats` table doesn't exist yet (if the Step 1 schema hadn't been applied when you loaded the page), possibly compounded by a type ambiguity in my date arithmetic.

Worse, this violated the feature's own stated contract. I gave the *write* path "analytics must never break the feature it measures" — every `recordStat` swallows every failure — but left the *read* path able to take down the whole admin page. That's the real bug, independent of what triggered it.

## The fixes (both in this zip)

1. **The read path now carries the same never-break contract as the writes.** Any failure in the engagement queries — missing table, bad connection, anything — logs the error and renders the empty state ("No engagement recorded yet") instead of a 500. The admin page cannot be taken down by its analytics section anymore, by construction.
2. **The date arithmetic is now unambiguous** (`::int` cast on the window parameter), removing the other candidate cause outright.
3. **The failure is encoded as a regression test**: a mocked database that throws `relation "event_stats" does not exist` must yield the empty state, not an exception — and must log, not swallow silently.

387 tests, clean build, 0 vulnerabilities.

## Deploy + verify (2 minutes)

1. **Deploy this zip** (commit: `Hotfix: resilient engagement read path`). `/admin/stats` will load even if nothing else is done — that's the point.
2. **Make sure the table exists** — if you already ran `db/schema.sql` for 5.1, skip this; otherwise paste in Supabase:

```sql
create table if not exists event_stats (
  event_id  uuid not null references events(id) on delete cascade,
  day       date not null,
  action    text not null check (action in ('view','ticket_click','save','calendar')),
  count     integer not null default 0,
  primary key (event_id, day, action)
);
create index if not exists idx_event_stats_day on event_stats (day);
select 'event_stats ready' as status;
```

3. Open an event page, tap the ticket link, then check **Admin → Stats** — your view and click should appear.

## Process fix going forward

Any new feature whose queries can't run in the container (no live DB here) gets its SQL exercised against a local Postgres in the container before shipping, or the read path ships pre-wrapped in the resilience contract — both, ideally. This one now has both.
