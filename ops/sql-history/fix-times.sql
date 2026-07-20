-- City Pulse MN — TIME BACKFILL (roadmap 4.6)
-- Fixes events whose times were shifted by the UTC-session bug: agent times
-- (Twin Cities wall-clock) were stored as if they were UTC.
--
-- The repair is the exact inverse of the bug: take the stored UTC clock face
-- and re-interpret it as America/Chicago (DST handled per-date automatically).
--
-- Run each step in the Supabase SQL Editor, in order. Read the previews.

-- ════════════════════════════════════════════════════════════════════════
-- STEP 0 — DIAGNOSTIC (read-only). What do local start hours look like?
-- ════════════════════════════════════════════════════════════════════════
-- Healthy calendar: most events 10 AM–9 PM, near-nothing before 7 AM.
-- A pile-up at 0–6 AM = the artifact classes below.
-- A pile-up at 12–3 PM for things that should be evening shows would mean the
-- shift is wider than these two classes — STOP and send me this output.
select extract(hour from start_at at time zone 'America/Chicago')::int as local_hour,
       count(*)
from events
where status in ('published','draft')
group by 1 order by 1;

-- ════════════════════════════════════════════════════════════════════════
-- STEP 1 — PREVIEW the two artifact classes (read-only)
-- ════════════════════════════════════════════════════════════════════════

-- CLASS A: stored exactly midnight UTC ⇒ a date-only answer ("2026-07-16")
-- swallowed as UTC. Renders 7 PM the previous day. Repair: same calendar
-- date, local midnight, marked all-day.
select id, title,
       to_char(start_at at time zone 'America/Chicago','YYYY-MM-DD HH24:MI') as shows_now,
       to_char((start_at at time zone 'UTC')::date, 'YYYY-MM-DD') || ' (All day)' as will_become
from events
where status in ('published','draft')
  and start_at = date_trunc('day', start_at at time zone 'UTC') at time zone 'UTC'
order by start_at;

-- CLASS B: local start hour 0–6 AM (the "5 AM Aquatennial" class) ⇒ a local
-- time stored with a Z. Repair: re-read the UTC face as local — 10:00Z becomes
-- 10:00 AM Central. Only applied when the repaired hour is plausible (7–23).
-- ⚠ If any row here is a GENUINE before-7-AM event (a sunrise run), note its
-- id and remove it from Step 2's update.
select id, title, category,
       to_char(start_at at time zone 'America/Chicago','YYYY-MM-DD HH24:MI') as shows_now,
       to_char(start_at at time zone 'UTC','YYYY-MM-DD HH24:MI') as will_become
from events
where status in ('published','draft')
  and start_at <> date_trunc('day', start_at at time zone 'UTC') at time zone 'UTC'
  and extract(hour from start_at at time zone 'America/Chicago') < 7
  and extract(hour from start_at at time zone 'UTC') between 7 and 23
order by start_at;

-- ════════════════════════════════════════════════════════════════════════
-- STEP 2 — APPLY (wrapped in a transaction; review counts, then COMMIT)
-- ════════════════════════════════════════════════════════════════════════
begin;

-- Class A: date-only-as-UTC → local all-day on the SAME calendar date.
update events
set end_at   = case when end_at is not null
                    then ((end_at at time zone 'UTC')::date::timestamp + interval '23 hours')
                         at time zone 'America/Chicago'
                    end,
    start_at = ((start_at at time zone 'UTC')::date::timestamp) at time zone 'America/Chicago',
    all_day  = true
where status in ('published','draft')
  and start_at = date_trunc('day', start_at at time zone 'UTC') at time zone 'UTC';

-- Class B: Z-noise times → re-read the UTC face as Central. end_at shifts by
-- the same delta so durations are preserved.
update events
set end_at   = end_at + (((start_at at time zone 'UTC') at time zone 'America/Chicago') - start_at),
    start_at = (start_at at time zone 'UTC') at time zone 'America/Chicago'
where status in ('published','draft')
  and start_at <> date_trunc('day', start_at at time zone 'UTC') at time zone 'UTC'
  and extract(hour from start_at at time zone 'America/Chicago') < 7
  and extract(hour from start_at at time zone 'UTC') between 7 and 23;

-- Row counts above should match the Step 1 previews. If they do:
commit;
-- (otherwise: rollback;)

-- ════════════════════════════════════════════════════════════════════════
-- STEP 3 — VERIFY (read-only)
-- ════════════════════════════════════════════════════════════════════════
-- The 0–6 AM bucket should now be empty (or only your noted genuine cases).
select extract(hour from start_at at time zone 'America/Chicago')::int as local_hour,
       count(*)
from events
where status in ('published','draft') and not all_day
group by 1 order by 1;

-- Spot-check the fair: should read its true date, all_day = true.
select title, all_day,
       to_char(start_at at time zone 'America/Chicago','YYYY-MM-DD HH24:MI') as starts
from events where title ilike '%ramsey county fair%';
