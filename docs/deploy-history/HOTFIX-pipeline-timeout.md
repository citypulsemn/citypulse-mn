# HOTFIX — Pipeline run killed mid-flight (Jul 14, `ok=false, error=null`)

## Diagnosis

The failed run's signature — `ok=false, upserted 0, error NULL` — decodes precisely: the script inserts its `pipeline_runs` row with `ok=false` at startup and only finalizes it at the very end, and it had **no failure path that wrote the error column**. So the process never reached its own ending: it was **killed**, not crashed.

The killer: the workflow's `timeout-minutes: 50`. The 4.2 venue sweeps added ~9 sub-agents that ran **serially**, each doing up to 12 web searches — easily 30+ minutes of added wall clock. Monday's run squeaked under the limit; Tuesday's, with normal API-latency variance, went over, and GitHub Actions killed the job. (If you cancelled that run manually, same signature — but the fixes below are the right hardening either way.)

## Three fixes in this zip

1. **Venue sweeps now run in parallel** (`Promise.allSettled` across shards). This cuts the sweep portion's wall clock by roughly the shard count (~6× for music) — the real fix. One shard failing no longer affects the others.
2. **Workflow timeout raised 50 → 90 minutes** — headroom, not the crutch.
3. **Failures now finalize the run row**: any crash writes `finished_at`, `ok=false`, and the actual `error` text. From now on the diagnostics are unambiguous:
   - `error` populated → the script crashed; the message says where.
   - `finished_at NULL` → the job was killed (timeout/cancel) before it could write anything.

348 tests, clean build, 0 vulnerabilities.

## Deploy
Unzip over the repo, commit (`Pipeline resilience: parallel sweeps, error finalize, 90m timeout`) → push. No database step.

## Verify
- [ ] Optionally trigger **Actions → Weekly Research → Run workflow** once; the log should show `N venue sweeps in parallel` and the run should finish comfortably — and it re-exercises the whole 4.6-era pipeline end to end.
- [ ] If any future run fails, `select error, finished_at from pipeline_runs order by started_at desc limit 1` now tells you exactly which kind of failure it was.
