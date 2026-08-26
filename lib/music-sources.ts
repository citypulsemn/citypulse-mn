import type { SportsVenue } from "./sports-sources";

/**
 * VENUE REGISTRY for the music importer.
 *
 * One calendar so far: First Avenue's, which is the densest single source of
 * live music in the Twin Cities — six rooms and about a quarter of every music
 * listing on the site, published by the people doing the booking.
 *
 * `authoritative` is the important column. First Avenue's calendar is the last
 * word on what is happening in the Mainroom, the Entry, the Turf Club, Fine
 * Line, the Palace and the Fitzgerald — if it shows nothing there on a Tuesday,
 * nothing is there. It is NOT the last word on the Armory or the Cedar, which it
 * merely promotes into; a show missing from their page says nothing about those
 * buildings, so listings there are only ever added or confirmed, never hidden.
 *
 * Coordinates are pinned here for the same reason as the sports venues: these
 * rooms don't move, and it keeps Mapbox out of the import path. Taken from the
 * rows already in the database — except the Fitzgerald, which had two different
 * coordinate pairs, one of them ten miles out. The downtown St Paul one is right.
 */

export interface MusicVenue extends SportsVenue {
  /** Name exactly as the source calendar prints it. */
  feedName: string;
  /** Can this calendar prove a NEGATIVE about this room? */
  authoritative: boolean;
  /** ILIKE patterns matching how our own listings spell this room. */
  titleVenuePatterns: string[];
}

const FIRST_AVE_BLOCK = {
  city: "Minneapolis",
  address: "701 First Avenue North",
  lat: 44.978304,
  lng: -93.276062,
};

export const FIRST_AVENUE_VENUES: MusicVenue[] = [
  {
    feedName: "First Avenue",
    name: "First Avenue",
    ...FIRST_AVE_BLOCK,
    authoritative: true,
    // Not '%first avenue%' alone: that also catches "First Avenue & 7th St
    // Entry (7th St Entry)", which is the OTHER room and must not be folded in.
    titleVenuePatterns: ["First Avenue", "First Avenue & 7th St Entry", "First Ave"],
  },
  {
    feedName: "7th St Entry",
    name: "7th St Entry",
    ...FIRST_AVE_BLOCK,
    authoritative: true,
    titleVenuePatterns: ["7th St Entry", "7th Street Entry", "First Avenue & 7th St Entry (7th St Entry)"],
  },
  {
    feedName: "Turf Club",
    name: "Turf Club",
    city: "St. Paul",
    address: "1601 University Ave W",
    lat: 44.955902,
    lng: -93.167966,
    authoritative: true,
    titleVenuePatterns: ["Turf Club", "Turf Club (St Paul)"],
  },
  {
    feedName: "Fine Line",
    name: "Fine Line",
    city: "Minneapolis",
    address: "318 N 1st Ave",
    lat: 44.981630,
    lng: -93.272166,
    authoritative: true,
    titleVenuePatterns: ["Fine Line", "Fine Line Music Cafe", "Fine Line (Minneapolis)"],
  },
  {
    feedName: "Palace Theatre",
    name: "Palace Theatre",
    city: "Saint Paul",
    address: "17 W 7th Pl",
    lat: 44.946774,
    lng: -93.097212,
    authoritative: true,
    titleVenuePatterns: ["Palace Theatre", "The Palace Theatre", "Palace Theater"],
  },
  {
    feedName: "The Fitzgerald Theater",
    name: "Fitzgerald Theater",
    city: "Saint Paul",
    // The DB holds two coordinate pairs for this room; the other one lands in
    // Inver Grove Heights. This is the downtown St Paul building.
    address: "10 E Exchange St",
    lat: 44.948228,
    lng: -93.091634,
    authoritative: true,
    titleVenuePatterns: ["Fitzgerald Theater", "The Fitzgerald Theater", "Fitzgerald"],
  },
];

/**
 * Rooms First Avenue books into but does not run. Their shows are real and worth
 * listing — 28 of them in a three-month window — but the calendar's SILENCE about
 * these rooms means nothing, because it is not their schedule. So these are
 * add-and-confirm only: `authoritative: false`, which the reconciler reads as
 * "never let absence here hide anything".
 *
 * Note what is NOT in this list: the Armory. First Avenue promotes nothing there,
 * so this route does not reach it. See docs/MUSIC-IMPORT.md.
 */
export const PROMOTED_ELSEWHERE: MusicVenue[] = [
  {
    feedName: "Amsterdam Bar & Hall",
    name: "Amsterdam Bar and Hall",
    city: "Saint Paul",
    address: "6 W 6th Street",
    lat: 44.946246,
    lng: -93.095289,
    authoritative: false,
    titleVenuePatterns: ["Amsterdam Bar and Hall", "Amsterdam Bar and Hall (St Paul)", "Amsterdam Bar & Hall"],
  },
  {
    feedName: "The Cedar Cultural Center",
    name: "The Cedar Cultural Center",
    city: "Minneapolis",
    address: "416 Cedar Ave S",
    lat: 44.969406,
    lng: -93.247614,
    authoritative: false,
    titleVenuePatterns: ["The Cedar Cultural Center", "The Cedar Cultural Center (Minneapolis)", "Cedar Cultural Center"],
  },
  {
    feedName: "Surly Brewing Festival Field",
    name: "Surly Brewing Festival Field",
    city: "Minneapolis",
    address: "520 Malcolm Ave SE",
    lat: 44.973270,
    lng: -93.210850,
    authoritative: false,
    titleVenuePatterns: ["Surly Brewing Festival Field", "Surly Brewing Co."],
  },
  {
    feedName: "State Theatre",
    name: "State Theatre",
    city: "Minneapolis",
    address: "805 Hennepin Ave",
    lat: 44.976857,
    lng: -93.276046,
    authoritative: false,
    titleVenuePatterns: ["State Theatre", "Hennepin Arts (State Theatre)"],
  },
  {
    feedName: "Grand Casino Arena",
    name: "Grand Casino Arena",
    city: "St. Paul",
    address: "199 W Kellogg Blvd",
    lat: 44.932149,
    lng: -93.112696,
    authoritative: false,
    titleVenuePatterns: ["Grand Casino Arena"],
  },
  {
    feedName: "icehouse MPLS",
    name: "Icehouse",
    city: "Minneapolis",
    address: "2528 Nicollet Ave S",
    lat: 44.956163,
    lng: -93.278354,
    authoritative: false,
    titleVenuePatterns: ["Icehouse", "Icehouse (Minneapolis)"],
  },
];

/** Month pages, one request each, covering today through the horizon. */
export function firstAvenueMonthUrls(from: string, to: string): string[] {
  const urls: string[] = [];
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(5, 7));
  const endY = Number(to.slice(0, 4));
  const endM = Number(to.slice(5, 7));
  // Bounded by construction: the horizon is measured in months, not years.
  for (let guard = 0; guard < 24; guard++) {
    urls.push(
      `https://first-avenue.com/shows?post_type=event&start_date=${y}${String(m).padStart(2, "0")}01`,
    );
    if (y > endY || (y === endY && m >= endM)) break;
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return urls;
}

/**
 * The Minneapolis Park Board runs The Events Calendar with its REST API open, so
 * the Lake Harriet Bandshell — which programmes a free concert almost every night
 * of the summer — has a primary source after all.
 *
 * It was worth finding. The self-check had four unresolvable clashes at the
 * bandshell, and on 30 August the site listed *two* bands that the Park Board's
 * own calendar does not have at all.
 *
 * Only the bandshell is claimed here. The same feed carries buckthorn-slaying
 * volunteer mornings and park markets across the whole city; those are real, but
 * they are not this importer's business.
 */
export const MPLS_PARKS_VENUES: MusicVenue[] = [
  {
    feedName: "Lake Harriet Bandshell",
    name: "Lake Harriet Bandshell",
    city: "Minneapolis",
    address: "4135 W Lake Harriet Pkwy",
    lat: 44.922_58,
    lng: -93.309_86,
    authoritative: true,
    titleVenuePatterns: ["Lake Harriet Bandshell", "Lake Harriet Band Shell"],
  },
];

/**
 * Tribe pages at 50 and 404s past the last page, so the page count has to come
 * from the payload rather than be guessed. Page 1 reports `total_pages`; a fixed
 * guess either 404s (which the all-or-nothing rule turns into "source
 * unavailable") or silently truncates the calendar, and a truncated calendar is
 * the input that makes this importer hide real shows.
 */
export function mplsParksPageUrl(from: string, to: string, page: number): string {
  return (
    `https://www.minneapolisparks.org/wp-json/tribe/events/v1/events` +
    `?start_date=${from}&end_date=${to}&per_page=50&page=${page}`
  );
}

export const MUSIC_SOURCES = [
  {
    key: "first-avenue",
    label: "First Avenue",
    sourceLabel: "the First Avenue calendar",
    venues: [...FIRST_AVENUE_VENUES, ...PROMOTED_ELSEWHERE],
    urls: firstAvenueMonthUrls,
    /** Their month pages are HTML. */
    format: "first-avenue-html" as const,
    paged: false,
  },
  {
    key: "mpls-parks",
    label: "Minneapolis Park Board",
    sourceLabel: "the Minneapolis Park Board calendar",
    venues: MPLS_PARKS_VENUES,
    /** Page 1 only; the fetcher follows total_pages from the payload. */
    urls: (from: string, to: string) => [mplsParksPageUrl(from, to, 1)],
    pageUrl: mplsParksPageUrl,
    format: "tribe-json" as const,
    paged: true,
  },
];
