# Deploy R1.6 — verification window skew fixed (the CI leg was already live)

*July 20, 2026 (evening). Roadmap v5 sprint R1, item 6. XS.*

## The bug

`selectForVerification` windowed with a naive parse against real now. Masked when the
verify pass runs on the local Chicago machine — but `verify-events.yml` runs Thursdays
16:00 UTC in Actions, so the CI leg was live: run-day events after ~11 AM CT dropped out
of verification, and events just past day 7 sneaked in through the shifted far edge.
Recon correction to the roadmap's "Where": the SQL prefilter in
`scripts/verify-events.ts` is frame-CORRECT (timestamptz vs `now()`) — only the TS
filter was wrong, re-narrowing the SQL's honest window. The SQL is untouched.

## What shipped

`lib/verify.ts` — wall-string window via `chiWallClock` (rule 10). Safety policy,
source-URL requirement, cap, and ordering untouched (tests unmodified).

## Tests

2 new: run-day early-afternoon event stays verifiable on the 16:00Z runner · a day-7+3h
event no longer sneaks in. Suite 634/634.

## Quality gate

tsc clean · 634/634 · build clean · audit 0.

## Deploy steps

Push to `main`. Code-only; first exercised by Thursday's verify workflow.

## Rollback

`git revert`. R1 remaining: only R1.7 — the cleanup batch (horizon day-math,
expansion-cap off-by-one, and the Weekend-preset product call for Taren; the
chicagoOffset DST item was already absorbed by R1.1).
