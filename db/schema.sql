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
  -- auto-published (set by the pipeline). Move an event to 'draft' to hide it.
  status        text not null default 'published' check (status in
                  ('draft','published','archived')),

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
