# Architecture

City Pulse MN is a Twin Cities events hub: a **Next.js website** (calendar + Mapbox map + filters) reading from a **Postgres database** that an **automated weekly pipeline** keeps populated.

## The one idea that holds it together

**The database is the boundary.** The pipeline only ever *writes* to Postgres. The website only ever *reads* from it. They never call each other. This means you can change agents, prompts, models, or the whole orchestrator without touching the site — and you can inspect/correct every event in between.

```
                      ┌──────────────────────── PIPELINE (weekly) ───────────────────────┐
                      │                                                                    │
  GitHub Actions ──►  orchestrator ──►  research agents ──►  normalize ──►  UPSERT          │
  (cron, weekly)      (run-pipeline)    (Claude + web        (geocode,      (dedup on        │
                      │                  search, 1/category)  price tier,    event_key)      │
                      │                                       event_key)        │            │
                      └───────────────────────────────────────────────────────┼────────────┘
                                                                               ▼
                                                                     ┌──────────────────┐
                                                                     │   Postgres       │
                                                                     │ (Supabase/Neon)  │
                                                                     │  events table    │
                                                                     │  status: draft / │
                                                                     │  published /     │
                                                                     │  archived        │
                                                                     └────────┬─────────┘
                                          auto-published (hide → draft) │  (read-only)
                                                                              ▼
                      ┌──────────────────────── WEBSITE ─────────────────────────────────┐
                      │  getEvents() ──►  Server Component ──►  EventsExplorer (client)     │
                      │  (published only)   (Next.js)            calendar · map · filters   │
                      └──────────────────────────────────────────────────────────────────┘
```

## Two halves, two trust levels

| | Pipeline (write side) | Website (read side) |
|---|---|---|
| Runs where | GitHub Actions (or Trigger.dev) | Vercel → citypulsemn.com |
| Cadence | Weekly cron | Every request (ISR, 5-min cache) |
| Secrets | `DATABASE_URL`, `ANTHROPIC_API_KEY`, Mapbox geocoding token | `DATABASE_URL` (server), `NEXT_PUBLIC_MAPBOX_TOKEN` (browser) |
| Writes? | Yes (drafts) | No |
| Dependencies | `@anthropic-ai/sdk`, `postgres` | `next`, `react`, `mapbox-gl`, `postgres` |

The website deploy never imports the agent or orchestration code, so the site's bundle and attack surface stay minimal.

## Where each piece lives

```
app/                      Website (Next.js App Router)
  page.tsx                Server Component — calls getEvents(), renders the explorer
  api/events/route.ts     JSON endpoint (read)
components/                Calendar, Map, filters, detail panels
lib/
  events.ts               READ boundary — Postgres → EventRecord (sample fallback)
  db.ts                   Postgres connection (provider-agnostic)
  event-key.ts            Dedup key + price-tier normalization  (tested)
  geocode.ts              Mapbox geocoding (address → lat/lng)
  upsert.ts               WRITE boundary — idempotent upsert + archive
  agents/
    research-agent.ts     One category subagent (Claude + web_search)
    prompts.ts            Per-category research prompts
  dates.ts                Calendar/window logic  (tested)
scripts/
  run-pipeline.ts         The orchestrator (the weekly job)
db/
  schema.sql              The database schema
.github/workflows/
  weekly-research.yml     Weekly cron that runs the pipeline
examples/trigger-alternative/   Optional Trigger.dev version of the pipeline
```

## Read the rest

- **[DATABASE.md](DATABASE.md)** — schema, the dedup key, lifecycle, time zones, provisioning.
- **[PIPELINE.md](PIPELINE.md)** — the weekly automation in detail, agents, auto-publish & hiding, the Trigger.dev alternative.
- **[CONNECTORS-AND-TOOLS.md](CONNECTORS-AND-TOOLS.md)** — every external service, env var, and where to get each key.
- **[SETUP.md](SETUP.md)** — end-to-end runbook to go live.
