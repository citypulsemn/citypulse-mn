-- Moderating events (auto-publish model).
--
-- New events go live automatically. Use these to HIDE something after the fact
-- (revert to draft) or bring it back. Hiding is durable: because status is
-- sticky on update, the weekly pipeline will NOT republish an event you've
-- moved to 'draft'. Run these in the Supabase SQL Editor (or use the Table
-- Editor to flip the status cell).

-- Hide one event from the site (revert to draft):
update events set status = 'draft' where id = '<event-id>';

-- Bring a hidden event back live:
update events set status = 'published' where id = '<event-id>';

-- Hide by match (e.g. a venue or title you don't want to feature):
-- update events set status = 'draft'
-- where status = 'published' and venue ilike '%some venue%';

-- See what you've hidden:
select id, title, venue, start_at
from events
where status = 'draft'
order by start_at;

-- Quick health check: how many events are live vs hidden vs archived?
select status, count(*) from events group by status order by status;
