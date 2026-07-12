# City Pulse MN

A hub for everything happening across the Twin Cities metro — both downtowns plus all first- and second-ring suburbs (Plymouth, Maple Grove, Bloomington, Edina, Woodbury, and the rest). A **calendar**, a **Mapbox** map, **category filters** (music, sports, family, arts, food, unique, festival), live text search, full event detail, and shareable event/day pages, in the City Pulse MN brand. Privacy-friendly analytics (Vercel). Password-protected admin dashboard. Row-level-security hardened. Weekly Instagram content generator. Email capture with owned subscriber list. Add-to-calendar (.ics + Google). Price & area filters. Curated collection landing pages. Weekly email digest. Community event submissions with admin moderation. Saved events (per-visitor list, no login). Content-based event classification. Venue-anchored discovery. Responsive — tuned for laptop and phone. SEO-ready: schema.org event data, sitemap, and branded share cards.

Live at **[citypulsemn.com](https://citypulsemn.com)** — hosted on Vercel, with the GoDaddy-registered domain pointed at it.

Events are kept fresh by an **automated weekly pipeline**: AI research agents find events, normalize and geocode them, and upsert them into **Postgres**; the website reads published rows. The database is the boundary between the two — see **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

## Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript** — website
- **Postgres** (Supabase or Neon) — events database
- **Mapbox GL** — map (client) + geocoding (server)
- **Anthropic Claude** (`@anthropic-ai/sdk`) — research agents with web search
- **GitHub Actions** — weekly cron (Trigger.dev optional alternative)
- Deploy: **Vercel** (domain **citypulsemn.com** via GoDaddy DNS)

## Quickstart

```bash
npm install
npm run dev          # http://localhost:3000  (runs on bundled sample data)
```

Add `DATABASE_URL` and Mapbox/Anthropic keys to go live. Full path: **[docs/SETUP.md](docs/SETUP.md)**.

## Scripts

```bash
npm run dev        # website (dev)
npm run build      # type-check + build the site
npm test           # unit tests (25): window logic, dedup key, price tiering
npm run pipeline   # run the weekly research pipeline once (needs env)
```

## Documentation

| Doc | What's in it |
|---|---|
| **[DEPLOY-WALKTHROUGH.md](docs/DEPLOY-WALKTHROUGH.md)** | The friendly, detailed, no-experience-assumed version — every concept and click explained |
| **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** | System overview, the master flow diagram, where everything lives |
| **[DATABASE.md](docs/DATABASE.md)** | Schema, the dedup key, lifecycle, time zones, provisioning Supabase/Neon |
| **[PIPELINE.md](docs/PIPELINE.md)** | The weekly automation: agents, normalize, upsert, auto-publish & hiding, scheduling |
| **[CONNECTORS-AND-TOOLS.md](docs/CONNECTORS-AND-TOOLS.md)** | Every external service, env var, and where to get each key |
| **[SETUP.md](docs/SETUP.md)** | Zero-to-live runbook with a verify checklist and troubleshooting |

## Project structure

```
app/                    Website (Next.js App Router)
components/              Calendar, map, filters, detail panels
lib/
  events.ts             READ boundary (Postgres → EventRecord, sample fallback)
  db.ts                 Postgres connection (Supabase/Neon)
  event-key.ts          Dedup key + price tiering        (tested)
  geocode.ts            Mapbox geocoding
  upsert.ts             WRITE boundary (idempotent upsert + archive)
  agents/               Research subagents (Claude + web_search) + prompts
  dates.ts              Calendar/window logic             (tested)
scripts/run-pipeline.ts The weekly orchestrator
db/schema.sql           Database schema
.github/workflows/      Weekly cron
examples/trigger-alternative/   Optional Trigger.dev version of the pipeline
```

## Environment

See [`.env.example`](.env.example). Website needs `DATABASE_URL` + `NEXT_PUBLIC_MAPBOX_TOKEN`; the pipeline also needs `ANTHROPIC_API_KEY` + a Mapbox geocoding token. Full matrix in [CONNECTORS-AND-TOOLS.md](docs/CONNECTORS-AND-TOOLS.md).
