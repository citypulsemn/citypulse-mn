import { placesByKind, placesByDistance, type Place } from "./places";
import { distanceMeters } from "./geo-distance";

/**
 * PLAYGROUND "BEFORE YOU GO" (9 November 2026).
 *
 * The reader-facing half of the aerial playground inventory (the handoff in
 * `aerial-playground-inventory`, tested on three Plymouth parks on 8 Nov 2026).
 * That process counts play pieces from county aerial photos and scores parks.
 * This file publishes much less than that, on purpose:
 *
 *   - NO SCORES. The process's own rule holds every rating until 20–30 parks
 *     are calibrated; three are, none of them on this site.
 *   - NO COUNTS FROM PHOTOS. Counting needs the 6-inch county flights, and the
 *     Hennepin and Dakota 6-inch layers were flown by Nearmap: Dakota's licence
 *     forbids commercial distribution in writing, and Hennepin's Nearmap terms
 *     are unpublished. Until the counties answer in writing, the only aerial
 *     layer this site touches is `met25` — the Metropolitan Council's April
 *     2025 1-ft flight, whose metadata says "public domain under the Minnesota
 *     Government Data Practices Act".
 *   - WHAT THE PHOTOS ARE FOR: putting the pin on the playground itself (on 8
 *     Nov the Hyland pin sat on Bush Lake Road, nowhere near the play area —
 *     the park's address is not where the playground is), finding the lot a
 *     family parks in, and showing the layout. Nothing on the page is read OFF
 *     the photo except where the lot is.
 *   - EVERYTHING ELSE is what the park's OWN page prints, copied word for word
 *     into `quote` (the 219c6b4 lesson: a claim carries the text it read), with
 *     the URL and the day a person read it. Never an aggregator.
 *
 * Keyed by place slug, like VENUE_HOURS. A test holds every key to a real
 * outdoor playground in `lib/places.ts`, and every photo to its pin.
 */

/** The only aerial layer this site may fetch or show (see above). */
export const AERIAL_LAYER = "met25";
export const AERIAL_FLOWN = "5–16 April 2025";
export const AERIAL_CREDIT = "Metropolitan Council, via the Minnesota Geospatial Image Service";
/** Crop size around the play area, metres. 4:3, at the layer's native 0.3048 m/px. */
export const AERIAL_CROP_M = { w: 160, h: 120 } as const;
const AERIAL_GSD_M = 0.3048;
const WMS_LL = "https://imageserver.gisdata.mn.gov/cgi-bin/wmsll?";

/** One fact as a park's own page prints it. Every quote is copied word for
 *  word from `url` — enough of the page to support the line, nothing joined. */
export interface SourcedFact {
  quotes: string[];
  url: string;
}

/**
 * "building" — restrooms in a building (a visitor center, a park building, a
 * restroom building). "seasonal" — the source says they close part of the year
 * (Minnesota park buildings commonly lock October–May). "portable" — portable
 * toilets only. "not-listed" — a person read the park's own page and it lists
 * no restrooms; the page says so out loud, because a missing line reads as
 * "none". An unreadable page is NOT "not-listed" — it is no entry at all.
 *
 * `line` is the sentence a reader sees when the kind's default is too blunt —
 * "Restrooms in the visitor center, which is open daily 9 AM–5 PM" — and it
 * may say only what the quotes say.
 */
export type RestroomKind = "building" | "seasonal" | "portable" | "not-listed";

export interface PlaygroundFacts {
  restrooms?: SourcedFact & { kind: RestroomKind; line?: string };
  /** "children of all ages and abilities" — rendered "Built for …". */
  ages?: SourcedFact & { value: string };
  toddlerArea?: SourcedFact;
  fenced?: SourcedFact;
  hours?: SourcedFact & { value: string };
  /** Water play the park names that is not in the splash-pad sweep (a
   *  Minneapolis wading pool). `line` says only what the quote says. */
  waterPlay?: SourcedFact & { line: string };
  /** The lot a family parks in, read off the 2025 photo. `label` names it by
   *  something the park's page or a road sign says — never an invented name. */
  lot?: { lat: number; lng: number; label: string };
  /** The 2025 photo's centre. Must equal the place's pin: move the pin and the
   *  test fails until the crop is re-fetched (`npm run playground-aerial`). */
  aerial?: { lat: number; lng: number };
  /** YYYY-MM-DD a person last read the sources. */
  readOn: string;
}

// Read 8 Nov 2026. Every pin below was moved onto the play area from the April
// 2025 photo; the old pins were the park's street address or entrance, off by
// 181 m (Shoreview) to 3.9 km (Waterford, which sat in Lake Waconia). Lots are
// listed only where the photo shows them plainly; a lot that was a "probably"
// (Maple Grove, Teddy Bear, Shakopee) is left out.
const TRP = "https://www.threeriversparks.org/location";

export const PLAYGROUND_FACTS: Record<string, PlaygroundFacts> = {
  "hyland-chutes-and-ladders-playground": {
    restrooms: {
      kind: "building",
      line: "Restrooms in the visitor center, which is open daily 9 AM–5 PM",
      quotes: [
        "The visitor center features limited concessions, restrooms, a fire place and cross-country ski rental in winter.",
        "Open daily, 9 AM–5 PM",
      ],
      url: `${TRP}/hyland-visitor-center`,
    },
    toddlerArea: {
      quotes: ["A designated accessible play area with sliding, swinging and climbing equipment is designed for children ages four and younger."],
      url: `${TRP}/hyland-lake-park-reserve`,
    },
    hours: { value: "daily, 5 AM–10 PM", quotes: ["Daily, 5 AM–10 PM"], url: `${TRP}/hyland-lake-park-reserve` },
    lot: { lat: 44.824836, lng: -93.372576, label: "the visitor center lot" },
    aerial: { lat: 44.825431, lng: -93.371542 },
    readOn: "2026-11-08",
  },
  "staring-lake-playground": {
    // edenprairiemn.gov refuses scripted reads; read in a browser on 8 Nov.
    // The page lists both for the whole park and does not say which is where.
    restrooms: {
      kind: "building",
      line: "The city lists restrooms and portable toilets for the park",
      quotes: ["Portable Toilets", "Restrooms"],
      url: "https://www.edenprairiemn.gov/home/components/facilitydirectory/facilitydirectory/146/1343",
    },
    lot: { lat: 44.834322, lng: -93.463141, label: "the loop lot off Pioneer Trail by the park building" },
    aerial: { lat: 44.834594, lng: -93.462059 },
    readOn: "2026-11-08",
  },
  "elm-creek-play-area": {
    // A map legend, placed by Three Rivers' own icon layer about 75 m from the
    // play area, on a roofed building in the photo.
    restrooms: {
      kind: "building",
      line: "Flush toilet near the play area, on Three Rivers' park map",
      quotes: ["Flush Toilet"],
      url: "https://threeriversparks.link/ElmCreek_ParkReserve_RecreationArea",
    },
    hours: { value: "5 AM–10 PM", quotes: ["5 AM–10 PM"], url: `${TRP}/elm-creek-park-reserve` },
    lot: { lat: 45.142044, lng: -93.426674, label: "the General Recreation Area lot off James Deane Parkway" },
    aerial: { lat: 45.141395, lng: -93.428038 },
    readOn: "2026-11-08",
  },
  "french-regional-playground": {
    restrooms: {
      kind: "building",
      line: "Restrooms in the visitor center, which is open daily 9 AM–5 PM",
      quotes: ["The French Visitor Center has concessions, public seating and restrooms.", "Daily, 9 AM–5 PM"],
      url: `${TRP}/french-visitor-center`,
    },
    toddlerArea: {
      quotes: ["A play area for smaller children"],
      url: "https://www.threeriversparks.org/page/french-regional-park-play-area-project",
    },
    hours: { value: "5 AM–10 PM", quotes: ["5 AM–10 PM"], url: `${TRP}/french-regional-park` },
    lot: { lat: 45.021666, lng: -93.433937, label: "the visitor center lot" },
    aerial: { lat: 45.021013, lng: -93.434062 },
    readOn: "2026-11-08",
  },
  "maple-grove-central-park-playground": {
    restrooms: {
      kind: "building",
      line: "Restrooms in the Phenow Pavilion, 6:30 a.m. to 9 p.m. daily",
      quotes: ["Phenow Pavilion", "Restrooms Monday - Sunday and some federal holidays 6:30 a.m. to 9 p.m."],
      url: "https://www.maplegrovemn.gov/505/Central-Park",
    },
    hours: {
      value: "playground 6 a.m. to 11 p.m.",
      quotes: ["Playground Hours 6 a.m. to 11 p.m."],
      url: "https://www.maplegrovemn.gov/505/Central-Park",
    },
    aerial: { lat: 45.102434, lng: -93.431915 },
    readOn: "2026-11-08",
  },
  "becker-park-playground": {
    restrooms: {
      kind: "building",
      line: "Small restroom building in the park",
      quotes: ["small restroom building"],
      url: "https://parksandrec.crystalmn.gov/recreation/parks_and_trails/becker_park",
    },
    hours: {
      value: "daily, 6 a.m. to 10 p.m.",
      quotes: ["CRYSTAL CITY PARKS ARE OPEN DAILY FROM 6 A.M. TO 10 P.M."],
      url: "https://parksandrec.crystalmn.gov/recreation/parks_and_trails",
    },
    lot: { lat: 45.053089, lng: -93.360354, label: "the lot off 55th Avenue North" },
    aerial: { lat: 45.053797, lng: -93.360823 },
    readOn: "2026-11-08",
  },
  "wabun-play-area": {
    // MPRB lists restrooms for the whole 167-acre park, not at Wabun — no line.
    hours: {
      value: "6 am–midnight",
      quotes: ["6 am-midnight in developed areas"],
      url: "https://www.minneapolisparks.org/parks-destinations/parks-lakes/minnehaha_regional_park/",
    },
    waterPlay: {
      line: "The Wabun Area Wading Pool, in summer",
      quotes: ["Cool off in the summer at the Wabun Area Wading Pool."],
      url: "https://www.minneapolisparks.org/parks-destinations/parks-lakes/minnehaha_regional_park/",
    },
    lot: { lat: 44.916051, lng: -93.205436, label: "the Wabun picnic area lot" },
    aerial: { lat: 44.915765, lng: -93.204342 },
    readOn: "2026-11-08",
  },
  "roseville-central-park-playground": {
    // The only restrooms named are inside the rentable Foundation Shelter, and
    // the city doesn't say they're open to people who haven't rented it — no line.
    lot: { lat: 45.016443, lng: -93.137127, label: "the lot off Victoria Street" },
    aerial: { lat: 45.016663, lng: -93.138809 },
    readOn: "2026-11-08",
  },
  "shoreview-commons-playground": {
    restrooms: {
      kind: "building",
      line: "Indoor restrooms",
      quotes: ["Indoor restrooms"],
      url: "https://www.shoreviewmn.gov/Parks-rec/Parks/Parks-directory/Shoreview-Commons-Destination-Playground",
    },
    lot: { lat: 45.08059, lng: -93.133398, label: "the community center lot" },
    aerial: { lat: 45.081462, lng: -93.13366 },
    readOn: "2026-11-08",
  },
  "teddy-bear-park-playground": {
    restrooms: {
      kind: "building",
      line: "Restrooms in the park",
      quotes: ["Restrooms"],
      url: "https://www.stillwatermn.gov/Facilities/Facility/Details/Teddy-Bear-Park-4",
    },
    hours: {
      value: "8 am to 8 pm",
      quotes: ["Teddy Bear Park hours are 8 am to 8 pm."],
      url: "https://www.stillwatermn.gov/219/Park-Reservation-Information",
    },
    aerial: { lat: 45.05382, lng: -92.806 },
    readOn: "2026-11-08",
  },
  "madisons-place-playground": {
    restrooms: {
      kind: "seasonal",
      line: "Restrooms near the splash pad, open during its hours (9 a.m. to 9 p.m., generally Memorial Day–Labor Day)",
      quotes: [
        "Nearby restrooms are available during these hours.",
        "operating hours are from 9 a.m. to 9 p.m. daily",
        "The splash pad is generally open Memorial Day-Labor Day.",
      ],
      url: "https://www.woodburymn.gov/936/Splash-Pad",
    },
    ages: {
      value: "children of all ages and abilities",
      quotes: ["children of all ages and abilities"],
      url: "https://www.woodburymn.gov/482/Madisons-Place-Playground",
    },
    lot: { lat: 44.888036, lng: -92.940618, label: "the Fairview Sports Center lot" },
    aerial: { lat: 44.887524, lng: -92.939344 },
    readOn: "2026-11-08",
  },
  "hamlet-park-playground": {
    restrooms: {
      kind: "building",
      line: "The city lists restrooms at the park",
      quotes: ["Restrooms"],
      url: "https://www.cottagegrovemn.gov/facilities/facility/details/Hamlet-Park-9",
    },
    hours: {
      value: "6 am to 10:30 pm",
      quotes: ["Parks are open from 6 am to 10:30 pm"],
      url: "https://www.cottagegrovemn.gov/192/Parks-Trails",
    },
    lot: { lat: 44.821257, lng: -92.959209, label: "the Hamlet Park Building lot" },
    aerial: { lat: 44.82178, lng: -92.959487 },
    readOn: "2026-11-08",
  },
  "waterford-park-playground": {
    restrooms: {
      kind: "not-listed",
      line: "No restroom building yet; the city lists one in its future plans",
      quotes: ["Future plans include a year-round facility/restroom building."],
      url: "https://www.waconiamn.gov/473/Community-Parks",
    },
    hours: {
      value: "6 a.m. to 11 p.m.",
      quotes: ["Parks may be used only during the hours of 6 a.m. and 11 p.m."],
      url: "https://www.waconiamn.gov/480/Park-and-Trail-Regulations",
    },
    lot: { lat: 44.829849, lng: -93.792855, label: "the park lot off Ravencroft Road" },
    aerial: { lat: 44.829369, lng: -93.793647 },
    readOn: "2026-11-08",
  },
  "shakopee-fun-for-all-playground": {
    ages: {
      value: "all ages",
      quotes: ["Inclusive Fun For All Playground with sensory activities for all ages"],
      url: "https://www.shakopeemn.gov/business_detail_T11_R627.php",
    },
    hours: {
      value: "6 a.m. to 10 p.m. year-round",
      quotes: ["Park hours across the City are 6 a.m. to 10 p.m. year-round."],
      url: "https://www.shakopeemn.gov/recreation/parks_trails/index.php",
    },
    aerial: { lat: 44.783878, lng: -93.538156 },
    readOn: "2026-11-08",
  },
};

export function playgroundFacts(slug: string): PlaygroundFacts | null {
  return PLAYGROUND_FACTS[slug] ?? null;
}

/** One rendered line, optionally followed by a link. */
export interface FactLine {
  key: string;
  text: string;
  link?: { href: string; text: string };
}

/** A splash pad this close is "at this park" rather than "nearby". */
const SAME_PARK_M = 400;
/** Beyond this, a splash pad is a different outing, not a pairing. */
const NEARBY_MI = 3;
/** A lot this close needs no walking estimate. */
const LOT_ADJACENT_M = 100;

const RESTROOM_TEXT: Record<RestroomKind, string> = {
  building: "Restroom building",
  seasonal: "Restrooms open part of the year",
  portable: "Portable toilets only",
  "not-listed": "The park's own page doesn't list restrooms",
};

export function mapsLink(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

/**
 * Walking minutes from a straight-line distance. Paths wind, so the line is
 * stretched by 1.3 and walked at 80 m a minute, rounded UP — an estimate that
 * errs long is a smaller let-down than one that errs short with a toddler.
 */
export function walkMinutes(meters: number): number {
  return Math.max(1, Math.ceil((meters * 1.3) / 80));
}

/**
 * The "Before you go" lines for one playground, in the order a parent asks
 * them. Pure: the splash pads are passed in so the test can pin the boundaries.
 * No facts → no lines (honest emptiness; the page renders nothing).
 */
export function beforeYouGo(
  place: Place,
  facts: PlaygroundFacts | null,
  splashPads: Place[] = placesByKind("splash-pad"),
): FactLine[] {
  if (!facts) return [];
  const lines: FactLine[] = [];

  if (facts.restrooms) {
    lines.push({ key: "restrooms", text: facts.restrooms.line ?? RESTROOM_TEXT[facts.restrooms.kind] });
  }
  if (facts.ages) lines.push({ key: "ages", text: `Built for ${facts.ages.value}` });
  if (facts.toddlerArea) lines.push({ key: "toddler", text: "Separate toddler area" });
  if (facts.fenced) lines.push({ key: "fenced", text: "Fenced play area" });
  if (facts.hours) lines.push({ key: "hours", text: `Hours: ${facts.hours.value}` });

  if (facts.lot) {
    const m = distanceMeters(facts.lot.lat, facts.lot.lng, place.lat, place.lng);
    const walk = m <= LOT_ADJACENT_M ? "right by the playground" : `about a ${walkMinutes(m)}-minute walk`;
    lines.push({
      key: "parking",
      text: `Park in ${facts.lot.label}, ${walk}.`,
      link: { href: mapsLink(facts.lot.lat, facts.lot.lng), text: "Directions to the lot ↗" },
    });
  }

  if (facts.waterPlay) lines.push({ key: "water", text: facts.waterPlay.line });

  // The splash-pad kind is an exhaustive metro sweep, so "nearest" is an honest
  // claim, not a guess from a partial list.
  const nearest = placesByDistance(splashPads, place)[0];
  if (nearest) {
    const season = nearest.place.season.type === "seasonal" ? ` (${nearest.place.season.label})` : "";
    const link = { href: `/places/splash-pad/${nearest.place.slug}`, text: `${nearest.place.name} →` };
    if (nearest.miles * 1609.344 <= SAME_PARK_M) {
      lines.push({ key: "splash", text: `Splash pad at this park${season}:`, link });
    } else if (nearest.miles < NEARBY_MI) {
      lines.push({ key: "splash", text: `Nearest splash pad, ${nearest.miles.toFixed(1)} mi${season}:`, link });
    }
  }

  return lines;
}

/**
 * One link per SITE the facts were read from, in first-use order, pointing at
 * the first page used there. Two Three Rivers pages would otherwise read
 * "From threeriversparks.org and threeriversparks.org".
 */
export function factSources(facts: PlaygroundFacts): string[] {
  const byHost = new Map<string, string>();
  for (const f of [facts.restrooms, facts.ages, facts.toddlerArea, facts.fenced, facts.hours, facts.waterPlay]) {
    if (!f) continue;
    const host = new URL(f.url).hostname.replace(/^www\./, "");
    if (!byHost.has(host)) byHost.set(host, f.url);
  }
  return [...byHost.values()];
}

/** The public path of a playground's photo. Static file: no function, no optimizer. */
export function aerialPath(slug: string): string {
  return `/places/aerial/${slug}.jpg`;
}

/**
 * The GetMap request for a playground's photo: met25 only, centred on the
 * point, at native resolution. EPSG:4326 endpoint; the box is a local
 * metres-to-degrees conversion, exact enough at 160 m.
 */
export function aerialCropUrl(lat: number, lng: number): { url: string; width: number; height: number } {
  const { w, h } = AERIAL_CROP_M;
  const dLat = h / 2 / 111_320;
  const dLng = w / 2 / (111_320 * Math.cos((lat * Math.PI) / 180));
  const bbox = [lng - dLng, lat - dLat, lng + dLng, lat + dLat].map((v) => v.toFixed(6)).join(",");
  const width = Math.round(w / AERIAL_GSD_M);
  const height = Math.round(h / AERIAL_GSD_M);
  const url =
    `${WMS_LL}SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=${AERIAL_LAYER}&STYLES=` +
    `&SRS=EPSG:4326&BBOX=${bbox}&WIDTH=${width}&HEIGHT=${height}&FORMAT=image/jpeg`;
  return { url, width, height };
}
