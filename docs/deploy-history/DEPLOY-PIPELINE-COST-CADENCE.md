# Deploy — Pipeline cost pass: staggered band cadence + trimmed search budgets

*Aug 17, 2026. Config-only reduction of the weekly Anthropic API spend on the
research pipeline (levers #1 + #2 from the cost brainstorm). No logic changes, no
hit to the 0–30 day window users actually browse, one-line-per-band reversible.*

## The cost shape it targets
Each weekly run was ~31 Claude (Sonnet 4.6) + web-search calls: 21 generic
(7 categories × **3 bands, all run weekly**) + ~10 near-band venue sweeps, driving
~267 web searches/week. The waste: **far-out listings (61–92 days) barely change
week to week**, yet were fully re-researched every single week.

## What changed (config only)
- **Staggered band cadence** ([lib/horizon.ts](../../lib/horizon.ts)) — the
  `everyNWeeks` knob was already built and set to `1` everywhere. Now:
  - `near` (0–30d): **weekly** (unchanged — protects what's visible now).
  - `mid` (31–60d): **every 2 weeks**.
  - `far` (61–92d): **every 3 weeks**.
  Averaged generic calls drop **21 → ~13/week** (7 + 7/2 + 7/3). A given run is
  `near` only, `near+mid`, `near+far`, or all three, on a 6-week cycle.
- **Trimmed web-search budgets** — `mid` `maxSearchUses` 7→6, `far` 6→4
  ([lib/horizon.ts](../../lib/horizon.ts)); venue-sweep searches 12→10
  ([lib/pipeline-config.ts](../../lib/pipeline-config.ts), the biggest single
  search consumer). `near` stays at 8.

**Why it's safe:** idempotent upserts + sticky status mean a far-out event caught
on a far-band week is re-found and *enriched* as it slides into the more frequent
mid then near bands — and it's 2+ months out, so there's ample lead time. The
near band, the only one users browse right now, is untouched in both frequency and
depth. Any band dials back to `everyNWeeks: 1` in one line if a run looks thin.

## Estimated saving
Generic calls ~40% fewer on average, plus ~15–20% fewer searches on the calls that
do run — roughly a **35–45% cut** in the weekly pipeline API spend, and shorter
Actions runs (helps the separate 2,000-min budget). Exact figure reads back from
the Anthropic usage dashboard over the next few weeks.

## Verification
- Tests rewritten ([lib/__tests__/horizon.test.ts](../../lib/__tests__/horizon.test.ts)):
  date-math assertions made cadence-phase-independent (via an all-weekly view), plus
  a real cadence test over a full 6-week cycle — near every week, mid every 2nd,
  far every 3rd — and a guard that **near ALWAYS runs** (no week without a fresh
  0–30d pass) and that the 6-week total is 11 band-runs (~1.83/run).
- Gate: `tsc` clean · 1093/1093 · `npm run build` clean · `npm audit` 0.
- **Real proof is the Anthropic usage trend** over the next 2–3 runs; the coverage
  side is the ops-digest category counts holding steady.

## Deploy steps
Merge to `main`. Effect is on the **next weekly research run** (Actions reads the
repo at run time). No site deploy needed.

## Watch after deploy
- Anthropic usage/cost trend down (the point).
- Ops-digest coverage counts stay healthy — if a category goes thin because a
  band skipped, that's expected on the off-weeks; a *sustained* drop means dial the
  cadence back.

## What we did NOT do (deferred)
- **Model routing** (Haiku for stable categories like sports/family/arts) — the
  bigger lever (~25% more), but it needs a controlled run to confirm Haiku doesn't
  drop coverage. Left for after we read this pass's savings.
- **Prompt caching** — low impact here (web-search *result* tokens dominate and
  aren't cacheable; the shared prefix is small). Skipped.

## Rollback
`git revert`, or set the three bands back to `everyNWeeks: 1` and restore the
search budgets. No data or schema involved.
