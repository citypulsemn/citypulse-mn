# Deploy — U2: day view chronological order (align both surfaces)

*Roadmap UX2 U2 (Taren's list #7). Aug 14, 2026. Size S.*

## What shipped

One shared, tested ordering for the events within a single day, used by **both** the
`/day/[date]` page and the homepage **DayPanel** so they always agree. Order:

1. **Multi-day / ongoing spans first** (all-day context), alphabetical by title —
   their clock start is meaningless on a day mid-run.
2. **Then single-day events chronologically by start time** (all-day events store a
   00:00 start, so they lead the timed group).

## Why (the actual bug)

"#7 chronological by start time" turned out to be mostly *already done* — but the two
day surfaces **disagreed**, and the page had a real quirk:
- `/day/[date]` did raw `order by start_at asc` (`lib/events.ts:202`), which pinned a
  multi-day festival to the very top of every *later* day by its **stale original
  start time**.
- The homepage DayPanel already grouped spans separately and sorted timed events by
  clock time (`EventsExplorer.tsx:233-242`).

So the fix is *alignment*: extract the panel's (correct) rule into a pure helper and
apply it to the page too, which also removes the stale-start pinning.

## Design decisions

- **One pure function, `lib/day-order.ts` `orderDayEvents(events)`** — both surfaces
  call it, so they can't drift again. Pure and side-effect-free (safe server-side on
  the `/day` page and in the client DayPanel `useMemo`); returns a new array, never
  mutates.
- **Reuses `daysSpanned`** (`lib/dates.ts`) to decide what "multi-day" means, so the
  ordering agrees with the calendar cells and the span-expansion rules everywhere.
- **`/day` page reorders before the JSON-LD too**, so the `ItemList` position matches
  the visible order.
- **Known/intentional edge:** an "ongoing" event whose span exceeds the 14-day cap
  (e.g. a 6-month museum exhibit) is treated by `daysSpanned` app-wide as a
  start-day-only single event, so it sorts within the timed group on its start day
  rather than the spans group. This is pre-existing `daysSpanned` semantics and is
  consistent across both surfaces — not changed here.

## Files

- `lib/day-order.ts` — new shared `orderDayEvents` helper.
- `components/EventsExplorer.tsx` — DayPanel's `dayEvents` now calls `orderDayEvents`
  (inline comparator removed; unused `evDate` import dropped).
- `app/day/[date]/page.tsx` — `orderDayEvents(await getEventsForDay(date))`.
- `lib/__tests__/day-order.test.ts` — 6 golden tests.

## Verification (observed)

- `npx tsc --noEmit` clean · `npm run build` clean · `npm audit` 0.
- `npm test` — **1022 passed**; `day-order` 6/6: timed sort by start; all-day leads;
  spans first; **spans ordered by title not stale start** (the regression); no mutation;
  empty input.
- **Live smoke** `/day/2026-08-15` (real data, ~45 events): renders multi-day spans
  first alphabetized (Anoka Food Truck Festival → … → St. Paul Park Heritage Days),
  then timed chronological — 8 AM → 8:30 AM → 11 AM → 12 PM → 2 PM → 6 PM → 6:10 PM →
  7 PM → 7:30 PM → 8 PM. (The DayPanel uses the identical helper; its ordering was
  already this and is unchanged.)
  - *Note:* the recurring stale `EventsExplorer.tsx:474 <footer>` console error is a
    dev-server `.next`-collision phantom (that code isn't on disk; tsc + build pass);
    not related to this change.

## Deploy / rollback

Merge to `main` — Vercel auto-deploys. No schema/env change. Rollback: revert this
commit (helper + two call sites + tests removed together).
