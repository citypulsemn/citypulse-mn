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

/** Group a month's events by day key, filtered by active categories. */
export function eventsByDay(
  events: EventRecord[],
  active: Set<CategoryKey>,
): Record<string, EventRecord[]> {
  const byDay: Record<string, EventRecord[]> = {};
  for (const ev of events) {
    if (!active.has(ev.category)) continue;
    const k = dkey(evDate(ev));
    (byDay[k] ??= []).push(ev);
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
