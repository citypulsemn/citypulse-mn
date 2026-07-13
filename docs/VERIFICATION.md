# Freshness re-verification

Roadmap 4.5. Events are discovered weekly, but reality changes daily — shows get cancelled, sell out, and move. Before this, a show cancelled on Tuesday sat on the calendar until Monday's research run. Trust is the product; this closes the gap.

## How it works

Every **Thursday morning** (before the weekend, after the digest), the `verify-events` workflow re-checks the next 7 days of published events against their sources:

1. `selectForVerification` picks candidates — published, starting within 7 days, having a source or ticket URL, **soonest first** (tonight's show matters more than Sunday's), capped at 40 for predictable cost.
2. Batches of 8 go to a verification agent (`verifyEventsBatch`) that reads each event's source page and returns one verdict per event.
3. `actionFor` applies **the policy** (pure, unit-tested in `lib/__tests__/verify.test.ts`).

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
- `scripts/verify-events.ts` (`npm run verify`, `--dry-run` supported) + `.github/workflows/verify-events.yml` (Thu 16:00 UTC cron + manual dispatch with a dry-run input).
- Schema: `events.verified_at timestamptz` (additive, idempotent).

## Cost

One weekly run: ≤5 batches × up to 12 searches ≈ **≤60 searches + 5 Sonnet calls**. Tune with the cap in `selectForVerification` or the cron frequency (daily is the obvious upgrade if the site's volume grows).
