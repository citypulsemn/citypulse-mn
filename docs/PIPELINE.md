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
Graduate to this when you want durable multi-step execution, automatic retries, run-level observability, or **human-in-the-loop approval** (its v4 waitpoints can pause a run until you approve a step). It's the same logic as a scheduled task. Note: the Trigger.dev SDK brings OpenTelemetry/telemetry transitive dependencies with their own advisories; those run on Trigger.dev's infrastructure and are intentionally **not** installed in the default project, which is why this lives under `examples/`.

## The flow, step by step

```
run-pipeline.ts
  └─ for each horizon BAND due this week (near / mid / far):
       └─ for each category (music, sports, family, arts, food, weird, festival):
            1. researchCategory()   → Claude (Sonnet) + web_search → raw events (JSON)
            2. geocode()            → Mapbox: address → lat/lng  (skip if it fails)
            3. computeEventKey()    → stable dedup id
            4. normalizeTier()      → Free / $ / $$ / $$$
            5. upsertEvents()       → dedupe batch, then INSERT … ON CONFLICT DO UPDATE, status=published
       └─ markCancelled()           → events the agent flagged cancelled → status=cancelled
  └─ archivePastEvents()            → published events that have ended → archived
```

### 0. The research horizon (how far ahead, how hard)

Defined in `lib/horizon.ts`. Instead of one flat look-ahead, the pipeline researches in **bands**, so the calendar fills months out *and* the near term stays accurate:

| Band | Window | Depth | Cadence |
|---|---|---|---|
| near | next 0–30 days | deepest (8 searches) | every run |
| mid | 31–60 days | medium (7) | every run |
| far | 61–92 days | lighter (6) | every run |

The windows **slide forward every week** and all three run **every** week, so the full ~3-month calendar is refreshed and "filled in" continuously: far-out events are re-found and enriched as they move into the nearer, deeper bands. Coverage spans the whole metro — both downtowns plus all first- and second-ring suburbs (Plymouth, Maple Grove, Champlin, Bloomington, Edina, Eden Prairie, Woodbury, Eagan, and the rest). Edit the `HORIZON` array to change ranges or depth; the website needs no change (it already shows whatever future months hold events).

### 1. Research agents (the "Sonnet executes" half)

One subagent per category (`lib/agents/research-agent.ts`). Each calls **Claude Sonnet** with the **`web_search` tool** and a category-specific prompt (`lib/agents/prompts.ts`) that lists good local sources and the exact fields to return. The agent does the searching and returns a JSON array of events. The orchestrator (`run-pipeline.ts`) is the "Opus plans" half — it fans out, normalizes, and writes.

The prompts steer each agent at the right sources. The **Unique** category (internally keyed `weird`) is the differentiator and the hardest to automate — its prompt leans on venue Instagrams and neighborhood newsletters rather than APIs.

### 2. Normalize

- **Geocode** every address to coordinates (`geocode()`); events that can't be geocoded are skipped (they can't be mapped). Geocoding is server-side only.
- **Dedup key** from normalized title + venue + start date.
- **Price tier** inferred from the price string.

### 3. Upsert (idempotent)

`upsertEvents()` writes a batch with `ON CONFLICT (event_key) DO UPDATE`. A re-found event updates in place — **no duplicates across weekly runs**. New events land as `status = 'draft'`. Status is left untouched on update, so already-published events stay published.

### 4. Changes, cancellations, and archive

- **Changed events** are updated in place on re-find (same dedup key → the upsert refreshes time, price, description, etc.). One caveat: if an event's **date** moves, the key changes, so the new date is added and the old entry falls off on its own when that original date passes.
- **Cancellations**: when an agent confirms a previously-listed event was called off, it returns it with `"cancelled": true`. The pipeline flips the matching row to `status = 'cancelled'` (via `markCancelled`), which removes it from the site even if it was published.
- `archivePastEvents()` moves ended `published` events to `archived`. History is kept; nothing is hard-deleted.

## Publishing (auto-publish, opt-out hide)

New events go live **automatically** — the pipeline writes them as `published`, set by the single policy constant `NEW_EVENT_STATUS` in `lib/pipeline-config.ts`. There's no pre-review step.

To pull an event from the site, move it to **`draft`** (Supabase Table Editor, or the snippets in `db/moderate-events.sql`). Because status is **sticky on update**, that's durable: the weekly pipeline never republishes an event you've hidden — the on-conflict UPDATE leaves your status alone. Set it back to `published` any time to restore it.

If you ever want the old review gate (nothing goes live until you approve it), flip `NEW_EVENT_STATUS` to `"draft"` — one line, and new events arrive hidden for you to publish by hand.

## Tuning

- **Horizon (how far ahead / how deep / how often):** edit the `HORIZON` bands in `lib/horizon.ts`. Widen `far` to fill more of the calendar; raise a band's `everyNWeeks` to run it less often and save cost.
- **Cadence of the whole run:** the cron in the workflow (default weekly).
- **Model:** set in `lib/agents/research-agent.ts` (default `claude-sonnet-4-6`).
- **Search breadth:** each band's `maxSearchUses` (passed through to the web_search tool).
- **Resilience:** a single category failing is logged and skipped; the run continues.

## Cost & observability

- Cost per run ≈ (7 categories × 3 bands) Claude calls incl. web search, + geocoding — so ~21 agent calls every week now that all bands run weekly and reach ~3 months out. That's the cost of comprehensive, always-fresh coverage; narrow the bands or raise a band's `everyNWeeks` in `lib/horizon.ts` to trade freshness for cost.
- GitHub Actions gives you per-run logs (now grouped by band). Trigger.dev adds step-level observability and retries if you adopt it.

## Run it locally

```bash
# .env.local must have DATABASE_URL, ANTHROPIC_API_KEY, and a Mapbox token
npm run pipeline
```

## Classification (roadmap 4.1)

The category an event ends up with is **not** the category of the agent that found it. After research and geocoding, every event runs through `lib/classify.ts`, which decides the category from the event's own title/venue/description. The pipeline logs each correction and reports a `reclassified` count. See `docs/CLASSIFICATION.md`.

## Venue-anchored sweeps (roadmap 4.2)

For fragmented categories (music, family), the near-band run also shards `lib/venues.ts` across sub-agents that walk named venue calendars directly — a generic search budget can't cover a city's club calendars. Sweeps are additive to the generic agent; dedup on `event_key` collapses overlap. See `docs/VENUES.md`.
