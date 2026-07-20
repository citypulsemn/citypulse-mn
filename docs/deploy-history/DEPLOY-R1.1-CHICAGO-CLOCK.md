# Deploy R1.1 — lib/clock.ts, the shared Chicago clock (sprint R1 keystone)

*July 20, 2026 (evening). Roadmap v5 sprint R1, item 1. Everything else in R1 becomes a
mechanical edit on top of this.*

## What shipped

**`lib/clock.ts`** — pure, no repo deps, the one home for the wall-frame discipline:

- `chiWallClock(instant)` / `chiNow()` — real instant → Chicago wall string (moved from
  `lib/event-view.ts`, where R0.1 incubated it; re-exported there for compat).
- `chiDayKey(instant)` / `chiTodayKey()` — Chicago day keys (moved from `lib/weekend.ts`;
  re-exported there — feeds/ongoing/admin imports untouched).
- `isPastWall(wall, nowWall)` — the rule-10 comparison, named.
- `chicagoOffset(local)` — moved from `lib/seo/event-jsonld.ts` and **upgraded**: full
  wall strings resolve the offset by two-pass fixed point on the ACTUAL hour. The old
  noon probe was an hour off for small-hours times on DST-transition days (a 1 AM
  fall-back-day time is still CDT; noon that day is CST) — that was R1.7c, absorbed here
  as the roadmap planned. Bare day keys keep noon-probe behavior. The ambiguous
  fall-back hour resolves deterministically to its first (CDT) occurrence.
- `wallToInstant(wall)` — wall → real instant, for serialization boundaries ONLY.

Ripple: `toIsoWithOffset` now passes the full wall string, so ICS stamps and JSON-LD
start times are correct in the DST small hours too (previously 1 h off twice a year).

**Rule 10 added to `docs/ENGINEERING.md`** (per v5 Part 3.6): a naive wall string may
never be compared against a real instant; all window logic goes through this module.

## Tests

13 golden cases in `lib/__tests__/clock.test.ts`: CDT + CST walls · day-key boundaries at
the Chicago midnight (summer 5:00Z, winter 6:00Z) · spring-forward and fall-back
small-hours offsets (both would FAIL under the old noon probe) · the ambiguous hour ·
`wallToInstant` round-trips and absolute instants · `isPastWall` ordering. Suite total
608 → 621 (existing event-view/ics/jsonld tests double as regression guards for the moves).

## Quality gate

tsc clean · 621/621 · build clean · audit 0. No behavior change outside the DST-hour
correction; all pre-existing tests green without modification.

## Deploy steps

Push to `main`. Code-only.

## Up next (mechanical, per v5)

R1.2 collections · R1.3 related · R1.4 digest windows · R1.5 weekend cap leak ·
R1.6 verify window · R1.7 cleanups + the Weekend-preset product call for Taren.

## Rollback

`git revert` — the old sites re-export, so reverting restores their local
implementations in one commit.
