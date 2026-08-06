import type { EventRecord } from "../types";
import { spanEnd } from "../multiday";

/**
 * schema.org structured data for events — this is what puts City Pulse into
 * Google's "events near me" surface. Pure functions, unit-tested; the pages
 * render the output inside a <script type="application/ld+json">.
 */

/**
 * Serialize JSON-LD for a <script> block (R0.6). JSON.stringify escapes
 * quotes but NOT `<` — a scraped or submitted title containing
 * "</script><img onerror=…>" would terminate the script block and execute in
 * every visitor's browser. Escaping every `<` as a unicode escape (backslash
 * u003c) is invisible to JSON parsers and to Google, and closes the breakout.
 * EVERY ld+json render goes through this — never raw JSON.stringify
 * (tripwire-tested).
 */
export function jsonLdSafe(obj: unknown): string {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

// R1.1: chicagoOffset's implementation moved to lib/clock.ts (the shared
// Chicago clock), upgraded to probe the ACTUAL hour — the old noon probe was
// an hour off for small-hours times on DST-transition days. Re-exported here
// for compatibility (ics.ts and tests import it from this module).
import { chicagoOffset } from "../clock";
export { chicagoOffset };

/** Turn a wall-clock event string ("2026-07-15T20:00") into an ISO w/ offset. */
export function toIsoWithOffset(local: string): string {
  const dayKey = local.slice(0, 10);
  const time = local.length >= 16 ? local.slice(11, 16) : "00:00";
  // Full wall string → the offset of the actual moment (R1.7c fix rides R1.1).
  return `${dayKey}T${time}:00${chicagoOffset(`${dayKey}T${time}`)}`;
}

/** Lowest dollar amount mentioned in a price string, or null. */
export function lowestPrice(price: string): number | null {
  const nums = (price.match(/\d+(?:\.\d{2})?/g) ?? [])
    .map(Number)
    .filter((n) => Number.isFinite(n));
  return nums.length ? Math.min(...nums) : null;
}

export interface JsonLdOptions {
  baseUrl: string;
  imageUrl?: string;
}

/** schema.org Event object for a single event. */
export function eventJsonLd(event: EventRecord, opts: JsonLdOptions): Record<string, unknown> {
  const url = `${opts.baseUrl}/event/${event.id}`;

  const location: Record<string, unknown> = {
    "@type": "Place",
    name: event.venue,
    address: {
      "@type": "PostalAddress",
      streetAddress: event.address || undefined,
      addressLocality: event.city || undefined,
      addressRegion: "MN",
      addressCountry: "US",
    },
  };
  if (Number.isFinite(event.lat) && Number.isFinite(event.lng) && !(event.lat === 0 && event.lng === 0)) {
    location.geo = {
      "@type": "GeoCoordinates",
      latitude: event.lat,
      longitude: event.lng,
    };
  }

  // Offers: free → 0; a known low price → that; otherwise omit.
  let offers: Record<string, unknown> | undefined;
  const low = lowestPrice(event.price);
  if (event.priceTier === "Free") {
    offers = { "@type": "Offer", price: "0", priceCurrency: "USD", availability: "https://schema.org/InStock", url: event.ticketUrl || url };
  } else if (low != null) {
    offers = { "@type": "Offer", price: String(low), priceCurrency: "USD", availability: "https://schema.org/InStock", url: event.ticketUrl || url };
  }

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    eventStatus:
      event.status === "cancelled"
        ? "https://schema.org/EventCancelled"
        : "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location,
    url,
  };

  // Structured dates (UX8), mirroring the R2.5 ICS fix that never reached here:
  //  - all-day events emit schema.org DATE values (YYYY-MM-DD), never a
  //    fabricated midnight time that renders as "12:00 AM" in a rich result;
  //  - end uses the TRUE span (multiDayEnd or a genuinely-later end, rule 5),
  //    so Google sees a multi-day festival as multi-day, not single-day.
  const span = spanEnd(event); // true span end wall string, or null
  if (event.allDay) {
    const startDay = event.start.slice(0, 10);
    data.startDate = startDay;
    const lastDay = (span ?? event.end ?? "").slice(0, 10);
    if (lastDay && lastDay > startDay) data.endDate = lastDay;
  } else {
    data.startDate = toIsoWithOffset(event.start);
    const endWall = span ?? (event.end && event.end !== event.start ? event.end : null);
    if (endWall) data.endDate = toIsoWithOffset(endWall);
  }
  if (event.description) data.description = event.description;
  if (opts.imageUrl) data.image = [opts.imageUrl];
  if (offers) data.offers = offers;

  return data;
}

/** schema.org ItemList linking to each event on a day page. */
export function dayItemListJsonLd(
  events: EventRecord[],
  opts: JsonLdOptions,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: events.map((e, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${opts.baseUrl}/event/${e.id}`,
      name: e.title,
    })),
  };
}
