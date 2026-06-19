-- Near-duplicate REVIEW query (dedup Layer 3).
--
-- Surfaces pairs of events on the same day with very similar titles, so you can
-- eyeball them in the Supabase Table Editor and delete the loser. This NEVER
-- merges anything — deterministic canonicalization (lib/canonicalize.ts) already
-- collapsed the clear cases at write time; this catches the ambiguous ones
-- (e.g. "Twins vs Yankees" vs "Minnesota Twins vs New York Yankees") that should
-- be a human decision.
--
-- Requires: create extension if not exists pg_trgm;  (already in schema.sql)
-- Run it before a publishing session. Tune the 0.45 threshold to taste
-- (higher = stricter = fewer pairs).

select
  a.id           as id_a,
  b.id           as id_b,
  a.title        as title_a,
  b.title        as title_b,
  a.venue        as venue_a,
  b.venue        as venue_b,
  a.start_at::date as day,
  round(similarity(a.title, b.title)::numeric, 2) as title_score,
  a.status       as status_a,
  b.status       as status_b
from events a
join events b
  on a.id < b.id                                  -- each pair once, no self-match
 and a.start_at::date = b.start_at::date          -- same calendar day
 and similarity(a.title, b.title) > 0.45          -- similar titles
where a.status <> 'archived' and b.status <> 'archived'
  and (a.status = 'draft' or b.status = 'draft')  -- at least one still unreviewed
order by title_score desc, day;

-- Optional stronger signal: also require the two events be physically close
-- (same building, different spelling). Add this to the WHERE above:
--
--   and (
--     6371000 * acos(
--       greatest(-1, least(1,
--         cos(radians(a.lat)) * cos(radians(b.lat)) *
--         cos(radians(b.lng) - radians(a.lng)) +
--         sin(radians(a.lat)) * sin(radians(b.lat))
--       ))
--     )
--   ) < 75            -- meters apart
