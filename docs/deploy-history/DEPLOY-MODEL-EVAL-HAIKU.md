# Deploy — Model eval harness (validate Haiku routing)

*Aug 17, 2026. Cost-brainstorm lever #3: route the structured/stable research
categories (sports, family, arts) from Sonnet 4.6 to Haiku 4.5 — ~3× cheaper both
ways ($1/$5 vs $3/$15 per MTok). But a cheaper model that drops coverage is a bad
trade, so this ships the **validation harness first** (a controlled run), not the
routing. The `model` param it needs is exactly what real routing will use.*

## Why a harness, not a flip
Haiku for sports schedules and zoo/library listings is intuitively fine, but
"intuitively fine" isn't a coverage guarantee. The honest move is to run the
**same** research request on both models and measure how much of Sonnet's coverage
Haiku reproduces, per category, before trusting it in the weekly pipeline.

Grounded facts (from the claude-api reference) that make this a clean swap:
- Haiku 4.5 is `claude-haiku-4-5`; the research agent sets **no thinking and no
  effort**, so switching models is a pure string swap (no 400s, no adaptive-
  thinking concerns).
- The agent already uses the basic `web_search_20250305` tool variant — the
  correct one for Haiku-tier — so web search works unchanged.

## What shipped
- **`model` param on `researchCategory`** ([lib/agents/research-agent.ts](../../lib/agents/research-agent.ts))
  — optional, defaults to `RESEARCH_MODEL` (`claude-sonnet-4-6`), so the pipeline
  is byte-for-byte unchanged. This is the routing hook.
- **Pure comparison** ([lib/model-eval.ts](../../lib/model-eval.ts)) —
  `evalKey` (title+venue+day identity), `compareEventSets` (baseline vs candidate
  counts + **recall** = fraction of Sonnet's coverage Haiku reproduced), and
  `missedEvents` (what Haiku dropped — the qualitative signal). Golden-tested.
- **`scripts/model-eval.ts`** — runs Sonnet vs Haiku on the near window for each
  candidate category and prints a per-category verdict (✅ HOLDS at recall ≥ 80% and
  count ≥ 80% of baseline; ⚠️ DROPS COVERAGE otherwise) plus a sample of missed
  events. Read-only — **no DB writes, no send**.
- **Manual workflow** ([.github/workflows/model-eval.yml](../../.github/workflows/model-eval.yml))
  — `workflow_dispatch` with an optional `categories` input, runs `npm run
  model-eval` with `ANTHROPIC_API_KEY`.

## Verification
- Tests +7 (1100 total): `evalKey` folding + day-sensitivity; `compareEventSets`
  perfect/partial/extra/empty-baseline (no divide-by-zero); `missedEvents` dedup.
- The live two-model comparison runs only with the key (Actions) — the script
  degrades per-category (logs FAILED, continues) when unwired, verified locally.
- Gate: `tsc` clean · 1100/1100 · `npm run build` clean · `npm audit` 0.

## How to run it
**Actions → Model Eval → Run workflow** (optionally type categories, e.g. `sports
music`). It runs ~2 agent calls per category (a few $ total) and prints a block
like:

```
## SPORTS — ✅ HOLDS
   Sonnet 14 events · Haiku 13 events · both 12
   Haiku recall of Sonnet's coverage: 86% (missed 2, extra 1)
   Haiku missed (sample): …
```

Paste that back. **Decision rule:** a category that reads ✅ HOLDS is safe to route
to Haiku; ⚠️ DROPS COVERAGE stays on Sonnet. Then the routing itself is a one-line
change per category (pass `"claude-haiku-4-5"` to `researchCategory` for the
approved categories in `scripts/run-pipeline.ts`) — shipped as a follow-up once the
eval confirms which categories qualify.

## Rollback
`git revert`. The `model` param defaults to Sonnet, so nothing about the pipeline
changes; the script + workflow are additive and read-only.
