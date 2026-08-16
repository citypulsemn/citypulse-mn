# Deploy — trim the GitHub Actions footprint (precaution)

*Aug 15, 2026. The tarenmccullough account hit 90% of its 2,000 free Actions
minutes. This repo's 4 workflows are lean (~350–400 min/month, all `ubuntu-latest`
= 1× billing, all weekly cron), so these are safe hygiene tweaks — the meaningful
levers are below.*

## What changed (all 4 workflows)

- **`npm ci --prefer-offline --no-audit --no-fund`** — uses the restored npm cache
  and skips the audit/fund network+noise steps we don't need in CI. Small per-run
  saving (~5–20s each).
- **`concurrency` groups** (`cancel-in-progress: false`) — never run two of the same
  workflow at once. A manual `workflow_dispatch` overlapping a scheduled run would
  otherwise double-spend minutes (and, for the pipeline, race the same DB writes).
  Queues the second run instead.

No behavior change to what the workflows *do*. Config-only (YAML), no app code.

## Honest impact + the real levers

The internal trims save only **~5–15 min/month** — the ~350–400 min this repo spends
is mostly the **inherent ~40-min weekly research pipeline** (Anthropic API calls),
which is the point of the site and shouldn't be cut.

**The two levers that actually move the number:**
1. **Make this repo public** (if comfortable — it's a public events site; secrets
   live in GitHub Secrets, not the code). Public repos get **unlimited** Actions
   minutes on standard runners → this repo's entire ~350–400 min/month contribution
   goes to **zero**. One-click owner action (Settings → change visibility).
2. **Reduce cron frequency** — a product/ops call, not applied here:
   - `verify-events` (weekly, ~90 min/mo) → bi-weekly halves it, at the cost of a
     mid-week cancellation possibly sitting a few extra days.
   - `weekly-research` / `weekly-digest` are core (data refresh + the retention
     email) — leave weekly.

## Diagnostic still owner-side

I can't see the per-repo Actions breakdown (no `gh` CLI here). GitHub → Settings →
Billing → Plans and usage → Actions shows minutes per repository — that reveals
whether citypulse-mn is even the culprit (likely a minority; the 90% is account-wide
across all private repos).

## Verification

- All 4 workflows: valid YAML (`name → on → concurrency → jobs`), concurrency at
  top level, npm ci flags applied. Exercised on their next scheduled run.
