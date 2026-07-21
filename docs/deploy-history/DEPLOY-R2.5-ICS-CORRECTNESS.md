# Deploy R2.5 — calendar-export correctness (spans, the Google button, folding)

*July 20, 2026 (late evening). Roadmap v5 sprint R2, item 5. Three bugs in
[lib/ics.ts](../../lib/ics.ts), all in what subscribers' calendar apps actually
ingest.*

## The bugs → fixes

**a) Timed collapsed runs exported one day.** `endStamp` only knew `end`;
`multiDayEnd` was consulted solely in the all-day branch — a 67-day run landed
in calendars as day 1 only. Now `endStamp` consults `spanEnd()` (the same
true-span reader the site uses, rule 5): DTEND lands on the run's LAST day.
Fixes the .ics download, both feed VEVENTs, and the Google link's timed form
in one place.

**b) The Google button invented clock times for all-day events.** The .ics
branch did DATE values right; `googleCalendarUrl` ignored `allDay` and turned a
fair into a 12:00 AM–2:00 AM appointment. Now all-day events emit Google's
`YYYYMMDD/YYYYMMDD` DATE form, end-exclusive, from the same `spanLastDay` +
`nextDay` helpers as DTEND — one span logic, two serializations.

**c) `foldLine` folded at 75 UTF-16 code units, not octets.** RFC 5545's limit
is bytes; an emoji title (venue listings have them) could split a surrogate
pair at the fold and serialize invalid bytes mid-emoji. Now folds count UTF-8
octets and iterate code points, so no character ever splits.

## Verification (observed, not intended)

- **Real prod rows through the new generator:** Skyline Mini Golf (timed run,
  Jun 25 → Aug 30) → `DTSTART:20260625T150000Z / DTEND:20260831T010000Z` — the
  old code would have said June 25. Washington County Fair (all-day, Jul 29 →
  Aug 2) → `20260729/20260803` DATE form in .ics **and** the Google link.
- **node-ical round-trip** (new devDependency, audit stays 0): an emoji-titled
  multi-day timed run parses back byte-exact — summary, start, and last-day end.
- Golden tests +5 (671/671): true-span DTEND · Google timed span · Google
  all-day DATE form with no invented `T` times · octet folding that never
  splits an emoji and unfolds to the exact original · the round-trip.
- All pre-existing single-day goldens unchanged — ordinary events are
  byte-identical to before.
- Gate: tsc clean · 671/671 · build clean · audit 0 (node-ical is dev-only).

## Deploy steps

Push to `main`. Code-only. Subscribed feeds refresh on their own cadence
(calendar apps re-poll; the route revalidates hourly).

## Verify checklist

- [ ] On the live site, open a multi-day event (e.g. Skyline Mini Golf) →
      Add to calendar → the .ics spans the full run.
- [ ] Same event → the Google Calendar button → dates show the full run.
- [ ] Carried from 6.1: subscribe one feed in a real calendar app.

## Rollback

`git revert`. (node-ical is a devDependency; reverting removes it from
package.json — run `npm install` after.)
