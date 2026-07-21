import type { EventRecord, EventStatus } from "./types";
import { DOW, MONTHS } from "./dates";
import { chiWallClock, wallToInstant } from "./clock";
import { DEFAULT_DURATION_MS } from "./ics";

/** Publicly viewable = anything except an unpublished draft. */
export function isPublicStatus(status: EventStatus): boolean {
  return status !== "draft";
}

/** The YYYY-MM-DD a (local) event start falls on. */
export function dayKeyOf(event: Pick<EventRecord, "start">): string {
  return event.start.slice(0, 10);
}

// R1.1: chiWallClock moved to its permanent home in lib/clock.ts (the shared
// Chicago clock). Re-exported here for compatibility with R0.1-era imports.
export { chiWallClock } from "./clock";

/**
 * True if the event is over (R0.1). Compares WALL CLOCK to WALL CLOCK —
 * event times are stored as naive Chicago strings, so "now" must be converted
 * into the same frame, never the reverse (`new Date(wallString)` on a UTC
 * server reads 7 PM Chicago as 7 PM UTC and ends every evening event at
 * ~2 PM CT — the bug this replaced, live on prod Jul 20). The effective end
 * is the TRUE span end: the latest of multiDayEnd / end / start (rule 5).
 * All-day events end at end-of-day, not midnight.
 */
export function isEnded(
  event: Pick<EventRecord, "start" | "end" | "multiDayEnd" | "allDay">,
  now: Date,
): boolean {
  const nowWall = chiWallClock(now);
  const endWall = [event.start, event.end || "", event.multiDayEnd || ""].reduce((a, b) =>
    b > a ? b : a,
  );
  if (event.allDay) return nowWall.slice(0, 10) > endWall.slice(0, 10);
  return nowWall > endWall;
}

/** "Starts in N hours" appears only inside this window — beyond it the date
 *  row is the honest answer and a countdown is just noise. */
export const SOON_HORIZON_HOURS = 12;

export type EventTimeState =
  | { kind: "upcoming" } // no banner — the When row speaks for itself
  | { kind: "soon"; minutesUntil: number }
  | { kind: "now" }
  | { kind: "ended" };

/**
 * F2.1 — the three honest time-states for an event page, replacing the binary
 * ended/not. Pure, wall-frame-correct (rule 10: wall times cross into instants
 * only through wallToInstant, then instant compares to instant).
 *
 * "Happening now" runs from start to the TRUE span end (rule 5). An event with
 * NO recorded end counts as happening for DEFAULT_DURATION_MS (2h) — the same
 * assumption every .ics/Google export already hands to calendars, so the page
 * and the calendar file never disagree. (isEnded above stays the conservative
 * archive-frame answer; this is the live-page answer.)
 *
 * All-day events: "now" across their span days, never a countdown — a fair's
 * stored midnight start is a date, not a doors-open time.
 */
export function eventTimeState(
  event: Pick<EventRecord, "start" | "end" | "multiDayEnd" | "allDay">,
  now: Date,
): EventTimeState {
  const endWall = [event.start, event.end || "", event.multiDayEnd || ""].reduce((a, b) =>
    b > a ? b : a,
  );

  if (event.allDay) {
    const nowDay = chiWallClock(now).slice(0, 10);
    if (nowDay > endWall.slice(0, 10)) return { kind: "ended" };
    if (nowDay >= event.start.slice(0, 10)) return { kind: "now" };
    return { kind: "upcoming" };
  }

  const nowMs = now.getTime();
  const startMs = wallToInstant(event.start).getTime();
  const endMs =
    endWall > event.start ? wallToInstant(endWall).getTime() : startMs + DEFAULT_DURATION_MS;

  if (nowMs > endMs) return { kind: "ended" };
  if (nowMs >= startMs) return { kind: "now" };
  const minutesUntil = Math.ceil((startMs - nowMs) / 60_000);
  if (minutesUntil <= SOON_HORIZON_HOURS * 60) return { kind: "soon", minutesUntil };
  return { kind: "upcoming" };
}

/** Banner copy for a time state; null means render nothing. */
export function timeStateLabel(state: EventTimeState): string | null {
  switch (state.kind) {
    case "ended":
      return "This event has already happened.";
    case "now":
      return "Happening now";
    case "soon": {
      if (state.minutesUntil < 60) {
        return `Starts in ${state.minutesUntil} minute${state.minutesUntil === 1 ? "" : "s"}`;
      }
      const hours = Math.round(state.minutesUntil / 60);
      return `Starts in ${hours} hour${hours === 1 ? "" : "s"}`;
    }
    default:
      return null;
  }
}

/** A ~200-char meta/OG description for an event page. */
export function eventMetaDescription(event: EventRecord): string {
  const d = new Date(event.start);
  const when = `${DOW[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
  const where = [event.venue, event.city].filter(Boolean).join(", ");
  const base = `${when} at ${where}. ${event.price}.`;
  const desc = event.description ? ` ${event.description}` : "";
  return (base + desc).replace(/\s+/g, " ").trim().slice(0, 200);
}

/** A Mapbox Static Images URL for a gold pin at the venue, or null if unusable. */
export function staticMapUrl(
  lat: number,
  lng: number,
  token: string | undefined,
): string | null {
  if (!token || !Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
    return null;
  }
  const c = `${lng},${lat}`;
  return (
    `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/` +
    `pin-l+c9a961(${c})/${c},13,0/720x280@2x?access_token=${token}`
  );
}

/** "Sat, Jul 4, 2026" from a YYYY-MM-DD key (site-consistent abbreviations). */
export function longDate(dayKey: string): string {
  if (!isValidDayKey(dayKey)) return dayKey;
  const [y, m, d] = dayKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${DOW[dt.getDay()]}, ${MONTHS[dt.getMonth()]} ${d}, ${y}`;
}

/** Validates a YYYY-MM-DD route param corresponds to a real date. */
export function isValidDayKey(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}
