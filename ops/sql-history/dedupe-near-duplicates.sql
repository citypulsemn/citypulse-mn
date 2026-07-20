-- Collapse near-duplicate events that are ALREADY in your database.
-- (The pipeline now does this automatically on every run via
-- dedupeNearDuplicates(); use this to clean up immediately without waiting.)
--
-- Rule: two live events on the SAME day, within ~250m of each other, with
-- similar titles are the same event. Keep the earliest-seen row; archive the
-- rest (recoverable — nothing is deleted). Requires the pg_trgm extension,
-- which db/schema.sql enables.

-- 1) PREVIEW what would be collapsed (run this first to sanity-check):
select a.id as keep_id, b.id as archive_id,
       a.title as keep_title, b.title as archive_title,
       a.venue as keep_venue, b.venue as archive_venue,
       round(similarity(a.title, b.title)::numeric, 2) as title_sim
from events a
join events b
  on a.id < b.id
 and a.status in ('published','draft')
 and b.status in ('published','draft')
 and a.start_at::date = b.start_at::date
 and similarity(a.title, b.title) > 0.6
 and (6371000 * acos(greatest(-1, least(1,
       cos(radians(a.lat)) * cos(radians(b.lat)) * cos(radians(b.lng) - radians(a.lng))
       + sin(radians(a.lat)) * sin(radians(b.lat))
     ))) < 250)
order by a.start_at;

-- 2) APPLY it (archive the duplicate copies):
with extras as (
  select b.id as dup_id
  from events a
  join events b
    on a.id < b.id
   and a.status in ('published','draft')
   and b.status in ('published','draft')
   and a.start_at::date = b.start_at::date
   and similarity(a.title, b.title) > 0.6
   and (6371000 * acos(greatest(-1, least(1,
         cos(radians(a.lat)) * cos(radians(b.lat)) * cos(radians(b.lng) - radians(a.lng))
         + sin(radians(a.lat)) * sin(radians(b.lat))
       ))) < 250)
)
update events set status = 'archived'
where id in (select dup_id from extras)
  and status in ('published','draft');
