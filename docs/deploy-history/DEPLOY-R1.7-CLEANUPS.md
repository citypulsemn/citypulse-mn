# Deploy R1.7 — clock cleanups + the Weekend-preset decision (sprint R1 closer)

*July 20, 2026 (evening). Roadmap v5 sprint R1, item 7 — the batch that finishes the
one-clock unification.*

## What shipped

**a. `lib/horizon.ts`** — `addDaysISO` mixed local `setDate` with a UTC `toISOString`
read: on evening local runs the research window started a day late. Now one frame
(`chiDayKey`), rule 10.

**b. `lib/events.ts`** — the `getEventsForDay` SQL expansion cap was `diff <= 14`,
admitting 15-day spans onto server-rendered day pages while the SPA's `daysSpanned`
(EXPAND_MAX_DAYS = 14 days *inclusive*, i.e. diff ≤ 13) refused them — the two surfaces
disagreed on the same day. SQL aligned to `<= 13`; a query-text tripwire pins it.

**c. `chicagoOffset` DST small-hours** — already absorbed by R1.1 (noted for the record).

**d. The product call (Taren, Jul 20): the calendar's "Weekend" preset now agrees with
/this-weekend — Sunday is still the weekend.** Tapping "Weekend" on a Sunday shows
today, not a window five days out. Implementation: the Sunday branch anchors to the
weekend that includes today; past days clip as always. The previously test-blessed
jump-ahead behavior is replaced, with the old Fri–Sun selection coverage re-anchored on
a Wednesday so nothing was lost.

## Tests

Net +1 with several rewritten: Sunday-preset alignment (window + event selection +
spotlight classification) · Wednesday-anchored Fri–Sun coverage preserved · the SQL cap
tripwire. Suite 635/635.

## Quality gate

tsc clean · 635/635 · build clean · audit 0.

## Deploy steps

Push to `main`. Code-only. The horizon fix takes effect next pipeline run; the Weekend
preset is immediate; the day-page cap difference only shows when a 15-day span exists.

## Verify checklist

- [ ] Next Sunday, tap "Weekend" on the homepage calendar: today's events, not next week's.

## Sprint R1: COMPLETE

R1.1 clock · R1.2 collections · R1.3 related · R1.4 digest windows · R1.5 weekend cap
leak · R1.6 verify window · R1.7 cleanups. Every "is it past?" comparison in the codebase
now goes through `lib/clock.ts` or a frame-pure SQL expression. Next per v5: sprint R2
(hardening) within two weeks, F1 ripening mid-August.

## Rollback

`git revert`.
