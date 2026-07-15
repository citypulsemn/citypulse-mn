import { toIsoWithOffset } from "./seo/event-jsonld";

/**
 * TIME INTEGRITY (roadmap 4.6).
 *
 * THE BUG THIS FIXES: the pipeline inserted the research agent's raw start
 * string straight into a `timestamptz` column, and the database session runs in
 * UTC. So every zone-less or mis-zoned string landed shifted:
 *
 *   "2026-07-16"             → midnight UTC → renders 7 PM THE PREVIOUS DAY
 *                              (the Ramsey County Fair bug from the audit)
 *   "2026-07-18T10:00:00Z"   → 10:00 UTC   → renders 5 AM Central
 *                              (the "5 AM Aquatennial" class)
 *   "2026-07-18T19:30"       → read as UTC → renders 2:30 PM Central
 *                              (even well-formed agent output was shifted!)
 *
 * User submissions were immune — they already went through toIsoWithOffset.
 *
 * THE POLICY: an agent's time is ALWAYS Twin Cities wall-clock. Whatever zone
 * suffix it attached (Z, +00:00, -05:00) is noise from a model trying to look
 * ISO-correct — strip it, keep the clock face, and attach the real Chicago
 * offset (DST-aware) at write time so the stored instant is unambiguous no
 * matter what timezone the database session uses.
 */

export interface NormalizedTime {
  /** Wall-clock, "YYYY-MM-DDTHH:MM" (Twin Cities local). */
  wallClock: string;
  /** ISO with the correct America/Chicago offset — what gets stored. */
  iso: string;
  /** Date-only input: the event has no meaningful clock time. */
  allDay: boolean;
  /** True when the raw string carried a zone suffix or was date-only. */
  changed: boolean;
}

const DATE_ONLY = /^(\d{4}-\d{2}-\d{2})$/;
// YYYY-MM-DD T HH:MM [:SS[.fff]] [Z | ±HH[:MM]]
const DATE_TIME = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}(?::?\d{2})?)?$/;

/** Normalize an agent-supplied time. Returns null for garbage (skip + log). */
export function normalizeAgentTime(raw: string | null | undefined): NormalizedTime | null {
  const s = (raw ?? "").trim();
  if (!s) return null;

  const dateOnly = s.match(DATE_ONLY);
  if (dateOnly) {
    const wallClock = `${dateOnly[1]}T00:00`;
    return { wallClock, iso: toIsoWithOffset(wallClock), allDay: true, changed: true };
  }

  const m = s.match(DATE_TIME);
  if (!m) return null;

  const [, day, hh, mm, zone] = m;
  if (Number(hh) > 23 || Number(mm) > 59) return null;
  const wallClock = `${day}T${hh}:${mm}`;

  // An explicit midnight from an agent is a date-only answer wearing a clock —
  // real events don't start at 12:00 AM. Display it as all-day rather than
  // inventing a time. (A genuine midnight event can be set in the admin.)
  const allDay = hh === "00" && mm === "00";

  return {
    wallClock,
    iso: toIsoWithOffset(wallClock),
    allDay,
    changed: Boolean(zone) || allDay,
  };
}

/**
 * Hour before which a start time is improbable for a real Twin Cities event.
 * Nothing on this calendar legitimately starts between midnight and 6:59 AM —
 * a 5 AM art fair or 7 AM (pre-fix) WNBA game is a timezone artifact, not a
 * schedule. All-day placeholders are exempt (their 00:00 isn't a claim).
 */
export const IMPROBABLE_BEFORE_HOUR = 7;

export function isImprobableStart(wallClock: string, allDay: boolean): boolean {
  if (allDay) return false;
  const hour = Number(wallClock.slice(11, 13));
  return Number.isFinite(hour) && hour < IMPROBABLE_BEFORE_HOUR;
}
