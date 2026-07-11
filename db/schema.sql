-- City Pulse MN — events database schema
-- Standard Postgres 14+. Runs as-is on Supabase, Neon, or any Postgres.
-- Apply with:  psql "$DATABASE_URL" -f db/schema.sql
-- (or paste into the Supabase SQL editor / Neon SQL console)

create extension if not exists pgcrypto;   -- gen_random_uuid()

create table if not exists events (
  id            uuid primary key default gen_random_uuid(),

  -- Deterministic dedup key = sha256(normalized title | venue | start_date).
  -- The same event re-found in a later run produces the SAME key, so weekly
  -- runs UPSERT in place instead of creating duplicates.
  event_key     text not null unique,

  title         text not null,
  category      text not null check (category in
                  ('music','sports','family','arts','food','weird','festival')),
  venue         text not null default '',
  address       text not null default '',
  city          text not null default '',
  lat           double precision not null,
  lng           double precision not null,
  start_at      timestamptz not null,
  end_at        timestamptz,
  price         text not null default 'See listing',
  price_tier    text not null default '$$' check (price_tier in ('Free','$','$$','$$$')),
  ticket_url    text not null default '',
  description   text not null default '',
  image         text not null default '',
  source_url    text not null default '',

  -- Visibility: the site serves ONLY status='published'. New events are
  -- auto-published (set by the pipeline). Move an event to 'draft' to hide it;
  -- the pipeline sets 'cancelled' when a source confirms a cancellation.
  status        text not null default 'published' check (status in
                  ('draft','published','archived','cancelled')),

  -- Lifecycle bookkeeping.
  last_seen_at  timestamptz not null default now(),  -- last run that re-found it
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Hot-path indexes for the site and the pipeline.
create index if not exists idx_events_status_start on events (status, start_at);
create index if not exists idx_events_category     on events (category);
create index if not exists idx_events_start        on events (start_at);
-- Bounding-box map queries without requiring PostGIS.
create index if not exists idx_events_lat on events (lat);
create index if not exists idx_events_lng on events (lng);

-- Keep updated_at current on every write.
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_events_updated_at on events;
create trigger trg_events_updated_at
  before update on events
  for each row execute function set_updated_at();

-- For databases created before auto-publish: make the default 'published' too.
-- (Idempotent; safe to re-run. Does not change existing rows.)
alter table events alter column status set default 'published';

-- For databases created before cancellations: widen the status CHECK to allow
-- 'cancelled'. (Idempotent; drops and re-adds the constraint.)
alter table events drop constraint if exists events_status_check;
alter table events add constraint events_status_check
  check (status in ('draft','published','archived','cancelled'));

-- Convenience view = exactly what the website reads.
create or replace view published_events as
  select * from events
  where status = 'published'
  order by start_at;

-- ──────────────────────────────────────────────────────────────────────────
-- Fuzzy near-duplicate review (dedup Layer 3). Trigram similarity lets you
-- SURFACE likely-duplicate drafts for a human to resolve — it never merges
-- anything automatically. See db/review-duplicates.sql for the query.
create extension if not exists pg_trgm;
create index if not exists idx_events_title_trgm on events using gin (title gin_trgm_ops);
-- ──────────────────────────────────────────────────────────────────────────

-- ──────────────────────────────────────────────────────────────────────────
-- OPTIONAL: PostGIS upgrade for true geospatial queries (Supabase ships it).
-- Uncomment to enable radius / nearest-neighbor searches.
--
-- create extension if not exists postgis;
-- alter table events add column if not exists geom geography(Point, 4326);
-- update events set geom = st_setsrid(st_makepoint(lng, lat), 4326)::geography;
-- create index if not exists idx_events_geom on events using gist (geom);
-- ──────────────────────────────────────────────────────────────────────────

-- ---------------------------------------------------------------------------
-- Admin & observability (roadmap 1.5)
-- ---------------------------------------------------------------------------

-- One row per weekly pipeline run — powers the admin "Pipeline" health tab.
create table if not exists pipeline_runs (
  id           bigint generated always as identity primary key,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  ok           boolean not null default false,
  upserted     int not null default 0,
  cancelled    int not null default 0,
  archived     int not null default 0,
  collapsed    int not null default 0,
  bands        jsonb,
  error        text
);
create index if not exists idx_pipeline_runs_started on pipeline_runs (started_at desc);

-- Audit trail for every admin mutation (who=admin, what, when).
create table if not exists admin_audit (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  action     text not null,
  event_id   uuid,
  patch      jsonb
);
create index if not exists idx_admin_audit_at on admin_audit (at desc);

-- These tables are never public. Enable RLS with no anon policy; the app reaches
-- them only through the service DATABASE_URL connection (which bypasses RLS).
alter table pipeline_runs enable row level security;
alter table admin_audit  enable row level security;

-- ---------------------------------------------------------------------------
-- Row Level Security on events (roadmap 1.6)
-- ---------------------------------------------------------------------------
-- The site and pipeline connect as the table OWNER via DATABASE_URL, which
-- BYPASSES RLS — so nothing about the public site or the admin panel changes
-- (the admin still reads drafts/cancelled/archived). RLS only governs Supabase's
-- auto-generated REST API roles (anon / authenticated): through that path only
-- PUBLISHED events are readable, and there is no write policy so that path is
-- read-only. Drafts, cancelled, and archived rows stay private.
--
-- (pipeline_runs and admin_audit already have RLS enabled with NO policy above,
-- which fully seals them from the anon/authenticated roles.)
--
-- Idempotent: enabling twice is a no-op; the policy is dropped and recreated.

alter table events enable row level security;

drop policy if exists events_public_read on events;
create policy events_public_read
  on events for select
  to anon, authenticated
  using (status = 'published');

-- ---------------------------------------------------------------------------
-- Email subscribers (roadmap 2.2)
-- ---------------------------------------------------------------------------
-- The owned audience. Emails are stored normalized (lowercased/trimmed) so the
-- UNIQUE constraint dedupes case variants. `status` supports a later double
-- opt-in + unsubscribe flow (Phase 3 digest); capture today is single opt-in.
create table if not exists subscribers (
  id              bigint generated always as identity primary key,
  email           text not null unique,
  source          text not null default 'site',
  status          text not null default 'subscribed'
                    check (status in ('subscribed','pending','unsubscribed')),
  created_at      timestamptz not null default now(),
  confirmed_at    timestamptz,
  unsubscribed_at timestamptz
);
create index if not exists idx_subscribers_created on subscribers (created_at desc);

-- PII → sealed from day one (roadmap 1.6 rule): RLS enabled, NO anon/authenticated
-- policy. The app reads/writes only through the owner DATABASE_URL connection,
-- which bypasses RLS. The public REST API can neither read nor write this table.
alter table subscribers enable row level security;

-- ── Weekly digest send log (roadmap 3.1) ──────────────────────────────────
-- Observability for the weekly email job. Sealed like other internal tables:
-- RLS enabled, NO anon/authenticated policy (owner connection only).
create table if not exists digest_sends (
  id          bigint generated always as identity primary key,
  sent_at     timestamptz not null default now(),
  recipients  int not null default 0,
  ok          boolean not null default true,
  note        text
);
create index if not exists idx_digest_sends_sent on digest_sends (sent_at desc);
alter table digest_sends enable row level security;

-- ── Community event submissions (roadmap 3.2) ─────────────────────────────
-- The public "Submit an event" form writes here (via a server action on the
-- owner connection). Nothing is published automatically: an admin reviews each
-- one and approves (creates a published event) or rejects. Sealed like other
-- internal tables — RLS on, NO anon policy — so the public REST API can neither
-- read nor write it; the moderated events table remains the only public source.
create table if not exists event_submissions (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  category       text not null check (category in
                   ('music','sports','family','arts','food','weird','festival')),
  venue          text not null default '',
  city           text not null default '',
  address        text not null default '',
  start_local    text not null,            -- "YYYY-MM-DDTHH:MM" Central wall-clock
  end_local      text,                     -- optional
  price          text not null default 'See listing',
  ticket_url     text not null default '',
  description    text not null default '',
  source_url     text not null default '',
  submitter_email text not null default '',
  status         text not null default 'pending'
                   check (status in ('pending','approved','rejected')),
  review_note    text,
  created_at     timestamptz not null default now(),
  reviewed_at    timestamptz
);
create index if not exists idx_submissions_status on event_submissions (status, created_at desc);
alter table event_submissions enable row level security;
