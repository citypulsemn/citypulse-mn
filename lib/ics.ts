import { toIsoWithOffset } from "./seo/event-jsonld";
import { SITE_URL } from "./seo/site";
import type { EventRecord } from "./types";

/**
 * Add-to-calendar (roadmap 2.3). Pure, unit-tested generators for a valid
 * iCalendar (.ics) file and a Google Calendar template URL. Times are emitted
 * in UTC (…Z) computed from the event's Central wall-clock, which every calendar
 * app converts correctly to the viewer's local zone — no VTIMEZONE needed.
 */

const DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000; // 2h when the event has no end

/** Central wall-clock ("2026-07-15T20:00") → UTC basic "YYYYMMDDTHHMMSSZ". */
export function icsBasicUTC(centralWallClock: string): string {
  const d = new Date(toIsoWithOffset(centralWallClock));
  return stampFromDate(d);
}

export function stampFromDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

/** Escape a text value per RFC 5545 (backslash, semicolon, comma, newlines). */
export function escapeICS(text: string): string {
  return (text ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Fold a content line to ≤75 chars with CRLF + space continuations. */
export function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let i = 0;
  // First chunk 75, subsequent chunks 74 (they carry a leading space).
  parts.push(line.slice(0, 75));
  i = 75;
  while (i < line.length) {
    parts.push(" " + line.slice(i, i + 74));
    i += 74;
  }
  return parts.join("\r\n");
}

function endStamp(event: EventRecord): string {
  if (event.end && event.end !== event.start) return icsBasicUTC(event.end);
  const start = new Date(toIsoWithOffset(event.start));
  return stampFromDate(new Date(start.getTime() + DEFAULT_DURATION_MS));
}

function locationOf(event: EventRecord): string {
  return [event.venue, event.address, event.city ? `${event.city}, MN` : ""]
    .filter(Boolean)
    .join(", ");
}

export interface IcsOptions {
  baseUrl?: string;
  now?: Date;
}

/** Full VCALENDAR document (CRLF-terminated) for a single event. */
export function eventToICS(event: EventRecord, opts: IcsOptions = {}): string {
  const baseUrl = opts.baseUrl ?? SITE_URL;
  const url = `${baseUrl}/event/${event.id}`;
  const description = [event.description, `More: ${url}`].filter(Boolean).join("\n\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//City Pulse MN//Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.id}@citypulsemn.com`,
    `DTSTAMP:${stampFromDate(opts.now ?? new Date())}`,
    `DTSTART:${icsBasicUTC(event.start)}`,
    `DTEND:${endStamp(event)}`,
    `SUMMARY:${escapeICS(event.title)}`,
    `LOCATION:${escapeICS(locationOf(event))}`,
    `DESCRIPTION:${escapeICS(description)}`,
    `URL:${url}`,
    `STATUS:${event.status === "cancelled" ? "CANCELLED" : "CONFIRMED"}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/** Google Calendar "add event" template URL. */
export function googleCalendarUrl(event: EventRecord, opts: IcsOptions = {}): string {
  const baseUrl = opts.baseUrl ?? SITE_URL;
  const url = `${baseUrl}/event/${event.id}`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${icsBasicUTC(event.start)}/${endStamp(event)}`,
    details: [event.description, `More: ${url}`].filter(Boolean).join("\n\n"),
    location: locationOf(event),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
