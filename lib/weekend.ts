import type { EventRecord } from "./types";
import { daysSpanned } from "./dates";
import { spanEnd, dayOf } from "./multiday";

/**
 * THE EVERGREEN WEEKEND (roadmap 6.3) — pure logic.
 *
 * /this-weekend is one permanent URL that always answers "what's happening
 * this weekend?" — the highest-intent search in local events and the natural
 * Instagram bio link. The URL and title never change; the CONTENT rolls with
 * the clock.
 *
 * THE WEEKEND CLOCK (America/Chicago, like everything on the site):
 *   Mon–Thu → the upcoming Fri/Sat/Sun.
 *   Friday  → today through Sunday (the weekend has begun).
 *   Saturday→ Sat + Sun (tonight still counts; Friday is gone).
 *   Sunday  → Sunday only (it's still the weekend until it isn't).
 * Monday morning it flips to the NEXT weekend — the page is never stale and
 * never shows a day that already ended.
 *
 * GROUPING (no duplicate cards):
 *   - An event STARTING on a weekend day → that day's section.
 *   - A run that started EARLIER and is still going into the weekend
 *     (fairs, exhibitions) → the "Happening all weekend" section on top.
 */

const CHI = "America/Chicago";

// R1.1: chiDayKey's implementation moved to lib/clock.ts (the shared Chicago
// clock); re-exported here so existing imports (feeds, ongoing, admin) hold.
import { chiDayKey } from "./clock";
export { chiDayKey };

/** 0=Sun … 6=Sat for a Date, evaluated in Chicago. */
function chiWeekday(d: Date): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: CHI, weekday: "short" }).format(d);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

/** The remaining days of the current-or-upcoming weekend, as Chicago day keys. */
export function weekendDays(now: Date): string[] {
  const wd = chiWeekday(now);
  if (wd === 0) return [chiDayKey(now)]; // Sunday: still the weekend
  if (wd === 6) return [chiDayKey(now), chiDayKey(addDays(now, 1))]; // Sat + Sun
  const toFriday = 5 - wd; // Mon(1)→4 … Fri(5)→0
  const fri = addDays(now, toFriday);
  return [chiDayKey(fri), chiDayKey(addDays(fri, 1)), chiDayKey(addDays(fri, 2))];
}

/** "July 17–19" (or "July 31 – August 2" across a month boundary). */
export function weekendLabel(days: string[]): string {
  if (days.length === 0) return "";
  const fmt = (key: string, withMonth: boolean) => {
    const d = new Date(`${key}T12:00:00Z`);
    const month = d.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
    const day = d.getUTCDate();
    return withMonth ? `${month} ${day}` : `${day}`;
  };
  const first = days[0];
  const last = days[days.length - 1];
  if (first === last) return fmt(first, true);
  const sameMonth = first.slice(0, 7) === last.slice(0, 7);
  return sameMonth
    ? `${fmt(first, true)}–${fmt(last, false)}`
    : `${fmt(first, true)} – ${fmt(last, true)}`;
}

/** "Friday, July 17" for a day-section heading. */
export function dayHeading(key: string): string {
  return new Date(`${key}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export interface WeekendSection {
  /** Day key, or "ongoing" for the all-weekend section. */
  key: string;
  heading: string;
  events: EventRecord[];
}

/** Day-grouped weekend selection. Pure; feed it published events. */
export function selectWeekend(events: EventRecord[], now: Date): WeekendSection[] {
  const days = weekendDays(now);
  const daySet = new Set(days);

  const ongoing: EventRecord[] = [];
  const byDay = new Map<string, EventRecord[]>(days.map((d) => [d, []]));

  const firstDay = days[0];
  const lastDay = days[days.length - 1];

  for (const e of events) {
    if (e.status !== "published") continue;
    const span = daysSpanned(e);
    if (span.length === 0) continue;

    // TRUE span intersection — not the calendar-capped expansion. 4.4 caps
    // daysSpanned at 14 days so long "ongoing" runs don't flood the calendar
    // grid; but on THIS page a 17-day fair overlapping Saturday absolutely
    // counts (test-caught: the State Fair would otherwise be invisible on
    // the weekend page). Day keys are ISO, so string compare is date compare.
    // R1.5: spanEnd() reads BOTH span sources — multiDayEnd AND a row's own
    // long end_at. The previous line only read multiDayEnd, so a self-spanned
    // 31-day exhibition fell through the cap and vanished from this page
    // while the this-weekend ICS feed (spansDay, same spanEnd) included it.
    const startDay = span[0];
    const trueEnd = spanEnd(e);
    const endDay = trueEnd ? dayOf(trueEnd) : span[span.length - 1];
    if (startDay > lastDay || endDay < firstDay) continue;

    if (daySet.has(startDay)) {
      byDay.get(startDay)!.push(e);
    } else {
      ongoing.push(e); // started before the weekend, still running into it
    }
  }

  const byStart = (a: EventRecord, b: EventRecord) => a.start.localeCompare(b.start);
  ongoing.sort(byStart);

  const sections: WeekendSection[] = [];
  if (ongoing.length > 0) {
    sections.push({ key: "ongoing", heading: "Happening all weekend", events: ongoing });
  }
  for (const d of days) {
    const list = byDay.get(d)!;
    list.sort(byStart);
    if (list.length > 0) sections.push({ key: d, heading: dayHeading(d), events: list });
  }
  return sections;
}
