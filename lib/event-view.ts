import type { EventRecord, EventStatus } from "./types";
import { DOW, MONTHS } from "./dates";
import { chiWallClock } from "./clock";

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
