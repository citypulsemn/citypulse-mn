# Ops digest

Roadmap 2.1 — the cockpit, delivered. One email to the operator after the weekly pipeline run (and on demand), reading every instrument the site has: pipeline health, coverage floors, the verify pass, engagement with week-over-week deltas, trending, subscribers.

## The resilience contract IS the design

Every section is gathered independently in `scripts/send-ops-digest.ts`; a failed source renders "section unavailable: <reason>" — which itself counts as an alert — and the email still sends. A cockpit that dies when an instrument fails is a smoke detector wired to the stove's fuse. The one thing that fails LOUDLY is the send itself (exit 1, per the 5.4 lesson: infra failures are reported, not swallowed).

## Sections that exist because an instrument died quietly

Two sections judge whether another instrument is still alive, rather than
reporting its output. Both were added after that instrument's silence read as
good news:

- **Verification** — a dying verify pass used to read as a quiet week twice
  over: `verified7` falls to zero, and with nothing checking anything the flag
  queue stops growing, so Queue calms down too.
- **Source check** (27 Oct 2026) — `check-sources` was dead for four weeks
  behind a broken step in front of it, and the only evidence was
  `source_checked_at` going stale in a column nothing read. The workflow
  conclusion *was* failure and the `/admin/ops` Actions tile *was* red, for four
  Mondays, and neither produced action. So this verdict goes in the **email**,
  which is the surface that gets opened; `/admin/ops` carries the same verdict
  as a tile from the same judge (`judgeSourceSweep`) and the same query
  (`getSourceSweepHealth`), so the page and the email cannot disagree. It asks
  whether the sweep has run since it was last DUE rather than how long ago it
  ran, because this email is composed minutes after the workflow it watches —
  judged on elapsed time the first dead Monday reads green.

The rule both follow is the vendor tiles' rule: **"we could not tell" is never
green.** A failed read, a null measurement and an `unknown` verdict all alert.

## Pieces

- `lib/ops-digest.ts` — pure: `composeOpsDigest(inputs, now)` → subject/html/text. Subject: `✅ all green` or `⚠️ N alerts`, Chicago-dated. Golden-tested (14): healthy week, failed run, the kill signature (`finished_at` null), coverage breaches, WoW math including first-run and divide-by-zero, unavailable sections, all-sections-down, dark-trending-is-not-an-alarm.
- `ops_digest_runs(id, sent_at, totals jsonb)` — the WoW baseline, written only on real sends so deltas always compare against what was actually reported. Dry runs leave no trace.
- `.github/workflows/ops-digest.yml` — `workflow_run` on "Weekly Event Research" **completed** (success OR failure — the cockpit reports especially when the news is bad) + manual dispatch with dry-run.
- `npm run ops-digest -- --dry-run` — compose and print without sending.

New env: `OPS_DIGEST_TO` (GitHub Actions secret). Reuses `DATABASE_URL`, `RESEND_API_KEY`, `DIGEST_FROM`.
