import type { EventRecord, CategoryKey, RangeKey, ViewState } from "./types";
import { chiWallClock } from "./clock";

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

/**
 * Events ON during the window, filtered by active categories, sorted by time.
 *
 * RULE 5, THE FOURTH BREAK (fixed 5 Nov 2026). This read `const d = evDate(ev);
 * return d >= win.start && d <= win.end` — the START INSTANT only, with no span
 * awareness of any kind. Not capped like `daysSpanned`; simply blind. Anything
 * that began before the window and runs through it was absent, and unlike the
 * `isUpcoming` break fixed the same day this was never limited to over-cap runs:
 * a THREE-DAY run spanning the window edge vanished too.
 *
 * It feeds the explorer's list view, map view, map list and the "N events match"
 * count (components/EventsExplorer.tsx), and `DEFAULT_VIEW` is the list — so this
 * was the first thing a visitor saw. Measured on live data, 5 Nov 2026:
 *
 *     range      shown   genuinely on   hidden
 *     Today         10             33       23   (70%)
 *     Weekend       58             82       24
 *     Week          89            112       23   (the default range)
 *     Month        313            341       28
 *
 * Four of the 23 hidden from Today were runs of 14 days or LESS — inside
 * EXPAND_MAX_DAYS, so the calendar grid painted them onto today's cell while the
 * list, looking at the same day, said they were not on.
 *
 * Day-key comparison, not instant comparison: every window `rangeWindow` builds
 * is day-aligned (00:00 to 23:59:59), so the two agree, and day keys keep this
 * inside one frame (rule 10).
 */
export function eventsInWindow(
  events: EventRecord[],
  active: Set<CategoryKey>,
  win: DateWindow,
): EventRecord[] {
  const winStart = dkey(win.start);
  const winEnd = dkey(win.end);
  return events
    .filter((ev) => active.has(ev.category))
    .filter((ev) => {
      const startKey = dkey(evDate(ev));
      const end = spanEndISO(ev)?.slice(0, 10);
      const endKey = end && end > startKey ? end : startKey;
      return startKey <= winEnd && endKey >= winStart;
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
 * Spans longer than this show on their start day only. A 12-day State Fair
 * belongs on every day it runs; a three-month museum exhibition repeated on
 * ninety calendar cells buries everything else (this actually happened — the
 * calendar showed the same three exhibitions on every day of July).
 */
export const EXPAND_MAX_DAYS = 14;

/** The loose shape the span rule needs: the 4.4 collapse holds rows, not records. */
export type Spannable = Pick<EventRecord, "start" | "multiDayEnd"> & { end?: string | null };

/**
 * THE SPAN-END RULE for everything that reads an EventRecord. The last day an
 * event runs, from EITHER source of span:
 *   - `multiDayEnd`, written by the 4.4 collapse (row-per-day festivals), or
 *   - the event's own `end`, when it lands on a later DATE than `start`.
 * Null for an ordinary single-day event.
 *
 * WHY IT LIVES HERE. It used to exist twice in the record read path — as
 * lib/multiday.ts `spanEnd` and again inlined in `daysSpanned` below — each with
 * a comment saying it mirrored the other. ENGINEERING rule 5 ("true spans, never
 * capped expansions") has now been broken three times by a surface reaching for
 * the capped list instead of the true end: /this-weekend (R1.5), /ongoing, and
 * `isUpcoming` below. lib/multiday.ts already imports from this module, so this
 * is the end of the graph that can hold the rule without a cycle. `spanEnd`
 * delegates here, and a parity test pins the two together.
 *
 * IT IS NOT THE ONLY COPY IN THE CODEBASE, and two successive reviews on 5 Nov
 * caught this comment undercounting — first claiming it was the only copy, then
 * saying two when the day-page shelf had just added a third. THREE more
 * derivations are live and cannot call this one. Change them with it:
 *   - lib/events.ts readEventsForDay re-expresses the whole thing in SQL, the
 *     sub-6-AM late-night carve-out included, plus EXPAND_MAX_DAYS hardcoded as
 *     `<= 13`. A day query runs in Postgres; it cannot import this.
 *   - lib/events.ts readAlsoRunningForDay is the fourth copy, the same SQL with
 *     the cap inverted to `> 13`, feeding the day page's "Also running" shelf.
 *   - lib/event-view.ts takes a plain string-max of start/end/multiDayEnd with
 *     NO later-date guard and NO late-night rule (`eventTimeState`, live on the
 *     event page via EventDetailBody; `isEnded`, tests only). That one is
 *     deliberately the conservative archive-frame answer, not a bug — but it is
 *     a third answer to the same question.
 */
export function spanEndISO(ev: Spannable): string | null {
  const startDay = (ev.start ?? "").slice(0, 10);
  if (ev.multiDayEnd && ev.multiDayEnd.slice(0, 10) > startDay) return ev.multiDayEnd;
  if (ev.end && ev.end.slice(0, 10) > startDay) {
    // An event ending in the small hours of the next morning is a LATE NIGHT
    // (a 9 PM show ending at 1 AM), not a two-day festival. Only an end at
    // 6 AM or later on a following day counts as a real span. Noon-anchored so
    // a DST jump cannot shift the date.
    const nextDay = new Date(`${startDay}T12:00:00`);
    nextDay.setDate(nextDay.getDate() + 1);
    const isNextDay = ev.end.slice(0, 10) === dkey(nextDay);
    const smallHours = Number(ev.end.slice(11, 13) || "0") < 6;
    if (!(isNextDay && smallHours)) return ev.end;
  }
  return null;
}

/**
 * The day keys an event occupies. One for a normal event; every day of the run
 * for a multi-day festival (roadmap 4.4). CAPPED, deliberately — this answers
 * the calendar grid's question ("which cells do I paint?"), which is NOT the
 * same question as "is this still on" (see `isUpcoming`).
 */
export function daysSpanned(ev: EventRecord): string[] {
  const start = dkey(evDate(ev));
  const endISO = spanEndISO(ev);
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
  // Validity only. `new Date` here never meets a real instant, so it is not the
  // rule-10 comparison that used to live two lines below it.
  if (Number.isNaN(new Date(ev.start).getTime())) return false;
  // RULE 5 — TRUE SPANS, NEVER CAPPED EXPANSIONS (fixed 5 Nov 2026). This line
  // read `daysSpanned(ev).at(-1)`, and daysSpanned returns the START DAY ALONE
  // for a run longer than EXPAND_MAX_DAYS so that a three-month exhibition can't
  // paint ninety calendar cells. Reading the last entry of that list therefore
  // asked the GRID's question in place of this one, and every run over 14 days
  // read as finished from its SECOND DAY.
  //
  // Measured THROUGH THE CALLERS on live data, 5 Nov 2026: of 600 published
  // rows, 530 read as upcoming and 561 do now — 31 rows were running that day
  // and invisible here, and nothing was lost. The Grinch at Children's Theatre
  // was one. TWO venue pages said they had nothing on while an exhibition ran
  // inside them (Minnesota Children's Museum, Minnesota Zoo) and four more
  // under-counted; the /venues index and sitemap.xml share this predicate, so
  // those two pages went unadvertised as well. Honest caveat, recorded with the
  // fix: 7 of the 31 are the daily-admission rows that are not events at all and
  // 6 are duplicate rows of 4 productions, so ~18 distinct real things come back.
  //
  // The non-span case keeps the old value exactly: daysSpanned's first entry is
  // `dkey(evDate(ev))`, and its `endKey <= start` guard is mirrored here.
  const startKey = dkey(evDate(ev));
  const endKey = spanEndISO(ev)?.slice(0, 10);
  const lastDay = endKey && endKey > startKey ? endKey : startKey;
  // RULE 10 — WALLS TO WALLS (fixed 30 Oct 2026). This used to be
  // `new Date(\`${lastDay}T23:59\`).getTime() >= now.getTime()`. That parses a
  // naive Chicago wall string in the SERVER's zone, which on Vercel is UTC, so
  // "23:59" meant 18:59 Chicago. Every event vanished from /venues, /cities,
  // /neighborhoods and their three indexes five hours early — at 7 PM, which is
  // doors, on a site people open to decide where to go tonight.
  // lib/related.ts:24 carries the same note about the same bug, fixed there in
  // R1.3 and missed here. Both sides are naive Chicago strings now, so this is
  // a lexicographic compare inside one frame. The old Math.max was redundant:
  // lastDay is derived from the start day, so its 23:59 is never earlier.
  return `${lastDay}T23:59` >= chiWallClock(now);
}

/**
 * The clock label for an event: "All day" for date-only events (roadmap 4.6 —
 * never invent a fake time), otherwise the formatted start time.
 */
export function timeLabel(ev: Pick<EventRecord, "start" | "allDay">): string {
  return ev.allDay ? "All day" : fmtTime(ev.start);
}

/**
 * Is this Chicago wall clock (`YYYY-MM-DDTHH:MM`) a date with no time of day?
 *
 * THE ONE RULE, and midnight is the whole of it: an agent's explicit 00:00 is a
 * date-only answer wearing a clock (`normalizeAgentTime`), a venue importer
 * writes 00:00 when the calendar prints no time, and `timeLabel` above prints
 * "All day" off the flag those set. Two writers that skipped it put the flag
 * out of step with the clock: on 9 Nov 2026 the correction tool gave 20 rows a
 * show time and left them reading "All day", and the collapse kept a date-only
 * re-find over the timed row it duplicated. Both now ask this function.
 *
 * Lives here because lib/multiday.ts imports this module, and lib/time-integrity.ts
 * imports lib/seo/event-jsonld.ts, which imports lib/multiday.ts — a cycle.
 */
export function isDateOnlyWallClock(wallClock: string): boolean {
  const clock = wallClock.slice(11, 16);
  return clock === "" || clock === "00:00";
}
