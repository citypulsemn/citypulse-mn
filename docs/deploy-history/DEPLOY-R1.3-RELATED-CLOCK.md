# Deploy R1.3 — "More at this venue" stops hiding tonight's shows

*July 20, 2026 (evening). Roadmap v5 sprint R1, item 3. XS, exactly as scoped — the
R1.1 clock made this a three-line conversion.*

## The bug

`selectRelated`'s upcoming-filter compared `new Date(e.start).getTime()` (naive Chicago
wall parsed as fake-UTC) against real `now.getTime()`. On UTC servers, tonight's shows at
the same venue read as "past" from ~2 PM CT — the strip on event pages rendered null (or
thinner) every afternoon, precisely when someone reading tonight's event page would want
"what else is on here tonight."

## What shipped

`lib/related.ts` — the filter compares walls to walls (`e.start >= chiWallClock(now)`),
rule 10 via `lib/clock.ts`. Nothing else changed: alias matching, neighborhood fallback,
cap, and honest-emptiness behavior are untouched (their tests passed unmodified).

## Tests

2 new regressions: the afternoon boundary (tonight's 7 PM show in the strip at 3:30 PM,
this morning's show honestly out) and a winter CST variant. Suite: 626/626.

## Quality gate

tsc clean · 626/626 · build clean · audit 0.

## Deploy steps

Push to `main`. Code-only.

## Verify checklist (post-deploy, any afternoon)

- [ ] Open tonight's event page for a First Avenue-class venue after ~2 PM: the
      "More at [venue]" strip lists tonight's/this week's other shows.

## Rollback

`git revert`. Next: R1.4 digest windows · R1.5 weekend cap leak · R1.6 verify window ·
R1.7 cleanups (+ the Weekend-preset product call).
