# Deploy F2.6 — pipeline observability follow-through

*July 21, 2026. Roadmap v5 F2.6 — the last ungated F2 item. R0.2/R0.3 live in
the weekly pipeline's blast radius and the collapse rewrite is one day old; this
makes a regression in either one announce itself.*

## What shipped

**Per-stage counts WITH run-over-run diffs**, in both the pipeline log and the
ops digest Pipeline section:

```
ok ✓ — 408 upserted (+268) · 43 deduped (+33) · 0 collapsed · 52 archived (+15)
started 2026-07-20 08:23 · duration 41m 0s · Δ vs last run
```

- Four stages named honestly: **deduped** (near-duplicate merges — the column
  was mislabeled "collapsed" before) and **collapsed** (multi-day runs folded
  into spans — the freshly-rewritten stage).
- `deltaTag` (pure, exported) signs the delta and shows **nothing** when either
  side is unknown — so the first-ever run, and a brand-new metric with no prior
  number, never fake a baseline.
- The diff baseline is the last **successful** run, not merely the last run: a
  failed run recorded zeros, and diffing against those would fake a huge swing
  (caught in verification — see below).

**Stampede tripwire** — an alert line when `archived` or `deduped` exceeds its
threshold in one run: "how R0.2 would have announced itself" (a flood of
archives is the fingerprint of a festival wrongly removed mid-run). Thresholds
(`archived: 100, deduped: 80`) are **calibrated above the observed Jul 2026
baseline** — a real healthy run did 43 deduped / 52 archived, so the crude
absolute gate stays quiet on a normal cleanup week while the per-stage diff
carries the finer signal.

**New column `pipeline_runs.collapsed_runs`** (additive, nullable, applied to
prod) — the multi-day collapse count was logged but never persisted, so the
one-day-old rewrite couldn't be diffed. Now it is. Historical rows read null
(shown as "no prior number", never a fake zero).

## Verification (observed, not intended)

- **Ops digest dry-run against real prod history:** Pipeline section rendered
  `408 upserted (+268) · 43 deduped (+33) · 52 archived (+15)`, diffed against
  the last successful run (Jul 13: 140 / 10 / 37) — the arithmetic checks out.
- **Real data drove a calibration fix:** the first draft diffed against the
  chronologically-previous run, which had FAILED (all zeros), producing a
  meaningless "+408". Switched the baseline to the last successful run; also
  raised the stampede thresholds above the observed 43/52 so a normal week
  doesn't cry wolf.
- Tests +8 (738/738), golden on `buildSections`/`deltaTag`: signed deltas and
  flat-run marker · silence when a side is unknown · deduped/collapsed labels
  each diffed · no diff on first-ever run · quiet on a null-column baseline ·
  stampede alert on flooded archives AND dedupes · quiet on normal counts.
- Schema drift guard green. Gate: tsc clean · 738/738 · build clean · audit 0.

## Deploy steps

1. ~~Apply schema~~ — **done** (`alter table ... add column if not exists`,
   idempotent).
2. Push to `main`. The diff/tripwire take effect on the next pipeline run and
   the next ops digest.

## Verify checklist

- [ ] Monday's pipeline log shows the diff line (`upserted N (+d), deduped …`).
- [ ] Monday's ops digest Pipeline section shows `Δ vs last run` and, once two
      runs have recorded `collapsed_runs`, a real diff on the collapsed stage.
- [ ] No stampede alert on a normal week; if one fires, check for a wrongly
      archived festival before assuming it's noise.

## Rollback

`git revert`. The `collapsed_runs` column can stay (unused nullable column is
harmless).
