-- Verify the PER-USER RLS policy on saved_events (roadmap 3.3).
-- Run in the Supabase SQL Editor. `set role anon` simulates the public API role.

-- 0) RLS on + policy present.
select relname, relrowsecurity as rls_enabled from pg_class where relname = 'saved_events';
select polname, polcmd from pg_policy where polrelid = 'saved_events'::regclass;

-- 1) As the app (owner role): all rows, across all visitors.
select user_token, count(*) from saved_events group by user_token order by 1;

-- 2) As the public API role with NO token: the table is invisible.
set role anon;
select count(*) as rows_visible_without_token from saved_events;   -- expect: 0
reset role;

-- 3) Scoped to one visitor: only that visitor's rows.
--    (Replace the token with a real value from step 1 to try it.)
set role anon;
select set_config('request.saver_token', '<paste-a-user_token-here>', false);
select count(*) as rows_visible_for_that_visitor from saved_events;
select count(*) as other_visitors_rows_visible
  from saved_events
  where user_token <> current_setting('request.saver_token', true);  -- expect: 0

-- 4) Cross-user writes are refused.
delete from saved_events
  where user_token <> current_setting('request.saver_token', true);  -- expect: 0 rows
reset role;
select set_config('request.saver_token', '', false);

-- Verified locally against real Postgres (PGlite): with no token 0 rows are
-- visible; each visitor sees only their own saves; a visitor cannot delete
-- another's row (0 affected) and cannot insert one impersonating another
-- (blocked by the policy's WITH CHECK).
