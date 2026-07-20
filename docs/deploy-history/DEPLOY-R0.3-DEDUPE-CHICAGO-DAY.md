# Deploy R0.3 — dedupe clusters by the Chicago day (sports-rule enforcement)

*July 20, 2026 (evening). Roadmap v5 sprint R0, item 3.*

## The bug

`dedupeNearDuplicates` (and the admin duplicates view) matched "same day" with
`a.start_at::date = b.start_at::date` — a cast in the DB session zone, which is UTC on
Supabase. Any Chicago event at/after 7 PM CDT lands on the next UTC date. Consequences,
both **reproduced against the live DB with literal fixtures** (VALUES probe, read-only):

- A Mon 7:10 PM game and a Tue 1:10 PM day game share the Tue UTC date → identical
  titles + same stadium → one real game archived. The sports rule, violated weekly.
- Two listings of the same Monday event at 5 PM and 8 PM straddle the boundary → a
  genuine duplicate never caught.

Plus a survivorship defect: the doc promised "earliest-seen row is kept," but the join
ordered random UUIDs (`a.id < b.id`) — survivor was a coin flip.

## What shipped

`lib/upsert.ts` (`dedupeNearDuplicates`) and `lib/admin.ts` (`getDuplicatePairs`):

- **Chicago-day match:** `(start_at at time zone 'America/Chicago')::date` on both sides.
- **Deterministic survivorship:** join ordered on `(created_at, id)` — earliest-seen
  genuinely kept, matching the doc.
- **Anchored keepers:** a row being archived this pass can't be the justification for
  archiving another (stops chained pairs archiving a row far from its actual survivor;
  the rare unmatched chain tail waits for the next weekly run instead of guessing).

## Verification

- **Fixture probe (prod session, read-only):** old predicate pairs cross-day, misses
  same-evening; new predicate does the opposite — PASS on both.
- **Current-data probe:** old-vs-new pair sets on today's production data: 0 vs 0 —
  today's cleanups left no live divergence, so the fix changes no current rows; it
  changes what next Monday's run is *allowed* to do.
- **Tripwires** (4 new tests in `lib/__tests__/upsert-queries.test.ts`): Chicago casts
  present in both files, old bare-`::date` pattern absent, `(created_at, id)` ordering
  and keeper anchoring present.

## Quality gate

tsc clean · 598/598 · build clean · audit 0.

## Deploy steps

Push to `main`. Code-only; takes effect on the Jul 27 pipeline run and immediately in the
admin duplicates view.

## Verify checklist

- [ ] Admin → duplicates view lists zero cross-day pairs during a week with an evening
      game followed by a day game (Twins homestands qualify).
- [ ] After Jul 27's run: every game of any homestand still has its own card.

## Rollback

`git revert` — two queries + tests. R0 items remaining: R0.4 restore column · R0.5
resubscribe · R0.6 JSON-LD escape.
