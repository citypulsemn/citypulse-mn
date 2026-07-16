import { VENUES } from "./venues";
import type { EventRecord } from "./types";

/**
 * VENUE PAGES (roadmap 6.1) — a page layer over the 4.2 venue registry.
 *
 * The registry (lib/venues.ts) is pipeline config: it tells the weekly agent
 * which calendars to sweep. This module deliberately does NOT touch it —
 * instead it derives the public surface from it: a stable slug per venue,
 * aliases for matching the free-text venue strings that live on events, and
 * helpers that derive a venue's coordinates/address FROM ITS OWN EVENTS
 * (most-common value, so one bad geocode can't move a building).
 *
 * Why registry-first instead of "every distinct venue string gets a page":
 * stable URLs, curated names, and no junk slugs from one-off listings. These
 * are the ~40 rooms people actually search schedules for.
 */

export interface VenuePage {
  slug: string;
  name: string;
  city: string;
  /** Normalized alias forms that should resolve to this venue. */
  aliases: string[];
}

/**
 * Normalize a venue string for matching: lowercase, drop parentheticals,
 * "&" → "and", strip punctuation, drop a leading "the", collapse spaces.
 * "The Hook & Ladder Theater" and "Hook and Ladder Theater" meet in the middle.
 */
export function normalizeVenueName(raw: string): string {
  return (raw ?? "")
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^the /, "");
}

/** Slug from a name: normalized form, hyphenated. */
export function slugifyVenue(name: string): string {
  return normalizeVenueName(name).replace(/ /g, "-");
}

/** Hand-set slugs where the derived one would be awkward as a URL. */
const SLUG_OVERRIDES: Record<string, string> = {
  "First Avenue & 7th St Entry": "first-avenue",
  "Nickelodeon Universe / Mall of America": "nickelodeon-universe",
  "Hennepin County Library (system-wide events)": "hennepin-county-library",
  "Saint Paul Public Library (system-wide events)": "saint-paul-public-library",
};

/** Extra normalized aliases per registry name (beyond the name itself). */
const EXTRA_ALIASES: Record<string, string[]> = {
  "First Avenue & 7th St Entry": ["first avenue", "first ave", "7th st entry", "7th street entry"],
  "The Fillmore Minneapolis": ["fillmore"],
  "Varsity Theater": ["varsity theatre"],
  "Uptown Theater": ["uptown theatre"],
  "The Hook and Ladder Theater": ["hook and ladder", "hook and ladder theater and lounge"],
  "Amsterdam Bar and Hall": ["amsterdam"],
  "The Cedar Cultural Center": ["cedar"],
  "Dakota Jazz Club": ["dakota", "dakota jazz club and restaurant"],
  "Como Park Zoo & Conservatory": ["como zoo", "como park zoo", "como zoo and conservatory"],
  "Nickelodeon Universe / Mall of America": ["mall of america"],
  "Saint Paul Public Library (system-wide events)": ["st paul public library"],
  "Mystic Lake Amphitheater": ["mystic amphitheater"],
  "Xcel Energy Center": ["xcel"],
  "Lake Harriet Bandshell": ["lake harriet band shell"],
  "Crooners Supper Club": ["crooners"],
  "Science Museum of Minnesota": ["science museum"],
};

export const VENUE_PAGES: VenuePage[] = VENUES.map((v) => ({
  slug: SLUG_OVERRIDES[v.name] ?? slugifyVenue(v.name),
  name: v.name,
  city: v.city,
  aliases: [
    normalizeVenueName(v.name),
    ...(EXTRA_ALIASES[v.name] ?? []).map(normalizeVenueName),
  ],
}));

const BY_SLUG = new Map(VENUE_PAGES.map((v) => [v.slug, v]));
const BY_ALIAS = new Map<string, string>();
for (const v of VENUE_PAGES) {
  for (const a of v.aliases) {
    if (!BY_ALIAS.has(a)) BY_ALIAS.set(a, v.slug);
  }
}

export function venuePageBySlug(slug: string): VenuePage | null {
  return BY_SLUG.get(slug) ?? null;
}

/** Match a free-text event venue string to a registry venue page, or null. */
export function matchVenueSlug(venueString: string): string | null {
  const n = normalizeVenueName(venueString);
  if (!n) return null;
  return BY_ALIAS.get(n) ?? null;
}

/**
 * A venue's coordinates, derived from its events: the MOST COMMON (lat,lng)
 * pair. The geocoder returns identical coords for identical addresses, so the
 * mode is the building — and a single bad geocode is outvoted instead of
 * dragging an average into the river.
 */
export function dominantCoords(events: Pick<EventRecord, "lat" | "lng">[]): { lat: number; lng: number } | null {
  const counts = new Map<string, { lat: number; lng: number; n: number }>();
  for (const e of events) {
    if (!Number.isFinite(e.lat) || !Number.isFinite(e.lng) || (e.lat === 0 && e.lng === 0)) continue;
    const key = `${e.lat.toFixed(5)},${e.lng.toFixed(5)}`;
    const cur = counts.get(key) ?? { lat: e.lat, lng: e.lng, n: 0 };
    cur.n += 1;
    counts.set(key, cur);
  }
  let best: { lat: number; lng: number; n: number } | null = null;
  for (const c of counts.values()) if (!best || c.n > best.n) best = c;
  return best ? { lat: best.lat, lng: best.lng } : null;
}

/** Same idea for the street address: most common non-empty string. */
export function dominantAddress(events: Pick<EventRecord, "address">[]): string | null {
  const counts = new Map<string, number>();
  for (const e of events) {
    const a = (e.address ?? "").trim();
    if (a) counts.set(a, (counts.get(a) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [a, n] of counts) if (n > bestN) { best = a; bestN = n; }
  return best;
}

const MAP_ZOOM = 14;
/** Half the rendered pin height above its tip, in style pixels (@1x). */
const PIN_NUDGE_PX = 25;

/**
 * Mapbox Static Images URL — a plain <img>, no JS on an SEO page.
 *
 * CENTERING: Mapbox pins are anchored at their TIP, with the body extending
 * upward — so centering the map on the coordinate puts the pin body entirely
 * in the top half of the image ("the map isn't centered", live report Jul 15).
 * Fix: nudge the map CENTER north by half the pin's height so the pin body
 * sits visually centered. The pin itself stays anchored at the true
 * coordinates — accuracy is untouched, only the framing moves.
 *
 * Pixel→degrees: Mapbox styles use 512px tiles, so meters/px at @1x is
 * 78271.517 × cos(lat) / 2^zoom; divide by 111,320 m/° for latitude degrees.
 */
export function staticMapUrl(lat: number, lng: number, token: string): string {
  const metersPerPx = (78271.517 * Math.cos((lat * Math.PI) / 180)) / 2 ** MAP_ZOOM;
  const nudgeLatDeg = (PIN_NUDGE_PX * metersPerPx) / 111_320;
  const centerLat = +(lat + nudgeLatDeg).toFixed(6);
  const pin = `pin-l+c9a961(${lng},${lat})`;
  return `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/${pin}/${lng},${centerLat},${MAP_ZOOM},0/640x320@2x?access_token=${encodeURIComponent(token)}`;
}
