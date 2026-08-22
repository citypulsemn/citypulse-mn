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

export const MUSIC_SOURCES = [
  {
    key: "first-avenue",
    label: "First Avenue",
    sourceLabel: "the First Avenue calendar",
    venues: FIRST_AVENUE_VENUES,
    monthUrls: firstAvenueMonthUrls,
  },
];
