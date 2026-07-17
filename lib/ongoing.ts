import type { EventRecord } from "./types";
import { spanEnd } from "./multiday";
import { chiDayKey } from "./weekend";

/**
 * THE ONGOING STRIP (roadmap 2.2) — a home for the long runs.
 *
 * Runs longer than EXPAND_MAX_DAYS (14) deliberately appear only at their
 * start in the calendar grid — correct for the grid, but it makes a 3-week
 * exhibition nearly invisible mid-run. /this-weekend solved this locally
 * ("Happening all weekend"); this generalizes it: exhibitions, fairs,
 * restaurant weeks, haunted attractions get a persistent, browsable surface.
 *
 * DEFINITION (pure): an event is "ongoing" when
 *   - it STARTED before today (startDay < today) — something starting today
 *     belongs to today's calendar, not the ongoing shelf;
 *   - it's STILL RUNNING (endDay >= today), by TRUE span — spanEnd(), never
 *     the calendar-capped daysSpanned (the weekend-page lesson: a 17-day
 *     fair must not vanish because the grid caps expansion at 14 days);
 *   - the whole run is LONGER THAN 3 DAYS — a Fri–Sun run is a weekend
 *     thing, not an "ongoing" thing.
 *
 * ORDER: ending soonest first — "last chance" is the editorial angle. A show
 * closing Sunday matters more than one running through November. Cap 12.
 * The strip self-hides below MIN_ONGOING (the trending honesty rule: no sad
 * placeholders).
 */

export const ONGOING_CAP = 12;
export const MIN_ONGOING = 3;
export const MIN_RUN_DAYS = 4; // span must exceed 3 days

function dayNum(key: string): number {
  return Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10)) / 86_400_000;
}

export interface OngoingEvent {
  event: EventRecord;
  /** YYYY-MM-DD of the run's true final day. */
  endDay: string;
}

/** Pure selection; feed it published events and the current time. */
export function selectOngoing(events: EventRecord[], now: Date): OngoingEvent[] {
  const today = chiDayKey(now);
  const out: OngoingEvent[] = [];

  for (const e of events) {
    if (e.status !== "published") continue;
    const startDay = e.start.slice(0, 10);
    if (!(startDay < today)) continue; // must have started BEFORE today
    const end = spanEnd(e);
    if (!end) continue; // single-day events are never ongoing
    const endDay = end.slice(0, 10);
    if (endDay < today) continue; // already closed
    if (dayNum(endDay) - dayNum(startDay) + 1 <= MIN_RUN_DAYS - 1) continue; // > 3 days
    out.push({ event: e, endDay });
  }

  out.sort(
    (a, b) => a.endDay.localeCompare(b.endDay) || a.event.start.localeCompare(b.event.start),
  );
  return out.slice(0, ONGOING_CAP);
}

/** "Through Aug 2" / "Last day today" for the card eyebrow. */
export function throughLabel(endDay: string, now: Date): string {
  if (endDay === chiDayKey(now)) return "Last day today";
  const d = new Date(`${endDay}T12:00:00Z`);
  return `Through ${d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`;
}
