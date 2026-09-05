# Freshness re-verification

Roadmap 4.5. Events are discovered weekly, but reality changes daily — shows get cancelled, sell out, and move. Before this, a show cancelled on Tuesday sat on the calendar until Monday's research run. Trust is the product; this closes the gap.

## How it works

Twice a week, the pass re-checks the next 7 days of published events against their sources:

- **Monday 12:00 UTC** — `verify-events.yml`, after the research pipeline and importers land the week's new listings.
- **Thursday, immediately before the subscriber email** — a step *inside* `weekly-digest.yml`, not a separate workflow.

The Thursday slot lives in the digest workflow on purpose. It used to be a 16:00 cron, an hour **after** the 15:00 send, so the one surface that cannot be recalled went out ahead of the week's verification. Cron cannot fix that — this repo has seen the scheduler drift +1h02m to +3h52m, so two workflows cannot be ordered by their start times. Two steps in one job can.

That step is `continue-on-error: true`: a verification hiccup must never cost the list its email. It is skipped on the 20:00 safety-net run (the primary already did it) and on dry runs.

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

## The Marley fix (5 Sep 2026) — asking the right question

The pass **confirmed a fabricated event**. Our listing said *Damian 'Jr. Gong'
Marley & Stephen Marley* at The Fillmore Minneapolis; the venue had Masego that
night, Live Nation had no Marley dates anywhere, and the roundup article we cited
never mentioned them. `verified_at` was stamped two days before a reader caught
it.

**The prompt was the cause.** It asked whether an event "still appears as
scheduled" against *its own source* — and when that source is an article that
never named the event, that question cannot catch a fabrication. Three changes:

1. **The venue's own calendar is the authority**, and it outranks the source we
   cite. A roundup that does not name the event confirms nothing.
2. **`confirmed` now means "I saw this event named"** — not "the venue exists".
   The prompt says it outright: if you cannot find the event named somewhere
   authoritative, that is `not_found`, **never** `confirmed`.
3. **New verdict `wrong_event`** — the venue lists a different act in that room
   that night, with evidence naming what it actually has.

Proven on the same listing, the same source and the same agent:
`confirmed` → **`wrong_event`**, citing the Fillmore's own calendar, with no
`verified_at` stamp.

`wrong_event` **flags, it does not hide.** It is still one instrument, and a
support act or a renamed billing can look like "a different act"; the house
standard for hiding is two instruments agreeing (`scripts/resolve-conflicts.ts`).
What it guarantees is that the listing is not stamped verified.

**Also fixed:** `parseVerdicts` defaulted a missing `verdict` field to
`"confirmed"`, so a malformed answer stamped `verified_at` on an event nobody had
checked. It now skips the entry. Silence is not a confirmation.

**And flags are now visible.** Every `verify_flag` row ever written went into
`admin_audit` and *nothing read it* — a pass raising its hand into a void. The
ops digest Queue section now carries flagged listings that are still published
and still unverified, `wrong_event` first, and alerts on them. Self-clearing:
open is computed from the listing's current state, not from flag count.

## The policy — deliberately asymmetric

| Verdict | Action | Why |
|---|---|---|
| `confirmed` | stamp `verified_at` | — |
| `cancelled` **with evidence** | auto-cancel (audited) | The one change worth making without a human — a cancelled show on the calendar is the worst trust failure. |
| `cancelled` **without evidence** | downgraded to a flag | The agent must show its work before an event comes off the calendar. |
| `moved` | flag only, never auto-applied | Auto-editing a start time on an LLM's reading of a webpage risks corrupting good data. The admin fixes times with the 1.5 editor. |
| `sold_out` | flag (informational) | — |
| `not_found` | flag only — **never cancels** | A vanished page is not evidence of anything; sites reorganize constantly. A false cancellation is worse than a stale listing. |
| `wrong_event` | flag only — and **never stamps `verified_at`** | The venue's own calendar shows a different act that night. The strongest negative the pass can produce, but still one instrument: a support act or a renamed billing can look like a different act. |

Cancellations and flags are written to the existing `admin_audit` table (`verify_cancel` / `verify_flag`), and cancelled events use the existing cancellation display (banner on the event page, `STATUS:CANCELLED` in the .ics).

## Pieces

- `lib/verify.ts` — selection, batching, verdict parsing, and the action policy (all pure).
- `buildVerifyPrompt` — tells the agent explicitly that absence ≠ cancellation and to prefer the less drastic verdict when unsure.
- `verifyEventsBatch` in the research agent; `markVerified` / `cancelVerified` / `flagVerification` in `lib/upsert.ts`.
- `scripts/verify-events.ts` (`npm run verify`, `--dry-run` and `--cap=N` supported) + `.github/workflows/verify-events.yml` (Mon 12:00 UTC cron + manual dispatch with a dry-run input) + the pre-send step in `.github/workflows/weekly-digest.yml`.
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

**Twice weekly since 26 Aug 2026**, because the cadence — not the cap — was the
binding constraint. A pass that looks 7 days ahead but runs every 7 days gives
each event exactly one chance to be seen, and a truncated run spends that chance.
Two runs ~3.5 days apart put every event inside a run's reach at least once.

Roughly **doubles the spend**: ~500 searches and ~42 Sonnet calls a week at a
full window. Halve it by deleting one cron line; nothing else depends on there
being two.

Use `npm run verify -- --dry-run --cap=8` to see the shape for one batch.
