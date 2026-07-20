# Deploy R1.2 — collections stop dropping tonight's events every afternoon

*July 20, 2026 (evening). Roadmap v5 sprint R1, item 2 — first mechanical conversion on
the R1.1 clock.*

## The bug (two, actually)

1. `selectCollection` compared `evDate(e).getTime()` — a naive Chicago wall string parsed
   as fake-UTC — against real `now.getTime()`. On UTC servers, every evening event failed
   the "not past" floor from ~1–2 PM CT onward. **Demonstrated on live data at 3:57 PM
   today:** 9 real tonight-events (8 theater curtains + Wanderlight Trail) were being
   dropped from arts-and-culture and family-fun at that hour; the fix restores them.
2. `collectionWindow`'s weekend math ran `getDay()`/`setHours` in the server-local (UTC)
   frame: from Sunday 7 PM CT onward, "this weekend" silently became NEXT weekend.

## What shipped

`lib/collections.ts` rebuilt on `lib/clock.ts` (rule 10):

- `collectionWindow` now returns Chicago wall/day-key bounds (`fromWall`, `endKey`,
  `days`) instead of epoch ms. The weekend kind reuses `weekendDays()` — one owner for
  the "Sunday is still the weekend" philosophy, page and collections finally agreeing.
- `selectCollection` compares walls to walls: the past-floor is `e.start < fromWall`,
  the horizon is day-key ≤ `endKey` (or membership in the weekend's day set). Sorting by
  wall string (same order, no Date parsing).
- Deliberate semantic nudge: week/month/all horizons are now day-granular (through the
  end of the Nth Chicago day) rather than cut mid-day at an epoch offset.

## Tests

28 green across collections + feeds; 3 new: the afternoon boundary (tonight in, this
morning out), the Sunday-evening weekend window (tonight, not next week), and the
window-keys shape. Existing behavior tests passed unmodified except the two that pinned
the old epoch interface.

## Quality gate

tsc clean · 624/624 · build clean · audit 0 · live-data probe (above).

## Deploy steps

Push to `main`. Code-only; collection pages revalidate on their own schedule.

## Verify checklist (post-deploy, any afternoon)

- [ ] ~3 PM or later: an evening show visible on the homepage also appears in its
      collection (e.g. tonight's theater in Arts & Culture).
- [ ] Sunday evening: /collections/date-night shows tonight, not next Friday.

## Rollback

`git revert`. Next mechanical conversions: R1.3 related · R1.4 digest windows ·
R1.5 weekend cap leak · R1.6 verify window · R1.7 cleanups.
