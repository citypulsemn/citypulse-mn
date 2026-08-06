# Deploy — stampede tripwire recalibration (spike, not a fixed number)

*August 2026. Not a roadmap item — surfaced by the production state pull.
Supersedes the absolute threshold from F2.6 ([DEPLOY-F2.6](DEPLOY-F2.6-PIPELINE-OBSERVABILITY.md)).*

## The problem

F2.6's stampede tripwire fired when a run archived more than a fixed 100 (or
deduped more than 80). But the weekly archive count **climbs as the calendar
grows** — the real sequence was **52 → 94 → 115** over Jul–Aug 2026. Aug 3's
perfectly healthy 115 tripped the fixed 100, so that ops digest raised a
⚠️ stampede alert that was pure noise. A fixed number can't tell "the site got
bigger" from "a predicate went wrong."

## The fix

A stampede is a **spike**, not an absolute count. `isStampede` now fires on
either condition ([lib/ops-digest.ts](../../lib/ops-digest.ts)):

- an absolute **ceiling** (archived 250 / deduped 200) — a flood no organic
  trend could explain, fires even on the first-ever run; OR
- a **spike**: above a **floor** (archived 80 / deduped 60) *and* ≥ **2.5×** the
  last successful run — the diff the Pipeline section already shows, promoted to
  a gate.

The floor stops a small week from ratio-spiking (5 → 15 is 3× but not a
stampede); the ceiling still catches a flood if the baseline crept up under it.
`stampedeReason()` is shared by the ops digest and the pipeline log so they
agree, and names which stage(s) tripped.

## Verification (observed, not intended)

- **The exact false positive, gone, on real data:** `npm run ops-digest --
  --dry-run` → the Aug 3 run (115 archived, +21 vs the prior successful run's
  94) renders its normal counts with **no stampede line** and no alert.
- Tests +9 (781/781): organic growth quiet (115 vs 94, 94 vs 52); a 3.3× spike
  fires; the absolute ceiling fires regardless of trend and on a first run; a
  small week can't ratio-spike below the floor; first-run (no baseline) → ceiling
  only; `stampedeReason` names the offending stage(s) or returns null. The
  pre-existing F2.6 flood tests still pass unchanged.
- Gate: tsc clean · 781/781 · build clean · audit 0.

## Deploy steps

Push to `main`. Code-only, no schema. Takes effect on the next pipeline run and
ops digest.

## Verify checklist

- [ ] Next Monday's ops digest: no stampede ⚠️ on a normal week.
- [ ] If one ever fires, it should be a genuine multiple of recent weeks — check
      for a wrongly archived festival before dismissing it.

## Rollback

`git revert`.
