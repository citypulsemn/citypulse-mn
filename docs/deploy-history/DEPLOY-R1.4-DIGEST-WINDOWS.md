# Deploy R1.4 — digest windows stop dropping send-day afternoons

*July 20, 2026 (evening). Roadmap v5 sprint R1, item 4.*

## The bug

The subscriber digest sends Thursday 15:00 UTC (10 AM CT) from a GitHub Actions runner.
Both of its selectors compared naive wall strings as fake-UTC epochs against the runner's
real clock, so everything on send day between ~10 AM and ~3 PM CT wall time read as
"past" and vanished — from the weekly picks AND from the personalized "you saved these —
happening this week" block. Subscribers with a saved lunchtime event never got reminded
of it on the very morning it mattered.

## What shipped (rule 10 via lib/clock.ts)

- `lib/content/weekly-picks.ts` — window and week keys in the Chicago wall frame
  (`chiWallClock` bounds, `chiDayKey` start key); the per-day spread key is the event's
  wall day directly. Scoring (weekend day-of-week bonus) was already frame-consistent
  and is untouched.
- `lib/digest-personal.ts` (`selectSavedUpcoming`) — wall-string window; the
  still-running multi-day branch compares walls too (it previously mixed frames twice).
- `lib/digest-send.ts` needed no change — it passes a real `Date`; the selectors now
  convert internally.

## Tests

3 new: the send-morning boundary in both selectors (a 1 PM CT send-day event survives
the 10 AM CT send), week keys in the Chicago frame, and a still-running vs just-ended
multi-day pair. Existing empty-degradation and curation tests passed unmodified.

## Quality gate

tsc clean · 629/629 · build clean · audit 0.

## Deploy steps

Push to `main`. Code-only; first exercised by Thursday's digest send.

## Verify checklist

- [ ] Thursday after the send: the digest includes at least one send-day event when one
      exists (compare against /day/<today> that morning).

## Rollback

`git revert`. Remaining in R1: R1.5 weekend cap leak (XS) · R1.6 verify window (XS) ·
R1.7 cleanups + the Weekend-preset product call.
