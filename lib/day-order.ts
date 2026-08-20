import type { EventRecord } from "./types";
import { evDate, timeLabel, MONTHS } from "./dates";
import { spanEnd } from "./multiday";

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

/**
 * What to show in a day card's time slot, for the day you're looking at.
 *
 * The problem this solves: an event that began earlier stores the FIRST day's
 * clock time, so a run that opened Aug 13 at 10 AM rendered "10 AM" on Aug 21 —
 * a real-looking time that is simply not today's. Grouping it under "Already
 * running" explained the ORDER but left the number lying.
 *
 *   - began earlier → how much longer you have: "Last day" or "Through Aug 23".
 *     Never a clock time we cannot stand behind.
 *   - starts today → its actual start time, EVEN IF it runs on for days. A play
 *     opening tonight at 8 PM should say 8 PM; that it also runs Saturday is on
 *     the event page, and on a day view "when today" is the useful fact.
 *
 * Pure. `dayKey` is a Chicago wall date ("YYYY-MM-DD"), compared as a string.
 */
export function dayTimeLabel(ev: EventRecord, dayKey: string): string {
  if (ev.start.slice(0, 10) >= dayKey) return timeLabel(ev);

  const end = spanEnd(ev);
  const endDay = end?.slice(0, 10);
  if (!endDay || endDay < dayKey) return "Ongoing"; // no usable end — say only what we know
  if (endDay === dayKey) return "Last day";

  const d = new Date(`${endDay}T12:00:00`); // noon-anchored: DST can't shift the date
  return `Through ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
}
