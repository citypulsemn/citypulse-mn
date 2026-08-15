import type { EventRecord } from "./types";
import { daysSpanned, evDate } from "./dates";

/**
 * The one true within-a-day ordering (Roadmap UX2 U2), shared by the /day/[date]
 * page and the homepage DayPanel so the two always agree. They used to disagree:
 * the page did raw `order by start_at asc`, which pinned a multi-day festival to the
 * very top of every LATER day by its stale original start time, while the panel
 * grouped spans separately. This is the panel's (correct) rule, extracted:
 *
 *   1. Multi-day / ongoing spans first — they're all-day context, and their clock
 *      start is meaningless on a day mid-run, so sort them alphabetically by title.
 *   2. Then single-day events chronologically by start time. All-day events store a
 *      00:00 start, so they naturally lead the timed group.
 *
 * Pure and side-effect-free — safe to call server-side (the /day page) and in the
 * client DayPanel useMemo. Returns a new array; the input is not mutated.
 */
export function orderDayEvents(events: EventRecord[]): EventRecord[] {
  return [...events].sort((a, b) => {
    const aSpan = daysSpanned(a).length > 1 ? 0 : 1;
    const bSpan = daysSpanned(b).length > 1 ? 0 : 1;
    if (aSpan !== bSpan) return aSpan - bSpan;
    if (aSpan === 0) return a.title.localeCompare(b.title);
    return evDate(a).getTime() - evDate(b).getTime();
  });
}
