import type { EventRecord } from "../types";

/**
 * schema.org structured data for events — this is what puts City Pulse into
 * Google's "events near me" surface. Pure functions, unit-tested; the pages
 * render the output inside a <script type="application/ld+json">.
 */

/** Central Time UTC offset for a given YYYY-MM-DD (handles CST/CDT). */
export function chicagoOffset(dayKey: string): "-05:00" | "-06:00" {
  // Noon UTC on that calendar day is safely outside DST-transition edges.
  const noonUTC = new Date(`${dayKey}T12:00:00Z`);
  const name =
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      timeZoneName: "shortOffset",
    })
      .formatToParts(noonUTC)
      .find((p) => p.type === "timeZoneName")?.value ?? "GMT-6";
  return name.includes("-5") ? "-05:00" : "-06:00";
}

/** Turn a wall-clock event string ("2026-07-15T20:00") into an ISO w/ offset. */
export function toIsoWithOffset(local: string): string {
  const dayKey = local.slice(0, 10);
  const time = local.length >= 16 ? local.slice(11, 16) : "00:00";
  return `${dayKey}T${time}:00${chicagoOffset(dayKey)}`;
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
    startDate: toIsoWithOffset(event.start),
    eventStatus:
      event.status === "cancelled"
        ? "https://schema.org/EventCancelled"
        : "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location,
    url,
  };
  if (event.end && event.end !== event.start) data.endDate = toIsoWithOffset(event.end);
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
