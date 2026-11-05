import type { EventRecord } from "./types";
import { spanEnd } from "./multiday";
import { EXPAND_MAX_DAYS } from "./dates";
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

// ── The day-page shelf ──────────────────────────────────────────────────────

export const ALSO_RUNNING_CAP = 6;

export interface AlsoRunningPlan {
  /** Capped, ending-soonest first — what the shelf renders. */
  items: OngoingEvent[];
  /** How many qualify in total, so the shelf can link on to /ongoing honestly. */
  total: number;
}

/**
 * ALSO RUNNING — the long runs that are genuinely on for `dayKey` and that the
 * day surfaces cannot show.
 *
 * WHY THIS EXISTS. A run longer than EXPAND_MAX_DAYS appears on its start day
 * and nowhere else: the grid would otherwise paint a 233-day exhibition across
 * 233 cells (the July flood). Correct for the grid, but it left /day/<date>
 * printing "Nothing on the calendar here yet" on days when an exhibition, a
 * play and a flower show were all open — rule 6, honest emptiness, failing on
 * the one page people reach from "things to do in minneapolis <date>".
 *
 * COMPLEMENTARY BY CONSTRUCTION. The day query shows a row when its start day
 * IS `dayKey`, or when it spans `dayKey` with a date diff <= EXPAND_MAX_DAYS - 1.
 * This takes exactly the rest: started STRICTLY BEFORE `dayKey`, still running
 * by TRUE `spanEnd` (never the capped expansion — rule 5), and longer than the
 * cap. No row can land in both lists, and a test pins that.
 *
 * ORDER: ending soonest first. "Last day" is the only urgent thing about a run
 * that has been open for two months.
 *
 * Both callers end here — the /day page (over a prefiltered query) and the
 * homepage day panel (over the whole client set) — so the two surfaces answer
 * the same question the same way. That is the R1.7b lesson: when a server day
 * surface and the SPA day panel apply different membership rules, they drift.
 */
export function alsoRunningPlan(
  events: EventRecord[],
  dayKey: string,
  cap = ALSO_RUNNING_CAP,
): AlsoRunningPlan {
  const out: OngoingEvent[] = [];

  for (const e of events) {
    if (e.status !== "published") continue;
    const startDay = e.start.slice(0, 10);
    // On its own start day the main list already carries it.
    if (!(startDay < dayKey)) continue;
    const end = spanEnd(e);
    if (!end) continue; // single-day events are never "also running"
    const endDay = end.slice(0, 10);
    if (endDay < dayKey) continue; // closed before this day
    // Only what the day query cannot show. This is the exact complement of its
    // `::date <= 13` clause, expressed from the same constant.
    if (dayNum(endDay) - dayNum(startDay) <= EXPAND_MAX_DAYS - 1) continue;
    out.push({ event: e, endDay });
  }

  out.sort(
    (a, b) =>
      a.endDay.localeCompare(b.endDay) ||
      a.event.start.localeCompare(b.event.start) ||
      a.event.title.localeCompare(b.event.title),
  );

  return { items: out.slice(0, cap), total: out.length };
}

/** "Through Aug 2" / "Last day today" for the card eyebrow. */
export function throughLabel(endDay: string, now: Date): string {
  if (endDay === chiDayKey(now)) return "Last day today";
  const d = new Date(`${endDay}T12:00:00Z`);
  return `Through ${d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`;
}

// ── Last chance (roadmap v5 F2.2) ────────────────────────────────────────────
// The urgent slice of ongoing: runs whose TRUE final day lands within the
// next week. "Last weekend for X" is a query people actually type.

export const LAST_CHANCE_DAYS = 7; // today counts — endDay ≤ today + 6
export const MIN_LAST_CHANCE = 3; // honest emptiness: hide the section under 3

/**
 * The ongoing items closing within LAST_CHANCE_DAYS. Input comes from
 * selectOngoing, which sorts ending-soonest — so the result is always a
 * PREFIX of it, and callers may render "the rest" as `ongoing.slice(n)`.
 */
export function selectLastChance(ongoing: OngoingEvent[], now: Date): OngoingEvent[] {
  const cutoff = dayNum(chiDayKey(now)) + LAST_CHANCE_DAYS - 1;
  return ongoing.filter((o) => dayNum(o.endDay) <= cutoff);
}

export interface OngoingStripPlan {
  /** True → the strip wears the "Last chance / Ends this week" labels and
   *  shows ONLY items that genuinely close within the week. */
  lastChance: boolean;
  items: OngoingEvent[];
}

/** What the homepage strip should show. The label swap obeys the honesty
 *  rule twice over: it happens only with MIN_LAST_CHANCE closing soon, and a
 *  swapped strip never pads itself with items that aren't actually closing. */
export function ongoingStripPlan(
  ongoing: OngoingEvent[],
  now: Date,
  cap = 6,
): OngoingStripPlan {
  const lastChance = selectLastChance(ongoing, now);
  if (lastChance.length >= MIN_LAST_CHANCE) {
    return { lastChance: true, items: lastChance.slice(0, cap) };
  }
  return { lastChance: false, items: ongoing.slice(0, cap) };
}
