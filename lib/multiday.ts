import type { EventRecord } from "./types";
import { MONTHS } from "./dates";

/**
 * MULTI-DAY EVENTS & DUPLICATES (roadmap 4.4).
 *
 * The live calendar had "Woodbury Days" three times, "Prior Lake Days" three
 * times, "Slavic Experience Festival" three times, "Day Block Brewing Date
 * Night" four times. But those are NOT the same problem, and treating them the
 * same would break the site:
 *
 *   1. MULTI-DAY RUN — a festival that genuinely spans consecutive days. The
 *      pipeline stored one row per day, so a 9-day fair crowds out nine other
 *      events. Fix: collapse to ONE event with a date span ("Jul 20–28").
 *
 *   2. TRUE DUPLICATE — the same event found several times with different venue
 *      guesses ("Lenox Community Center" / "Westwood Hills Nature Center Area" /
 *      "St. Louis Park (venue TBA)"). The existing dedup only merges events
 *      within 250m of each other, so wildly different venue guesses slip past.
 *      Fix: same title + same day + same city ⇒ duplicate, regardless of distance.
 *
 *   3. LEGITIMATE RECURRENCE — a weekly date night or a theatre run. These are
 *      real, separate events on separate days. Fix: LEAVE THEM ALONE. Only
 *      *consecutive* days form a run; a weekly series does not.
 *
 * All of this is pure and unit-tested; the DB routines in lib/upsert.ts apply it.
 */

const DAY_MS = 86_400_000;

/**
 * Canonical title for grouping. Strips the noise the agents add when they find
 * the same event twice: years, "Weekend 1", "(Second Edition)", "2026", trailing
 * punctuation. Deliberately conservative — over-normalizing merges real events.
 */
export function normalizeRunTitle(title: string): string {
  return (title ?? "")
    .toLowerCase()
    .replace(/\b(19|20)\d{2}\b/g, " ") // years
    .replace(/\bweekend\s*\d+\b/g, " ") // "Weekend 1"
    .replace(/\bday\s*\d+\b/g, " ") // "Day 2"
    .replace(/\b(second|third|1st|2nd|3rd)\s+edition\b/g, " ")
    .replace(/\([^)]*\)/g, " ") // parentheticals
    .replace(/[—–-]+\s*$/g, " ")
    .replace(/[''`]/g, "") // possessives: "Sever's" → "severs" (not "sever s")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeCityKey(city: string): string {
  return (city ?? "").toLowerCase().replace(/\bsaint\b/g, "st").replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
}

export function dayOf(iso: string): string {
  return (iso ?? "").slice(0, 10);
}

function dayNumber(iso: string): number {
  return Math.floor(new Date(`${dayOf(iso)}T12:00:00Z`).getTime() / DAY_MS);
}

/** Grouping identity: same event, same town. */
export function runKey(ev: Pick<EventRecord, "title" | "city">): string {
  return `${normalizeRunTitle(ev.title)}|${normalizeCityKey(ev.city)}`;
}

/**
 * SPORTS SERIES ARE NOT RUNS. A homestand is the same title in the same city on
 * consecutive days — "St. Paul Saints vs. Columbus Clippers" appears seven days
 * straight on the live calendar — but each of those is a REAL, SEPARATE game.
 * Collapsing them would archive six real events. So for sports, only SAME-DAY
 * rows may cluster (a true duplicate of one game); a next-day row is always a
 * new game.
 */
function maxGapFor(category: string | undefined): number {
  return category === "sports" ? 0 : 1;
}

export interface RunCluster<T> {
  key: string;
  /** Events sorted by start, forming ONE consecutive run (gaps ≤ 1 day). */
  events: T[];
  startDay: string;
  endDay: string;
  /** True when the run covers more than one calendar day. */
  multiDay: boolean;
}

/**
 * Group events into consecutive-day runs.
 *
 * Two events join the same run only if they share a run key AND their days are
 * adjacent (gap of 0 or 1 day). A weekly series has 7-day gaps, so it never
 * collapses — which is exactly what protects "Day Block Brewing Date Night".
 */
export function groupRuns<
  T extends Pick<EventRecord, "title" | "city" | "start"> & { category?: string },
>(events: T[]): RunCluster<T>[] {
  const byKey = new Map<string, T[]>();
  for (const ev of events) {
    const k = runKey(ev);
    (byKey.get(k) ?? byKey.set(k, []).get(k)!).push(ev);
  }

  const clusters: RunCluster<T>[] = [];

  for (const [key, list] of byKey) {
    const sorted = [...list].sort((a, b) => a.start.localeCompare(b.start));
    let current: T[] = [];

    for (const ev of sorted) {
      if (current.length === 0) {
        current = [ev];
        continue;
      }
      const prevDay = dayNumber(current[current.length - 1].start);
      const gap = dayNumber(ev.start) - prevDay;
      // Same day (a duplicate) or the next day (a continuing run) → same cluster.
      // Sports never continue across days: each game is its own event.
      if (gap <= maxGapFor(ev.category)) {
        current.push(ev);
      } else {
        clusters.push(makeCluster(key, current));
        current = [ev];
      }
    }
    if (current.length > 0) clusters.push(makeCluster(key, current));
  }

  return clusters;
}

function makeCluster<T extends Pick<EventRecord, "start">>(key: string, events: T[]): RunCluster<T> {
  const startDay = dayOf(events[0].start);
  const endDay = dayOf(events[events.length - 1].start);
  return { key, events, startDay, endDay, multiDay: startDay !== endDay };
}

/** Clusters worth acting on: more than one row means a collapse or a merge. */
export function collapsibleClusters<
  T extends Pick<EventRecord, "title" | "city" | "start"> & { category?: string },
>(events: T[]): RunCluster<T>[] {
  return groupRuns(events).filter((c) => c.events.length > 1);
}

// ── Display ───────────────────────────────────────────────────────────────

type Spannable = Pick<EventRecord, "start" | "multiDayEnd"> & { end?: string };

/**
 * The last day an event runs, from EITHER source of span:
 *  - `multiDayEnd`, set by the 4.4 collapse (row-per-day festivals), or
 *  - the event's own `end` when it lands on a later DATE than `start` — some
 *    events arrive as one row with a two-week `end_at` (a county fair on the
 *    live site rendered as "7 PM – 6 PM" because same-day time-range formatting
 *    was applied to a 13-day range).
 * Null for ordinary single-day events.
 */
export function spanEnd(ev: Spannable): string | null {
  if (ev.multiDayEnd && dayOf(ev.multiDayEnd) > dayOf(ev.start)) return ev.multiDayEnd;
  if (ev.end && dayOf(ev.end) > dayOf(ev.start)) {
    // An event ending in the small hours of the next morning is a LATE NIGHT
    // (a 9 PM show ending at 1 AM), not a two-day festival. Only an end at
    // 6 AM or later on a following day counts as a real span.
    const nextMorning =
      dayNumber(ev.end) - dayNumber(ev.start) === 1 &&
      Number((ev.end.slice(11, 13) || "0")) < 6;
    if (!nextMorning) return ev.end;
  }
  return null;
}

/** True when an event spans more than one day. */
export function isMultiDay(ev: Spannable): boolean {
  return spanEnd(ev) !== null;
}

/** "Jul 20 – 28" or "Jul 30 – Aug 2". */
export function multiDayLabel(ev: Spannable): string {
  const a = new Date(`${dayOf(ev.start)}T12:00:00`);
  const b = new Date(`${dayOf(spanEnd(ev) ?? ev.start)}T12:00:00`);
  const left = `${MONTHS[a.getMonth()].slice(0, 3)} ${a.getDate()}`;
  const right =
    a.getMonth() === b.getMonth()
      ? `${b.getDate()}`
      : `${MONTHS[b.getMonth()].slice(0, 3)} ${b.getDate()}`;
  return `${left} – ${right}`;
}

/** Number of days an event runs (1 for a normal event). */
export function runLength(ev: Spannable): number {
  const end = spanEnd(ev);
  if (!end) return 1;
  return dayNumber(end) - dayNumber(ev.start) + 1;
}

/**
 * Does this event occur on `dayKey`? A multi-day festival is happening on every
 * day it spans — so it should surface in "what's on today", not only on day one.
 */
export function spansDay(ev: Spannable, dayKey: string): boolean {
  const start = dayOf(ev.start);
  const end = spanEnd(ev);
  if (!end) return start === dayKey;
  return dayKey >= start && dayKey <= dayOf(end);
}
