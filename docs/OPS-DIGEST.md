# Ops digest

Roadmap 2.1 — the cockpit, delivered. One email to the operator after the weekly pipeline run (and on demand), reading every instrument the site has: pipeline health, coverage floors, the verify pass, engagement with week-over-week deltas, trending, subscribers.

## The resilience contract IS the design

Every section is gathered independently in `scripts/send-ops-digest.ts`; a failed source renders "section unavailable: <reason>" — which itself counts as an alert — and the email still sends. A cockpit that dies when an instrument fails is a smoke detector wired to the stove's fuse. The one thing that fails LOUDLY is the send itself (exit 1, per the 5.4 lesson: infra failures are reported, not swallowed).

## Pieces

- `lib/ops-digest.ts` — pure: `composeOpsDigest(inputs, now)` → subject/html/text. Subject: `✅ all green` or `⚠️ N alerts`, Chicago-dated. Golden-tested (14): healthy week, failed run, the kill signature (`finished_at` null), coverage breaches, WoW math including first-run and divide-by-zero, unavailable sections, all-sections-down, dark-trending-is-not-an-alarm.
- `ops_digest_runs(id, sent_at, totals jsonb)` — the WoW baseline, written only on real sends so deltas always compare against what was actually reported. Dry runs leave no trace.
- `.github/workflows/ops-digest.yml` — `workflow_run` on "Weekly Event Research" **completed** (success OR failure — the cockpit reports especially when the news is bad) + manual dispatch with dry-run.
- `npm run ops-digest -- --dry-run` — compose and print without sending.

New env: `OPS_DIGEST_TO` (GitHub Actions secret). Reuses `DATABASE_URL`, `RESEND_API_KEY`, `DIGEST_FROM`.
