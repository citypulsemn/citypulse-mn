# Deploy — stampede tripwire: rolling baseline (robust + growth-proof)

*August 2026. Not a roadmap item — a hardening pass on the pipeline's R0.2
safeguard. Supersedes the single-prior-run spike check from
[DEPLOY-STAMPEDE-RECAL.md](DEPLOY-STAMPEDE-RECAL.md).*

## Context — this was already spike-based, not broken

The earlier recal (early Aug) had already replaced the original fixed
`archived > 100` with a spike test (≥2.5× the *previous* run, above a floor, plus
an absolute ceiling). That fix works — the real Aug 3 run (115 archived vs 94)
does **not** trip it. So this change is a *robustness* upgrade, not a bug fix.

## The two weaknesses this addresses

1. **A single prior run is a fragile baseline.** If last week was anomalously
   *low* — a partial run that archived almost nothing — this week's perfectly
   normal count looks like a multiple of it and false-alarms. If last week was
   anomalously *high*, it masks a real spike this week.
2. **The absolute ceiling (250) is itself a fixed number** — the same class of
   thing that went stale at 100. As the calendar grows it will eventually cry
   wolf on a healthy week.

## The fix — a rolling baseline of the busiest recent week

`isStampede` now compares each stage to the **max of the last N=4 successful
runs** ([lib/ops-digest.ts](../../lib/ops-digest.ts)):

- **With a baseline** → purely **relative**: above the floor *and* ≥ **2.0×** the
  busiest recent week. No fixed number, so it can't go stale as the calendar
  grows.
- **No baseline** (first-ever run) → the absolute ceiling is the only backstop.

The multiplier drops from 2.5× to **2.0×** (catches a doubling / a big
categorical over-archive) — affordable now because the baseline is robust.

### Why max, not median (caught in verification)

My first cut used the **median** of the recent window. The dry-run immediately
flagged it: during the growth phase the 4-run window reaches back to the smaller
early weeks (52, ~40s), so the median lags *below* the current level and the
healthy 115 tripped a false alarm. The **max** tracks the recent high instead —
so organic growth stays quiet — while still ignoring a lone low-outlier week
(the robustness win over a single-prior baseline). Fixed before commit.

### What this does NOT claim

Truly **gradual** drift — a predicate that inches the count up a little every
week, each step under the ratio — is indistinguishable from calendar growth by
archive count alone. This tripwire is not a substitute for the human R0.2 verify
pass; the alert text still points there. What changed is robustness (no
noisy-week false alarms/misses) and growth-proofing (no fixed number in steady
state).

## Data flow

Both callers now pass the recent successful runs, not a single prior:
[send-ops-digest.ts](../../scripts/send-ops-digest.ts) already fetched 6 rows
(now slices the successful ones into `recentPipeline`);
[run-pipeline.ts](../../scripts/run-pipeline.ts) fetches the last N successful
runs instead of `limit 1`. `stampedeReason` takes the recent-count arrays and
computes the baseline internally, so the ops digest and the pipeline log agree.

## Verification (observed, not intended)

- **The real data stays quiet:** `npm run ops-digest -- --dry-run` → the Aug 3
  run (115 archived, +21) renders "ok ✓" with **no** stampede line. (The digest's
  one alert is Coverage, a different section.)
- **Tests +5 net (896/896):** `recentBaseline` is the max, ignores a low-outlier
  week, null on empty; `isStampede` — organic growth quiet (115 vs a 94 peak),
  a 2.0× spike fires, growth-proof (300 archived is fine against a 200 baseline —
  the old ceiling would have alerted), floor-gated, first-run ceiling-only;
  `stampedeReason` — within-trend null, robust to a lone low prior week, names
  the offending stage, first-run ceiling backstop.
- **Gate:** `tsc` clean · 896/896 · `npm run build` clean · `npm audit` 0.

## Deploy steps

Push to `main`. Code-only, no schema. Takes effect on the next pipeline run and
ops digest.

## Verify checklist

- [ ] Next Monday's ops digest: no stampede ⚠️ on a normal week.
- [ ] If one ever fires, it's a genuine ≥2× the busiest recent week — check for a
      wrongly-archived festival (R0.2) before dismissing it.

## Rollback

`git revert`. Pure logic + two script read-sites; the prior single-prior spike
check returns.
