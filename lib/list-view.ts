import { dkey, evDate } from "./dates";
import type { EventRecord } from "./types";

/**
 * Grouping for the homepage LIST view (UX4). The list renders the windowed,
 * filtered events chronologically — the surface the date presets should have
 * produced all along, and the one that reads on a phone (the calendar hides
 * titles below 820px).
 *
 * Ongoing events whose start precedes the window (a festival mid-run) are
 * clamped to the window's first day, so they appear at the TOP of the list
 * rather than under a header for a date that's already passed.
 */
export interface DayGroup {
  key: string; // YYYY-MM-DD
  events: EventRecord[];
}

export function groupEventsByDay(events: EventRecord[], windowStartKey: string): DayGroup[] {
  const byDay = new Map<string, EventRecord[]>();
  for (const e of events) {
    const startKey = dkey(evDate(e));
    const key = startKey < windowStartKey ? windowStartKey : startKey;
    const arr = byDay.get(key);
    if (arr) arr.push(e);
    else byDay.set(key, [e]);
  }
  return [...byDay.keys()]
    .sort()
    .map((key) => ({
      key,
      events: byDay
        .get(key)!
        .slice()
        .sort((a, b) => evDate(a).getTime() - evDate(b).getTime()),
    }));
}
