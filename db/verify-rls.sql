-- Verify Row Level Security (roadmap 1.6) — run in the Supabase SQL Editor.
-- In the SQL Editor you're a privileged role, so we use `set role anon` to
-- simulate what the public REST API (anon key) can see, then reset.

-- 0a) THE ENUMERATING CHECK — run this one first, and before any release that
-- adds a table. Every check below names its tables literally, which is exactly
-- how `referrer_stats`, `model_spend` and `venue_coords` sat unsealed until
-- Supabase reported them on 25 Oct 2026: a table nobody remembered was a table
-- nobody checked. This asks the database for the set instead of trusting a list.
select c.relname as table_without_rls
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity
order by 1;
-- expect: zero rows. Anything listed is readable AND writable through the
-- public REST API with the anon key — including a DELETE with no filter.

-- 0) Confirm RLS is enabled and the policy exists.
select relname, relrowsecurity as rls_enabled
from pg_class where relname in ('events','pipeline_runs','admin_audit');

select polname, polcmd, roles::regrole[] as roles
from pg_policy where polrelid = 'events'::regclass;

-- 1) As the site/pipeline (your normal role): you see every status.
select status, count(*) from events group by status order by status;

-- 2) As the public API role (anon): ONLY published rows are visible.
set role anon;
select status, count(*) from events group by status order by status;   -- expect: published only
select count(*) as visible_drafts from events where status = 'draft';   -- expect: 0
reset role;

-- 3) Admin/observability tables are fully sealed from anon.
set role anon;
select count(*) as audit_rows_visible_to_anon from admin_audit;         -- expect: 0
select count(*) as run_rows_visible_to_anon   from pipeline_runs;       -- expect: 0
-- Reports carry a reporter's email and unverified claims about live listings —
-- it must be as sealed as the audit log.
select count(*) as report_rows_visible_to_anon from event_reports;      -- expect: 0
reset role;

-- If step 2 shows only 'published' and steps 2/3 show 0 for drafts/admin,
-- RLS is working. Your app is unaffected because it connects as the table
-- owner (via DATABASE_URL), which bypasses RLS.
