# The Weekly Pipeline

How events get researched and written every week, fully automated. Code: [`scripts/run-pipeline.ts`](../scripts/run-pipeline.ts) (orchestrator), [`lib/agents/`](../lib/agents) (agents), [`lib/upsert.ts`](../lib/upsert.ts) (write).

## What runs it

**Primary: GitHub Actions** ([`.github/workflows/weekly-research.yml`](../.github/workflows/weekly-research.yml)).
A weekly cron (Mondays 06:00 UTC) checks out the repo, installs deps, and runs `npm run pipeline`. Why Actions for this job:
- A multi-category research run takes minutes; **serverless functions cap out at ~10–60s**, so a Vercel cron route would time out. Actions has a generous job timeout.
- Zero extra services and **no added runtime dependencies** — it just runs the same script you can run locally.
- Free for this cadence.

You can also trigger it on demand from the Actions tab (`workflow_dispatch`).

**Optional: Trigger.dev** ([`examples/trigger-alternative/`](../examples/trigger-alternative)).
Graduate to this when you want durable multi-step execution, automatic retries, run-level observability, or **human-in-the-loop approval** (its v4 waitpoints can pause a run until you approve drafts). It's the same logic as a scheduled task. Note: the Trigger.dev SDK brings OpenTelemetry/telemetry transitive dependencies with their own advisories; those run on Trigger.dev's infrastructure and are intentionally **not** installed in the default project, which is why this lives under `examples/`.

## The flow, step by step

```
run-pipeline.ts
  └─ for each category (music, sports, family, arts, food, weird, festival):
       1. researchCategory()   → Claude (Sonnet) + web_search → raw events (JSON)
       2. geocode()            → Mapbox: address → lat/lng  (skip if it fails)
       3. computeEventKey()    → stable dedup id
       4. normalizeTier()      → Free / $ / $$ / $$$
       5. upsertEvents()       → INSERT … ON CONFLICT (event_key) DO UPDATE, status=draft
  └─ archivePastEvents()       → published events that have ended → archived
```

### 1. Research agents (the "Sonnet executes" half)

One subagent per category (`lib/agents/research-agent.ts`). Each calls **Claude Sonnet** with the **`web_search` tool** and a category-specific prompt (`lib/agents/prompts.ts`) that lists good local sources and the exact fields to return. The agent does the searching and returns a JSON array of events. The orchestrator (`run-pipeline.ts`) is the "Opus plans" half — it fans out, normalizes, and writes.

The prompts steer each agent at the right sources. The **weird** category is the differentiator and the hardest to automate — its prompt leans on venue Instagrams and neighborhood newsletters rather than APIs.

### 2. Normalize

- **Geocode** every address to coordinates (`geocode()`); events that can't be geocoded are skipped (they can't be mapped). Geocoding is server-side only.
- **Dedup key** from normalized title + venue + start date.
- **Price tier** inferred from the price string.

### 3. Upsert (idempotent)

`upsertEvents()` writes a batch with `ON CONFLICT (event_key) DO UPDATE`. A re-found event updates in place — **no duplicates across weekly runs**. New events land as `status = 'draft'`. Status is left untouched on update, so already-published events stay published.

### 4. Archive

`archivePastEvents()` moves ended `published` events to `archived`. History is kept; nothing is deleted.

## The review gate

The pipeline writes **drafts**. You decide what goes live by flipping `draft → published` (Supabase Table Editor or a quick SQL update — see [DATABASE.md](DATABASE.md)). This is what keeps City Pulse a curated brand instead of an algorithmic firehose. If you'd rather it be fully hands-off, change `status: "draft"` to `"published"` in `scripts/run-pipeline.ts` — but you lose the editorial gate.

## Tuning

- **Cadence / window:** change the cron in the workflow and `LOOKAHEAD_DAYS` in `run-pipeline.ts` (default: next 14 days).
- **Model:** set in `lib/agents/research-agent.ts` (default `claude-sonnet-4-6`).
- **Search breadth:** `max_uses` on the web_search tool.
- **Resilience:** a single category failing is logged and skipped; the run continues.

## Cost & observability

- Cost per run ≈ (7 agents × Claude tokens incl. web search) + geocoding calls. Weekly cadence keeps this small; widen the window or cadence to trade cost for freshness.
- GitHub Actions gives you per-run logs. Trigger.dev adds step-level observability and retries if you adopt it.

## Run it locally

```bash
# .env.local must have DATABASE_URL, ANTHROPIC_API_KEY, and a Mapbox token
npm run pipeline
```
