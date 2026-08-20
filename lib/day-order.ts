import type { EventRecord } from "./types";
import { evDate } from "./dates";

/**
 * The one true within-a-day ordering (Roadmap UX2 U2), shared by the /day/[date]
 * page and the homepage DayPanel so the two always agree.
 *
 * THE RULE: does this event START on the day you're looking at?
 *
 *   1. **Ongoing** — it began on an EARLIER day and is still running. Its stored
 *      clock time belongs to that first day, not to today, so sorting by it would
 *      be sorting by a stale number (the original U2 bug: a festival pinned to the
 *      top of every later day by its opening time). These lead, alphabetically,
 *      under an "Ongoing" heading that says why they're not in clock order.
 *   2. **Everything starting today** — chronological by start time. All-day events
 *      store 00:00 and so naturally lead the group.
 *
 * WHY THE RULE CHANGED (Aug 2026): it used to split on "does this span multiple
 * days?", which is a different question and got it wrong. Measured on a real day
 * (Aug 21): 11 events were grouped as spans and sorted alphabetically, but SIX of
 * them started that very day with real showtimes — a play opening at 8 PM that
 * runs through Sunday spans days AND has a meaningful start time today. The panel
 * displayed "8 PM" and then refused to sort by it, which read as simply broken.
 * Only the 5 that genuinely began earlier had a stale time worth protecting from.
 *
 * Pure and side-effect-free — safe server-side (the /day page) and in the client
 * DayPanel useMemo. Returns new arrays; the input is not mutated.
 */

export interface DayGroups {
  /** Began before `dayKey` and still running — no meaningful time today. */
  ongoing: EventRecord[];
  /** Starts on `dayKey`, in clock order. */
  timed: EventRecord[];
}

export function splitDayEvents(events: EventRecord[], dayKey: string): DayGroups {
  const ongoing: EventRecord[] = [];
  const timed: EventRecord[] = [];
  for (const e of events) {
    // `start` is a Chicago wall string ("YYYY-MM-DDTHH:MM"), so a string compare
    // of the date half is frame-pure — no Date parsing, no timezone drift.
    if (e.start.slice(0, 10) < dayKey) ongoing.push(e);
    else timed.push(e);
  }
  ongoing.sort((a, b) => a.title.localeCompare(b.title));
  timed.sort((a, b) => evDate(a).getTime() - evDate(b).getTime());
  return { ongoing, timed };
}

/** The flat render order: ongoing first, then today's events by the clock. */
export function orderDayEvents(events: EventRecord[], dayKey: string): EventRecord[] {
  const { ongoing, timed } = splitDayEvents(events, dayKey);
  return [...ongoing, ...timed];
}
