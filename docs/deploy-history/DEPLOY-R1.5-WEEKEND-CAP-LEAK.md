# Deploy R1.5 — /this-weekend stops dropping long self-spanned runs

*July 20, 2026 (evening). Roadmap v5 sprint R1, item 5. XS — the two-line fix the
roadmap prescribed, verbatim.*

## The bug

`selectWeekend` computed a row's end day from `multiDayEnd` or the CAPPED `daysSpanned`
expansion. A run spanned by its **own long `end_at`** (no `multiDayEnd`) and exceeding
`EXPAND_MAX_DAYS` collapsed to a single-day event on its start date — a Jul 1→31
exhibition produced zero weekend sections while the this-weekend **ICS feed** (which uses
`spansDay`/`spanEnd`) correctly included it. The page disagreed with its own feed, and
rule 5 (true spans, never capped expansions) — fixed in v4 for the `multiDayEnd` source —
had leaked through the second source.

## What shipped

`lib/weekend.ts` — the end day now comes from `spanEnd(e)` (which reads BOTH span
sources, with the late-night-end guard) falling back to the capped span only when there
is no true span. One expression changed.

## Tests

3 new: the 31-day self-spanned exhibition lands in "Happening all weekend" · a parity
fixture asserting the same row passes `spansDay` for every weekend day (page and feed
can no longer disagree silently) · a genuinely-ended run stays out.

## Quality gate

tsc clean · 632/632 · build clean · audit 0.

## Deploy steps

Push to `main`. Code-only.

## Verify checklist

- [ ] Any long exhibition currently mid-run (Skyline Mini Golf, through Aug 30) appears
      under "Happening all weekend" on /this-weekend AND in /feeds/this-weekend.

## Rollback

`git revert`. Remaining in R1: R1.6 verify window (XS) · R1.7 cleanups + the
Weekend-preset product call.
