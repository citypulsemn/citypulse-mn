# Freshness re-verification

Roadmap 4.5. Events are discovered weekly, but reality changes daily — shows get cancelled, sell out, and move. Before this, a show cancelled on Tuesday sat on the calendar until Monday's research run. Trust is the product; this closes the gap.

## How it works

Every **Thursday morning** (before the weekend, after the digest), the `verify-events` workflow re-checks the next 7 days of published events against their sources:

1. `selectForVerification` picks candidates — published, starting within 7 days, having a source or ticket URL, **never-verified first, then soonest first** within each group, capped at `DEFAULT_CAP` (200).
2. Batches of 8 go to a verification agent (`verifyEventsBatch`) that reads each event's source page and returns one verdict per event.
3. `actionFor` applies **the policy** (pure, unit-tested in `lib/__tests__/verify.test.ts`).
4. **Each batch's verdicts are written before the next batch starts**, so a run that stops early keeps everything it earned.

### Why never-verified first (26 Aug 2026)

It was soonest-first with a cap of 40, and that reached **40 of 165** events in
its own window — about 25 hours of a 7-day window, on a job that runs weekly.
Everything past that hour happened without being checked.

Worse, the importers stamp `verified_at` on the venues they cover, so the soonest
slice was thick with music and sports a primary source had already confirmed,
while arts (8% verified), festival (2%), food (1%) and weird (0%) sat past the
cap. Re-checking a confirmed row is worth less than the first look at an
unconfirmed one.

Fresh looks per run went **34 → 105**. Full write-up in
`docs/deploy-history/DEPLOY-VERIFY-REACH.md`.

## The policy — deliberately asymmetric

| Verdict | Action | Why |
|---|---|---|
| `confirmed` | stamp `verified_at` | — |
| `cancelled` **with evidence** | auto-cancel (audited) | The one change worth making without a human — a cancelled show on the calendar is the worst trust failure. |
| `cancelled` **without evidence** | downgraded to a flag | The agent must show its work before an event comes off the calendar. |
| `moved` | flag only, never auto-applied | Auto-editing a start time on an LLM's reading of a webpage risks corrupting good data. The admin fixes times with the 1.5 editor. |
| `sold_out` | flag (informational) | — |
| `not_found` | flag only — **never cancels** | A vanished page is not evidence of anything; sites reorganize constantly. A false cancellation is worse than a stale listing. |

Cancellations and flags are written to the existing `admin_audit` table (`verify_cancel` / `verify_flag`), and cancelled events use the existing cancellation display (banner on the event page, `STATUS:CANCELLED` in the .ics).

## Pieces

- `lib/verify.ts` — selection, batching, verdict parsing, and the action policy (all pure).
- `buildVerifyPrompt` — tells the agent explicitly that absence ≠ cancellation and to prefer the less drastic verdict when unsure.
- `verifyEventsBatch` in the research agent; `markVerified` / `cancelVerified` / `flagVerification` in `lib/upsert.ts`.
- `scripts/verify-events.ts` (`npm run verify`, `--dry-run` and `--cap=N` supported) + `.github/workflows/verify-events.yml` (Thu 16:00 UTC cron + manual dispatch with a dry-run input).
- Schema: `events.verified_at timestamptz` (additive, idempotent).

## Cost, and what actually limits a run

A full window is ~21 batches × up to 12 searches ≈ **≤250 searches + 21 Sonnet
calls** a week.

The cap is the cost ceiling. What ends a long run is `RUN_BUDGET_MS` (20
minutes), checked before each batch and never during — a batch in flight has been
paid for and always finishes. The workflow's `timeout-minutes: 30` is a backstop
and **must stay above the budget plus setup**; if it ever fires, the per-batch
flush means the finished batches are already saved.

When the cap or the budget truncates a run, the log says so by name rather than
reporting a clean finish (rule 6).

**The cadence is now the binding constraint, not the cap.** Two runs a week would
roughly double reach for the same cap, because the window rolls between runs.
That doubles the spend, so it is an owner decision.

Use `npm run verify -- --dry-run --cap=8` to see the shape for one batch.
