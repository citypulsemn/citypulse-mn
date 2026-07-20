-- City Pulse MN — TIME BACKFILL, STAGE 2: the systematic shift
--
-- WHAT YOUR HISTOGRAM SHOWED: zero events after 5 PM. A Twin Cities calendar
-- with no evening concerts, games, or theater is impossible — the whole timed
-- calendar is displaced ~5 hours early. The 195-event "2 PM" spike is your
-- 7 PM shows. (Every well-formed local time was read as UTC at insert; and the
-- July 13 pipeline run, on the old code, re-stamped raw times onto everything
-- it re-found.)
--
-- THE REPAIR: same inverse transform as stage 1 — re-read the stored UTC clock
-- face as America/Chicago — applied to the REST of the timed calendar, with
-- two protections:
--   • rows stage 1 already repaired today are excluded (updated_at cutoff);
--   • the shift only applies when the resulting hour is plausible (7 AM–11 PM),
--     which also naturally protects correctly-stored evening events.
--
-- Run the steps in order in the Supabase SQL Editor.

-- ════════════════════════════════════════════════════════════════════════
-- STEP 0a — SAFETY CHECK: approved community submissions (read-only).
-- These were stored with CORRECT times; if any exist I must exclude them by
-- title. Expected: 0. If > 0 → STOP and paste me this output.
-- ════════════════════════════════════════════════════════════════════════
select count(*) as approved_submissions,
       coalesce(string_agg(title, ' | '), '(none)') as titles
from event_submissions
where status = 'approved';

-- ════════════════════════════════════════════════════════════════════════
-- STEP 0b — PREVIEW the shift (read-only). Spot-check will_become times:
-- concerts should land at 7–9 PM, markets at 8–11 AM, ball games 6:40–7:10 PM.
-- ════════════════════════════════════════════════════════════════════════
select count(*) as rows_to_shift
from events
where status in ('published','draft')
  and not all_day
  and updated_at < now() - interval '6 hours'
  and extract(hour from start_at at time zone 'UTC') between 7 and 23;

select id, title, category,
       to_char(start_at at time zone 'America/Chicago','Dy YYYY-MM-DD HH24:MI') as shows_now,
       to_char(start_at at time zone 'UTC','Dy YYYY-MM-DD HH24:MI') as will_become
from events
where status in ('published','draft')
  and not all_day
  and updated_at < now() - interval '6 hours'
  and extract(hour from start_at at time zone 'UTC') between 7 and 23
order by start_at
limit 40;

-- ════════════════════════════════════════════════════════════════════════
-- STEP 0c — the 7 stragglers at 1 AM (read-only). The transform would leave
-- them at 6 AM (still improbable), so they are NOT auto-shifted. Paste me
-- these titles and I'll tell you what each should be.
-- ════════════════════════════════════════════════════════════════════════
select id, title, category,
       to_char(start_at at time zone 'America/Chicago','Dy YYYY-MM-DD HH24:MI') as shows_now
from events
where status in ('published','draft') and not all_day
  and extract(hour from start_at at time zone 'America/Chicago') < 7
order by start_at;

-- ════════════════════════════════════════════════════════════════════════
-- STEP 1 — APPLY (transaction; the row count must match Step 0b's count)
-- ════════════════════════════════════════════════════════════════════════
begin;

update events
set end_at   = end_at + (((start_at at time zone 'UTC') at time zone 'America/Chicago') - start_at),
    start_at = (start_at at time zone 'UTC') at time zone 'America/Chicago'
where status in ('published','draft')
  and not all_day
  and updated_at < now() - interval '6 hours'
  and extract(hour from start_at at time zone 'UTC') between 7 and 23;

commit;
-- (rollback; instead if the count surprised you)

-- ════════════════════════════════════════════════════════════════════════
-- STEP 2 — VERIFY (read-only). Expect: real evening mass at 17–21, morning
-- mass at 8–11, and only the Step-0c stragglers below 7.
-- ════════════════════════════════════════════════════════════════════════
select extract(hour from start_at at time zone 'America/Chicago')::int as local_hour,
       count(*)
from events
where status in ('published','draft') and not all_day
group by 1 order by 1;
