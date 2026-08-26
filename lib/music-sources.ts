import type { SportsVenue } from "./sports-sources";
import type { VenueShow } from "./music-feed";
import type { CategoryKey } from "./types";

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
  /** Category for listings created here, when the feed has no better answer. */
  defaultCategory?: CategoryKey;
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
    // The ONLY authoritative park venue. It is a bookable stage the Board
    // programmes exclusively, and a run against it produced zero phantoms.
    // Every other park is a public space where things happen that the Board's
    // calendar has no reason to know about — a permitted festival in Loring
    // Park is not theirs to list, and reading their silence as "nothing on"
    // would hide it.
    authoritative: true,
    titleVenuePatterns: ["Lake Harriet Bandshell", "Lake Harriet Band Shell"],
  },
];

/**
 * Their own taxonomy → our category. This is the thing First Avenue could not
 * give us: a category from the people running the event rather than a keyword
 * scorer guessing at a title.
 *
 * `null` means DO NOT LIST.
 */
export function mplsParksCategory(tags: string[] = []): CategoryKey | null {
  const has = (needle: string) => tags.some((t) => t.toLowerCase().includes(needle));

  // Board meetings, budget hearings, "Open House for Lake Nokomis Shoreline
  // Improvements". Public, minuted, and not a thing to do on a Saturday.
  if (has("public meeting")) return null;

  // 101 of the feed's 216 entries, and excluded deliberately — see
  // docs/PARKS-IMPORT.md. They are recurring weekly SHIFTS ("Peace Garden
  // Volunteering" every Tuesday, "Meadow Makers", buckthorn mornings), not
  // events, and listing them would more than double the family category with
  // near-identical repeats. Flip this one line to include them.
  if (has("volunteer")) return null;

  if (has("music in the parks")) return "music";
  if (has("movies in the parks")) return "family";
  // Everything else the Board runs in a park: ice-cream socials, storytimes,
  // markets, nature walks, open streets.
  return "family";
}

/**
 * Build the venue registry from the feed itself.
 *
 * Hand-registering was right for eight sports teams and six First Avenue rooms.
 * It is wrong for forty-four parks: the Board publishes each venue's address and
 * coordinates, so typing them out by hand would add forty-four chances to get a
 * coordinate wrong and nothing else. A venue with no coordinates is skipped
 * rather than geocoded — this importer keeps Mapbox out of its path.
 */
export function mplsParksVenuesFrom(shows: VenueShow[]): MusicVenue[] {
  return venuesFromFeed(MPLS_PARKS_VENUES, shows);
}

/**
 * Build a venue registry from a Tribe feed, over a pinned base.
 *
 * Pinned entries win, which is how a venue the feed gives no coordinates for
 * still gets listed — the Science Museum publishes none at all — and how the one
 * authoritative park keeps its status.
 */
export function venuesFromFeed(pinnedVenues: MusicVenue[], shows: VenueShow[]): MusicVenue[] {
  const pinned = new Map(pinnedVenues.map((v) => [v.feedName.toLowerCase(), v]));
  const out = new Map<string, MusicVenue>(pinned);
  for (const s of shows) {
    const key = s.venue.toLowerCase();
    if (out.has(key) || !s.venueInfo) continue;
    // A venue whose "name" is a street address names no place a reader can use.
    if (/^\d+\s/.test(s.venue)) continue;
    out.set(key, {
      feedName: s.venue,
      name: s.venue,
      address: s.venueInfo.address,
      city: s.venueInfo.city,
      lat: s.venueInfo.lat,
      lng: s.venueInfo.lng,
      authoritative: false,
      titleVenuePatterns: [s.venue],
    });
  }
  return [...out.values()];
}

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


/**
 * MUSEUM CALENDARS — the same Tribe REST API, on two more hosts.
 *
 * Found by probing eighteen sites for it. Sixteen had nothing usable: the Walker,
 * Children's Theatre and Can Can are JavaScript apps with private back-ends, the
 * Guthrie and Chanhassen refuse us outright (403), Mia rate-limits, and neither
 * city's calendar nor the State Fair's runs WordPress. These two do.
 *
 * Both are ADD-AND-CONFIRM only. A museum runs exhibitions alongside programmes
 * and rents its rooms out, so "nothing on their calendar that day" is not the
 * same claim a concert hall's dark night makes, and this importer should not be
 * able to hide a real listing on the strength of it.
 */
const BELL_MUSEUM: MusicVenue = {
  feedName: "Bell Museum",
  name: "Bell Museum",
  city: "St. Paul",
  address: "2088 Larpenteur Ave W",
  lat: 44.991_9,
  lng: -93.185_6,
  authoritative: false,
  titleVenuePatterns: ["Bell Museum", "Bell Museum (St Paul)", "Bell Museum of Natural History"],
  defaultCategory: "family",
};

const SCIENCE_MUSEUM: MusicVenue = {
  feedName: "Science Museum of Minnesota",
  name: "Science Museum of Minnesota",
  city: "St. Paul",
  address: "120 W Kellogg Blvd",
  lat: 44.942_3,
  lng: -93.098_6,
  authoritative: false,
  // Pinned because their feed publishes NO coordinates at all — for any venue —
  // so nothing here could register itself.
  titleVenuePatterns: [
    "Science Museum of Minnesota",
    "Science Museum of Minnesota (St Paul)",
  ],
  defaultCategory: "family",
};

/** A Tribe feed on any host, paged the same way the Park Board's is. */
export function tribePageUrl(host: string) {
  return (from: string, to: string, page: number) =>
    `https://${host}/wp-json/tribe/events/v1/events` +
    `?start_date=${from}&end_date=${to}&per_page=50&page=${page}`;
}

export const MUSEUM_SOURCES = [
  { key: "bell-museum", label: "Bell Museum", host: "www.bellmuseum.umn.edu", venue: BELL_MUSEUM },
  { key: "science-museum", label: "Science Museum of Minnesota", host: "www.smm.org", venue: SCIENCE_MUSEUM },
].map(({ key, label, host, venue }) => ({
  key,
  label,
  sourceLabel: `the ${label} calendar`,
  venues: [venue],
  urls: (from: string, to: string) => [tribePageUrl(host)(from, to, 1)],
  pageUrl: tribePageUrl(host),
  format: "tribe-json" as const,
  paged: true,
  // Their tags are housekeeping ("Offsite", "Tour", "Free with admission"), not
  // categories, so the venue's default stands rather than a guess at a title.
  categoryFor: () => venue.defaultCategory ?? "family",
  venuesFrom: (shows: VenueShow[]) => venuesFromFeed([venue], shows),
}));

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
    /** Their taxonomy decides the category, and decides what not to list. */
    categoryFor: mplsParksCategory,
    /** 44 venues, registered from the feed's own coordinates. */
    venuesFrom: mplsParksVenuesFrom,
  },
  ...MUSEUM_SOURCES,
];
