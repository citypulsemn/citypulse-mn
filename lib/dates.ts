import type { EventRecord, CategoryKey, RangeKey, ViewState } from "./types";

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
export const DOW = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

export const pad = (n: number) => String(n).padStart(2, "0");

export const dkey = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const evDate = (ev: EventRecord) => new Date(ev.start);

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function fmtTime(iso: string): string {
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes();
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return m ? `${h}:${pad(m)} ${ap}` : `${h} ${ap}`;
}

export interface DateWindow {
  start: Date;
  end: Date;
}

/**
 * The active date window, driven by the selected preset.
 * `now` is injected so the logic is deterministic and testable.
 */
export function rangeWindow(now: Date, view: ViewState): DateWindow {
  const today0 = new Date(now);
  today0.setHours(0, 0, 0, 0);

  switch (view.range) {
    case "month":
      return {
        start: new Date(view.year, view.month, 1),
        end: new Date(view.year, view.month + 1, 0, 23, 59, 59),
      };
    case "today": {
      const end = new Date(today0);
      end.setHours(23, 59, 59);
      return { start: today0, end };
    }
    case "week": {
      const end = new Date(today0);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59);
      return { start: today0, end };
    }
    case "weekend": {
      const dow = today0.getDay(); // 0 Sun .. 6 Sat
      const fri = new Date(today0);
      if (dow === 5 || dow === 6) {
        fri.setDate(today0.getDate() - (dow - 5)); // already in the weekend
      } else if (dow === 0) {
        // R1.7 (Taren's call): Sunday is STILL the weekend — one philosophy
        // with /this-weekend. A Sunday-evening tap on "Weekend" means
        // tonight, not five days from now. (Past days clipped below.)
        fri.setDate(today0.getDate() - 2);
      } else {
        fri.setDate(today0.getDate() + ((5 - dow + 7) % 7)); // upcoming Friday
      }
      const sun = new Date(fri);
      sun.setDate(fri.getDate() + 2);
      sun.setHours(23, 59, 59);
      const start = fri < today0 ? today0 : fri; // never include past days
      return { start, end: sun };
    }
  }
}

export function isFocus(range: RangeKey): boolean {
  return range !== "month";
}

/** Events whose start falls inside the window, filtered by active categories, sorted by time. */
export function eventsInWindow(
  events: EventRecord[],
  active: Set<CategoryKey>,
  win: DateWindow,
): EventRecord[] {
  return events
    .filter((ev) => active.has(ev.category))
    .filter((ev) => {
      const d = evDate(ev);
      return d >= win.start && d <= win.end;
    })
    .sort((a, b) => evDate(a).getTime() - evDate(b).getTime());
}

/**
 * UX9 — cross-month search. When the current window shows no matches, are there
 * matching events in a LATER window? Returns the count of matches whose start is
 * after `win.end` and the earliest such date, so the UI can offer "N matches
 * starting September →" instead of a dead-end "no matches". `events` should
 * already be query/price/area-narrowed; category (`active`) is applied here to
 * mirror eventsInWindow. Null when nothing lies ahead.
 */
export function matchesAfterWindow(
  events: EventRecord[],
  active: Set<CategoryKey>,
  win: DateWindow,
): { count: number; firstDate: Date } | null {
  const ahead = events
    .filter((ev) => active.has(ev.category))
    .filter((ev) => evDate(ev) > win.end)
    .sort((a, b) => evDate(a).getTime() - evDate(b).getTime());
  if (ahead.length === 0) return null;
  return { count: ahead.length, firstDate: evDate(ahead[0]) };
}

/** Group a month's events by day key, filtered by active categories. */
export function eventsByDay(
  events: EventRecord[],
  active: Set<CategoryKey>,
): Record<string, EventRecord[]> {
  const byDay: Record<string, EventRecord[]> = {};
  for (const ev of events) {
    if (!active.has(ev.category)) continue;
    // A multi-day festival belongs on EVERY day it spans (roadmap 4.4) — the
    // Aquatennial is genuinely on today, not just on its opening day.
    for (const k of daysSpanned(ev)) {
      (byDay[k] ??= []).push(ev);
    }
  }
  for (const k of Object.keys(byDay)) {
    byDay[k].sort((a, b) => evDate(a).getTime() - evDate(b).getTime());
  }
  return byDay;
}

/** Spotlight classification for a calendar cell. */
export function classifyDay(
  year: number,
  month: number,
  day: number,
  win: DateWindow,
): "inrange" | "outrange" {
  const ds = new Date(year, month, day, 0, 0, 0);
  const de = new Date(year, month, day, 23, 59, 59);
  return de >= win.start && ds <= win.end ? "inrange" : "outrange";
}

export function shortDate(d: Date): string {
  return `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
}

export function windowLabel(win: DateWindow): string {
  return sameDay(win.start, win.end)
    ? shortDate(win.start)
    : `${shortDate(win.start)} – ${shortDate(win.end)}`;
}


/**
 * The day keys an event occupies. One for a normal event; every day of the run
 * for a multi-day festival (roadmap 4.4). Capped so a bad `multi_day_end` can't
 * balloon the calendar.
 */
/**
 * Spans longer than this show on their start day only. A 12-day State Fair
 * belongs on every day it runs; a three-month museum exhibition repeated on
 * ninety calendar cells buries everything else (this actually happened — the
 * calendar showed the same three exhibitions on every day of July).
 */
export const EXPAND_MAX_DAYS = 14;

export function daysSpanned(ev: EventRecord): string[] {
  const start = dkey(evDate(ev));
  // Same rule as lib/multiday.ts spanEnd: a span can come from the 4.4 collapse
  // (multiDayEnd) OR from the event's own end landing on a later date.
  // Mirrors lib/multiday.ts spanEnd, including the late-night rule (an event
  // ending before 6 AM the next morning is not a two-day span).
  const startDay = ev.start.slice(0, 10);
  let endISO: string | null = null;
  if (ev.multiDayEnd && ev.multiDayEnd.slice(0, 10) > startDay) {
    endISO = ev.multiDayEnd;
  } else if (ev.end && ev.end.slice(0, 10) > startDay) {
    const nextDay = new Date(`${startDay}T12:00:00`);
    nextDay.setDate(nextDay.getDate() + 1);
    const isNextDay = ev.end.slice(0, 10) === dkey(nextDay);
    const smallHours = Number(ev.end.slice(11, 13) || "0") < 6;
    if (!(isNextDay && smallHours)) endISO = ev.end;
  }
  if (!endISO) return [start];
  const endKey = endISO.slice(0, 10);
  if (endKey <= start) return [start];

  const out: string[] = [];
  const cur = new Date(`${start}T12:00:00`);
  const end = new Date(`${endKey}T12:00:00`);
  for (let i = 0; i < EXPAND_MAX_DAYS && cur <= end; i++) {
    out.push(dkey(cur));
    cur.setDate(cur.getDate() + 1);
  }
  // Longer than the cap ⇒ an ongoing attraction, not a daily event: show it on
  // its start day only instead of flooding the calendar.
  if (cur <= end) return [start];
  return out;
}

/**
 * UX9 — is an event still upcoming/live as of `now`, accounting for multi-day
 * span? THE single source of truth for "does this event still count today",
 * shared by the place INDEX counts and their DETAIL lists. They had diverged:
 * the indexes read only `multiDayEnd` (`e.multiDayEnd ? … : start`), so a slice
 * whose only live event was on the CLOSING day of an `end`-carried span (no
 * collapse `multiDayEnd`) counted 0 and vanished, while the detail page — using
 * daysSpanned — still showed it. daysSpanned derives the span from BOTH sources
 * (multiDayEnd and a genuinely-later `end`), so routing both through it here
 * makes the count and the list agree by construction.
 */
export function isUpcoming(ev: EventRecord, now: Date): boolean {
  const startMs = new Date(ev.start).getTime();
  if (Number.isNaN(startMs)) return false;
  const lastDay = daysSpanned(ev).at(-1)!; // always ≥ 1 entry (the start day)
  const endMs = new Date(`${lastDay}T23:59`).getTime();
  return Math.max(startMs, endMs) >= now.getTime();
}

/**
 * The clock label for an event: "All day" for date-only events (roadmap 4.6 —
 * never invent a fake time), otherwise the formatted start time.
 */
export function timeLabel(ev: Pick<EventRecord, "start" | "allDay">): string {
  return ev.allDay ? "All day" : fmtTime(ev.start);
}
