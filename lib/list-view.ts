import { dkey, evDate, spanEndISO } from "./dates";
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

export const LIST_ONGOING_CAP = 6;

export interface ListPlan {
  /** Started before the window and still running — capped, ending soonest first. */
  ongoing: EventRecord[];
  /** How many qualify in total, so the heading can be honest about the cap. */
  ongoingTotal: number;
  /** Everything that STARTS inside the window, grouped by day as before. */
  days: DayGroup[];
}

/**
 * What the homepage list should render (5 Nov 2026).
 *
 * Until today `eventsInWindow` dropped every mid-run event before the list saw
 * it, so `groupEventsByDay`'s clamp branch below — written for exactly this case,
 * and covered by a test since UX4 — had never once run in production. Fixing the
 * predicate makes it live, and on the default Today range that would have put 23
 * events, most of them months-long exhibitions, at the top of a 33-item list
 * ahead of the 10 things actually starting. That is the calendar-flood incident
 * arriving by a different door.
 *
 * So the mid-run ones get their own capped group, ordered ending-soonest, the
 * same shape `/day/<date>` and `/this-weekend` already use. `groupEventsByDay`
 * is deliberately untouched: `/this-week` shares it.
 */
export function planListView(
  events: EventRecord[],
  windowStartKey: string,
  cap = LIST_ONGOING_CAP,
): ListPlan {
  const ongoing: EventRecord[] = [];
  const starting: EventRecord[] = [];
  for (const e of events) {
    if (dkey(evDate(e)) < windowStartKey) ongoing.push(e);
    else starting.push(e);
  }

  const endKey = (e: EventRecord) => spanEndISO(e)?.slice(0, 10) ?? dkey(evDate(e));
  ongoing.sort(
    (a, b) => endKey(a).localeCompare(endKey(b)) || a.title.localeCompare(b.title),
  );

  return {
    ongoing: ongoing.slice(0, cap),
    ongoingTotal: ongoing.length,
    days: groupEventsByDay(starting, windowStartKey),
  };
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
