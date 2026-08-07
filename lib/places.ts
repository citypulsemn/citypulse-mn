import { chiDayKey } from "./clock";

/**
 * PLACES (Places roadmap P1.1) — the evergreen half of the site: the metro's
 * go-to spots (beaches, splash pads, and later pools/parks/rinks/sledding).
 *
 * A REGISTRY IN CODE, not a DB table — same reasoning as venues/neighborhoods:
 * testable with drift guards, versioned in git, no pipeline, renders at
 * build/ISR with zero queries (ENGINEERING rule 2 satisfied by construction).
 * Graduate to a table only if this passes ~300 entries or public submissions
 * open (P4). Every entry carries a real `sourceUrl` (the honesty anchor) and a
 * `verifiedAt` date — nothing here is invented; facts trace to a parks-board or
 * city-rec page.
 *
 * Pure selectors + season math below; the page layer (P1.2) is a thin shell.
 */

export type PlaceKind =
  | "beach"
  | "splash-pad"
  | "pool"
  | "playground"
  | "park"
  | "rink"
  | "sledding"
  | "music-venue"
  | "farmers-market";

export type PlaceCost = "free" | "paid" | "donation";

/**
 * Season, with BOTH a machine-readable window and a human label. The month
 * bounds (1–12, inclusive) drive `openNow`; the label is what the page shows —
 * month-level honesty, never a fake exact date (those change yearly and belong
 * to `sourceUrl`). `openMonth > closeMonth` means the season wraps the new year
 * (a rink open Dec–Feb), which `openNow` handles — future-proofing P2.1's
 * winter pair.
 */
export type PlaceSeason =
  | { type: "year-round" }
  | { type: "seasonal"; openMonth: number; closeMonth: number; label: string };

export interface Place {
  slug: string; // URL-safe, unique across all places
  name: string;
  kind: PlaceKind;
  lat: number;
  lng: number;
  address: string;
  city: string;
  /** An existing NEIGHBORHOODS key, or null (suburbs + spots outside the 16
   *  in-city districts resolve to null — their city name already says where). */
  neighborhood: string | null;
  season: PlaceSeason;
  cost: PlaceCost;
  tags: string[]; // flat amenity tags; filters (P4.3) are membership
  intro: string; // house voice: concrete over promotional
  sourceUrl: string; // authoritative page — REQUIRED, the honesty anchor
  verifiedAt: string; // YYYY-MM-DD the facts were checked against the source
  /** For the `music-venue` kind: points at the existing venue page instead of
   *  duplicating it. Null for every other kind. */
  venueSlug: string | null;
}

export interface KindMeta {
  kind: PlaceKind;
  label: string; // "Splash Pad"
  plural: string; // "Splash Pads"
  blurb: string; // one line for the index card (house voice)
}

export const KIND_META: Record<PlaceKind, KindMeta> = {
  beach: { kind: "beach", label: "Beach", plural: "Beaches", blurb: "Lake swimming across the metro — guarded sand beaches, mapped." },
  "splash-pad": { kind: "splash-pad", label: "Splash Pad", plural: "Splash Pads", blurb: "Free water play for hot afternoons, every one in the metro." },
  pool: { kind: "pool", label: "Pool", plural: "Pools", blurb: "Outdoor and indoor pools, zero-depth entries, and waterslides." },
  playground: { kind: "playground", label: "Playground", plural: "Playgrounds", blurb: "The destination playgrounds worth the drive." },
  park: { kind: "park", label: "Park", plural: "Parks", blurb: "The parks worth crossing town for — trails, grills, and open space." },
  rink: { kind: "rink", label: "Ice Rink", plural: "Ice Rinks", blurb: "Outdoor and indoor rinks, warming houses, and open skate." },
  sledding: { kind: "sledding", label: "Sledding Hill", plural: "Sledding Hills", blurb: "The metro's sledding hills, from gentle to steep." },
  "music-venue": { kind: "music-venue", label: "Music Venue", plural: "Music Venues", blurb: "The rooms where the music happens, with full schedules." },
  "farmers-market": { kind: "farmers-market", label: "Farmers Market", plural: "Farmers Markets", blurb: "Where to find the metro's growers and makers each week." },
};

// Summer water season used by the current seed — guarded Minneapolis and
// St. Paul beaches and splash pads run Memorial Day to Labor Day. Month-level:
// the exact lifeguard dates shift yearly (they live on each sourceUrl).
const SUMMER: PlaceSeason = { type: "seasonal", openMonth: 5, closeMonth: 9, label: "Memorial Day–Labor Day" };
// Outdoor pools open a bit later than the lakes (schools out) and close end of
// August — June–August, month-level. Indoor pools run all year; the St. Paul
// indoor water park runs the OFF-season (Sept–May), which wraps the new year.
const POOL_SUMMER: PlaceSeason = { type: "seasonal", openMonth: 6, closeMonth: 8, label: "June–August" };
const YEAR_ROUND: PlaceSeason = { type: "year-round" };
const OFF_SEASON: PlaceSeason = { type: "seasonal", openMonth: 9, closeMonth: 5, label: "September–May (closed summer)" };

/**
 * The registry. SEED (P1.1): a verified starter set of beaches and splash pads
 * across Minneapolis and St. Paul — every entry checked against the parks-board
 * or city page in `sourceUrl` on `verifiedAt`. Expanded to the full ~35 in a
 * follow-up curation pass; the code below doesn't care how many there are.
 */
export const PLACES: Place[] = [
  // ── Beaches ───────────────────────────────────────────────────────────────
  {
    slug: "lake-nokomis-main-beach", name: "Lake Nokomis Main Beach", kind: "beach",
    lat: 44.9126, lng: -93.2452, address: "5001 Lake Nokomis Pkwy W, Minneapolis, MN 55417",
    city: "Minneapolis", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["lifeguard-seasonal", "sand", "restrooms"],
    intro: "The metro's roomiest lake beach — a wide sand crescent with a beach house, a guarded swimming area, and paddleboard rentals a short walk down the shore.",
    sourceUrl: "https://www.minneapolisparks.org/activities-events/water-activities/beaches/lake_nokomis_main_beach/",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "lake-harriet-north-beach", name: "Lake Harriet North Beach", kind: "beach",
    lat: 44.9268, lng: -93.3065, address: "Lake Harriet, Minneapolis, MN 55419",
    city: "Minneapolis", neighborhood: "southwest-lakes", season: SUMMER, cost: "free",
    tags: ["lifeguard-seasonal", "sand"],
    intro: "The smaller, quieter beach at the north end of Lake Harriet, a short walk from the bandshell and the Rose Garden.",
    sourceUrl: "https://www.minneapolisparks.org/activities-events/water-activities/beaches/lake_harriet_north_beach/",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "bde-maka-ska-thomas-beach", name: "Bde Maka Ska Thomas Beach", kind: "beach",
    lat: 44.9385, lng: -93.3130, address: "Bde Maka Ska, Minneapolis, MN 55416",
    city: "Minneapolis", neighborhood: "southwest-lakes", season: SUMMER, cost: "free",
    tags: ["lifeguard-seasonal", "sand"],
    intro: "The wide southwest-shore beach on Bde Maka Ska, with grass to spread out on above the sand and the lake loop right behind you.",
    sourceUrl: "https://www.minneapolisparks.org/activities-events/water-activities/beaches/",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "cedar-lake-point-beach", name: "Cedar Lake Point Beach", kind: "beach",
    lat: 44.9585, lng: -93.3068, address: "Cedar Lake, Minneapolis, MN 55405",
    city: "Minneapolis", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["lifeguard-seasonal", "sand"],
    intro: "The main beach on Cedar Lake, a short walk from the parking — sand, calm water, and the least crowded of the chain most mornings.",
    sourceUrl: "https://www.minneapolisparks.org/activities-events/water-activities/beaches/cedar_lake_point_beach/",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "lake-hiawatha-beach", name: "Lake Hiawatha Beach", kind: "beach",
    lat: 44.9160, lng: -93.2410, address: "2701 E 44th St, Minneapolis, MN 55406",
    city: "Minneapolis", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["lifeguard-seasonal", "sand"],
    intro: "A neighborhood lake beach off the Hiawatha parkway, with a guarded swimming area and the regional trail running past.",
    sourceUrl: "https://www.minneapolisparks.org/activities-events/water-activities/beaches/lake_hiawatha_beach/",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "phalen-regional-park-beach", name: "Phalen Regional Park Beach", kind: "beach",
    lat: 44.9803, lng: -93.0575, address: "1400 Phalen Dr, Saint Paul, MN 55106",
    city: "St. Paul", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["lifeguard-seasonal", "sand", "restrooms"],
    intro: "St. Paul's big guarded beach on Lake Phalen, with a sand swimming area, a splash pad next door, and free parking.",
    sourceUrl: "https://www.stpaul.gov/departments/parks-and-recreation/aquatics/phalen-regional-park-beach",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "bde-maka-ska-32nd-street-beach", name: "Bde Maka Ska 32nd Street Beach", kind: "beach",
    lat: 44.9430, lng: -93.3055, address: "Bde Maka Ska, Minneapolis, MN 55408",
    city: "Minneapolis", neighborhood: "southwest-lakes", season: SUMMER, cost: "free",
    tags: ["lifeguard-seasonal", "sand"],
    intro: "The east-side beach on Bde Maka Ska, closest to the Uptown end of the lake and the busiest on a hot afternoon.",
    sourceUrl: "https://www.minneapolisparks.org/activities-events/water-activities/beaches/bde_maka_ska_32nd_street_beach/",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "bde-maka-ska-north-beach", name: "Bde Maka Ska North Beach", kind: "beach",
    lat: 44.9505, lng: -93.3075, address: "Bde Maka Ska, Minneapolis, MN 55408",
    city: "Minneapolis", neighborhood: "southwest-lakes", season: SUMMER, cost: "free",
    tags: ["lifeguard-seasonal", "sand"],
    intro: "The north-end beach on Bde Maka Ska, a short walk from the refectory and the sailboat docks.",
    sourceUrl: "https://www.minneapolisparks.org/activities-events/water-activities/beaches/bde_maka_ska_north_beach/",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "cedar-lake-east-beach", name: "Cedar Lake East Beach", kind: "beach",
    lat: 44.9548, lng: -93.3020, address: "Cedar Lake, Minneapolis, MN 55405",
    city: "Minneapolis", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["lifeguard-seasonal", "sand"],
    intro: "The east-shore beach on Cedar Lake, backed by woods and reached off the Cedar Lake Trail.",
    sourceUrl: "https://www.minneapolisparks.org/activities-events/water-activities/beaches/cedar_lake_east_beach/",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "cedar-lake-south-beach", name: "Cedar Lake South Beach", kind: "beach",
    lat: 44.9520, lng: -93.3090, address: "Cedar Lake, Minneapolis, MN 55416",
    city: "Minneapolis", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["sand"],
    intro: "The small south beach on Cedar Lake, shaded and quieter than the Point up the shore.",
    sourceUrl: "https://www.minneapolisparks.org/activities-events/water-activities/beaches/cedar_lake_south_beach/",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "lake-harriet-southeast-beach", name: "Lake Harriet Southeast Beach", kind: "beach",
    lat: 44.9190, lng: -93.3025, address: "Lake Harriet, Minneapolis, MN 55419",
    city: "Minneapolis", neighborhood: "southwest-lakes", season: SUMMER, cost: "free",
    tags: ["lifeguard-seasonal", "sand"],
    intro: "The southeast beach on Lake Harriet, near the bandshell and the streetcar line.",
    sourceUrl: "https://www.minneapolisparks.org/activities-events/water-activities/beaches/lake_harriet_southeast_beach/",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "lake-nokomis-50th-street-beach", name: "Lake Nokomis 50th Street Beach", kind: "beach",
    lat: 44.9080, lng: -93.2430, address: "Lake Nokomis, Minneapolis, MN 55417",
    city: "Minneapolis", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["lifeguard-seasonal", "sand"],
    intro: "The smaller south-side beach on Lake Nokomis, quieter than the main beach up the shore.",
    sourceUrl: "https://www.minneapolisparks.org/activities-events/water-activities/beaches/lake_nokomis_50th_street_beach/",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "wirth-lake-beach", name: "Wirth Lake Beach", kind: "beach",
    lat: 44.9860, lng: -93.3230, address: "Theodore Wirth Park, Minneapolis, MN 55422",
    city: "Minneapolis", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["lifeguard-seasonal", "sand"],
    intro: "The guarded beach at Theodore Wirth Park, the metro's largest regional park, with a beach house and the trails behind it.",
    sourceUrl: "https://www.minneapolisparks.org/activities-events/water-activities/beaches/wirth_lake_beach/",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "french-regional-park-beach", name: "French Regional Park Beach", kind: "beach",
    lat: 45.0195, lng: -93.4165, address: "12605 Rockford Rd, Plymouth, MN 55441",
    city: "Plymouth", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["sand"],
    intro: "A sand swimming beach on the north shore of Medicine Lake in Plymouth, part of Three Rivers' French Regional Park.",
    sourceUrl: "https://www.threeriversparks.org/location/french-regional-park",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "bryant-lake-regional-park-beach", name: "Bryant Lake Regional Park Beach", kind: "beach",
    lat: 44.8720, lng: -93.4440, address: "6402 Rowland Rd, Eden Prairie, MN 55344",
    city: "Eden Prairie", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["sand", "concessions"],
    intro: "An unguarded sand beach on Bryant Lake in Eden Prairie, with a concession stand and the regional park's trails and picnic spots.",
    sourceUrl: "https://www.threeriversparks.org/location/bryant-lake-regional-park",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "elm-creek-swim-pond", name: "Elm Creek Swim Pond", kind: "beach",
    lat: 45.1460, lng: -93.4560, address: "12420 James Deane Pkwy, Maple Grove, MN 55369",
    city: "Maple Grove", neighborhood: null, season: SUMMER, cost: "paid",
    tags: ["sand", "restrooms", "concessions"],
    intro: "Three Rivers' chlorinated swim pond at Elm Creek Park Reserve in Maple Grove — filtered water, a sand beach, a changing shelter, and concessions. A daily or season wristband is required.",
    sourceUrl: "https://www.threeriversparks.org/location/elm-creek-swimming-pond",
    verifiedAt: "2026-08-07", venueSlug: null,
  },

  // ── Splash pads ─────────────────────────────────────────────────────────
  {
    slug: "bottineau-field-splash-pad", name: "Bottineau Field Park Splash Pad", kind: "splash-pad",
    lat: 44.9998, lng: -93.2560, address: "2000 2nd St NE, Minneapolis, MN 55418",
    city: "Minneapolis", neighborhood: "northeast", season: SUMMER, cost: "free",
    tags: ["adjacent-playground"],
    intro: "A free splash pad in Northeast, beside the ballfields and the rec center — good for cooling off after the playground.",
    sourceUrl: "https://www.minneapolisparks.org/parks-destinations/parks-lakes/bottineau_field_park/",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "phelps-field-splash-pad", name: "Phelps Field Park Splash Pad", kind: "splash-pad",
    lat: 44.9378, lng: -93.2610, address: "701 E 39th St, Minneapolis, MN 55407",
    city: "Minneapolis", neighborhood: "south-minneapolis", season: SUMMER, cost: "free",
    tags: ["adjacent-playground", "restrooms"],
    intro: "The splash pad at Phelps Field in south Minneapolis, alongside the rec center, the playground, and the wading pool.",
    sourceUrl: "https://www.minneapolisparks.org/parks-destinations/parks-lakes/phelps_field_park/",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "currie-park-splash-pad", name: "Currie Park Splash Pad", kind: "splash-pad",
    lat: 44.9688, lng: -93.2452, address: "500 15th Ave S, Minneapolis, MN 55454",
    city: "Minneapolis", neighborhood: null, season: SUMMER, cost: "free",
    tags: [],
    intro: "A free splash pad on the West Bank near the university, tucked among the towers of Cedar-Riverside.",
    sourceUrl: "https://www.minneapolisparks.org/parks-destinations/parks-lakes/currie_park/",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "franklin-steele-square-splash-pad", name: "Franklin Steele Square Splash Pad", kind: "splash-pad",
    lat: 44.9618, lng: -93.2668, address: "1600 Portland Ave S, Minneapolis, MN 55404",
    city: "Minneapolis", neighborhood: null, season: SUMMER, cost: "free",
    tags: [],
    intro: "A small neighborhood splash pad at Franklin Steele Square, a green block just east of downtown.",
    sourceUrl: "https://www.minneapolisparks.org/parks-destinations/parks-lakes/franklin_steele_square/",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "roy-wilkins-splash-pad", name: "Roy Wilkins (Lewis) Park Splash Pad", kind: "splash-pad",
    lat: 44.9705, lng: -93.1032, address: "900 N Marion St, Saint Paul, MN 55117",
    city: "St. Paul", neighborhood: null, season: SUMMER, cost: "free",
    tags: [],
    intro: "A free splash pad at Roy Wilkins (Lewis) Park in St. Paul's North End.",
    sourceUrl: "https://www.stpaul.gov/facilities/roy-wilkins-park-lewis-park",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "conway-park-splash-pad", name: "Conway Park Splash Pad", kind: "splash-pad",
    lat: 44.9558, lng: -93.0175, address: "2090 Conway Ave, Saint Paul, MN 55119",
    city: "St. Paul", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["restrooms"],
    intro: "The splash pad at Conway Park on St. Paul's East Side, part of the rec center grounds.",
    sourceUrl: "https://www.stpaul.gov/facilities/conway-park",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "victory-memorial-splash-pad", name: "Victory Memorial Splash Pad", kind: "splash-pad",
    lat: 45.0350, lng: -93.3130, address: "4499 Victory Memorial Dr, Minneapolis, MN 55412",
    city: "Minneapolis", neighborhood: null, season: SUMMER, cost: "free",
    tags: [],
    intro: "A splash pad along Victory Memorial Drive in far north Minneapolis, opened in 2025 where the old wading pool stood.",
    sourceUrl: "https://www.minneapolisparks.org/parks-destinations/parks-lakes/victory_park/",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "parque-castillo-splash-pad", name: "Parque Castillo Splash Pad", kind: "splash-pad",
    lat: 44.9315, lng: -93.0780, address: "149 Cesar Chavez St, Saint Paul, MN 55107",
    city: "St. Paul", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["adjacent-playground"],
    intro: "A splash pad and play area at Parque Castillo on St. Paul's West Side, in the District del Sol.",
    sourceUrl: "https://www.stpaul.gov/facilities/parque-castillo",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "maple-grove-central-park-splash-pad", name: "Maple Grove Central Park Splash Pad", kind: "splash-pad",
    lat: 45.0700, lng: -93.4430, address: "12000 Central Park Way, Maple Grove, MN 55369",
    city: "Maple Grove", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["adjacent-playground"],
    intro: "The interactive fountain at Maple Grove's Central Park — dozens of jets on a plaza that becomes an LED light show after dark, with the playground and Arbor Lakes shops next door.",
    sourceUrl: "https://www.maplegrovemn.gov/505/Central-Park",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "woodbury-sports-center-splash-pad", name: "M Health Fairview Sports Center Splash Pad", kind: "splash-pad",
    lat: 44.9080, lng: -92.9560, address: "4125 Radio Dr, Woodbury, MN 55129",
    city: "Woodbury", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["restrooms"],
    intro: "A free splash pad at the M Health Fairview Sports Center in Woodbury — press a button to restart the jets, with restrooms on site.",
    sourceUrl: "https://www.woodburymn.gov/936/Splash-Pad",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "kelley-park-splash-pad", name: "Kelley Park Splash Pad", kind: "splash-pad",
    lat: 44.7320, lng: -93.2155, address: "6855 Fortino St, Apple Valley, MN 55124",
    city: "Apple Valley", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["adjacent-playground"],
    intro: "A splash pad at Apple Valley's Kelley Park, next to the amphitheater in the Central Village district.",
    sourceUrl: "https://www.applevalleymn.gov/facilities/facility/details/kelleypark-26",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "round-lake-park-splash-pad", name: "Round Lake Park Splash Pad", kind: "splash-pad",
    lat: 44.8650, lng: -93.4625, address: "16691 Valley View Rd, Eden Prairie, MN 55346",
    city: "Eden Prairie", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["adjacent-playground"],
    intro: "A free splash pad at Round Lake Park in Eden Prairie, a short walk from the lake's swimming beach and the playground.",
    sourceUrl: "https://www.edenprairiemn.gov/Home/Components/FacilityDirectory/FacilityDirectory/120/1343",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "grand-prairie-park-splash-pad", name: "Grand Prairie Park Splash Pad", kind: "splash-pad",
    lat: 44.6570, lng: -93.2555, address: "7700 185th St W, Lakeville, MN 55044",
    city: "Lakeville", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["adjacent-playground"],
    intro: "The splash pad at Lakeville's 68-acre Grand Prairie Park, alongside a big playground, ball fields, and pickleball courts.",
    sourceUrl: "https://www.lakevillemn.gov/1362/Grand-Prairie-Park",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "oak-hill-park-splash-pad", name: "Oak Hill Park Splash Pad", kind: "splash-pad",
    lat: 44.9380, lng: -93.3780, address: "3201 Rhode Island Ave S, St. Louis Park, MN 55426",
    city: "St. Louis Park", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["adjacent-playground"],
    intro: "St. Louis Park's splash pad at Oak Hill Park — bubbling hoses, nozzles, and sprinkler arches kids can set off themselves.",
    sourceUrl: "https://www.stlouisparkmn.gov/our-city/thing-to-do/splash-pad",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "lions-park-splash-pad", name: "Lions Park Splash Pad", kind: "splash-pad",
    lat: 44.7920, lng: -93.5350, address: "1103 Adams St S, Shakopee, MN 55379",
    city: "Shakopee", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["adjacent-playground"],
    intro: "A free splash pad at Lions Park in Shakopee, next to the Fun For All accessible playground.",
    sourceUrl: "https://discovershakopee.org/have-fun-by-the-water-in-shakopee/",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "nicollet-commons-splash-pad", name: "Nicollet Commons Park Splash Pad", kind: "splash-pad",
    lat: 44.7740, lng: -93.2880, address: "100 Civic Center Pkwy, Burnsville, MN 55337",
    city: "Burnsville", neighborhood: null, season: SUMMER, cost: "free",
    tags: [],
    intro: "Jets in the plaza at Nicollet Commons Park in downtown Burnsville — press the button to turn them on.",
    sourceUrl: "https://burnsvillemn.gov/facilities/facility/details/Nicollet-Commons-Park-30",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "cedarcrest-park-splash-pad", name: "Cedarcrest Park Splash Pad", kind: "splash-pad",
    lat: 44.8560, lng: -93.2630, address: "8700 Bloomington Ave S, Bloomington, MN 55425",
    city: "Bloomington", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["adjacent-playground", "restrooms"],
    intro: "Bloomington's splash pad at Cedarcrest Park, with a playground, ball fields, and seasonal restrooms.",
    sourceUrl: "https://www.bloomingtonmn.gov/pr/parks/cedarcrest-park",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "boulevard-plaza-splash-pad", name: "Boulevard Plaza Splash Pad", kind: "splash-pad",
    lat: 45.1850, lng: -93.3520, address: "11002 Crooked Lake Blvd, Coon Rapids, MN 55433",
    city: "Coon Rapids", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["adjacent-playground", "restrooms"],
    intro: "A free splash pad at Boulevard Plaza on the Coon Rapids Ice Center grounds, with a play area and restrooms.",
    sourceUrl: "https://www.coonrapidsmn.gov/1485/Boulevard-Plaza-Splash-Pad",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "cliff-fen-splash-pad", name: "Cliff Fen Park Splash Pad", kind: "splash-pad",
    lat: 44.7800, lng: -93.2780, address: "120 E Cliff Rd, Burnsville, MN 55337",
    city: "Burnsville", neighborhood: null, season: SUMMER, cost: "free",
    tags: [],
    intro: "The splash pad at Cliff Fen Park in Burnsville, open late into the evening through the summer.",
    sourceUrl: "https://burnsvillemn.gov/facilities/facility/details/Cliff-Fen-Park-8",
    verifiedAt: "2026-08-07", venueSlug: null,
  },

  // ── Pools (P2.1) ────────────────────────────────────────────────────────
  {
    slug: "webber-natural-swimming-pool", name: "Webber Natural Swimming Pool", kind: "pool",
    lat: 45.0330, lng: -93.2990, address: "4300 Webber Pkwy, Minneapolis, MN 55412",
    city: "Minneapolis", neighborhood: null, season: POOL_SUMMER, cost: "free",
    tags: ["outdoor", "free-admission"],
    intro: "North Minneapolis's chemical-free natural swimming pool — the first of its kind in North America, cleaned by plants in an adjacent pond, and free to swim.",
    sourceUrl: "https://www.minneapolisparks.org/activities-events/water-activities/webber_natural_swimming_pool/",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "bloomington-family-aquatic-center", name: "Bloomington Family Aquatic Center", kind: "pool",
    lat: 44.8585, lng: -93.2960, address: "201 E 90th St, Bloomington, MN 55420",
    city: "Bloomington", neighborhood: null, season: POOL_SUMMER, cost: "paid",
    tags: ["outdoor", "waterslide", "zero-depth-entry"],
    intro: "Bloomington's outdoor aquatic center off 90th — a zero-depth entry, waterslides, and shade for a reliable July afternoon.",
    sourceUrl: "https://www.bloomingtonmn.gov/pr/bloomington-family-aquatic-center",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "cascade-bay-water-park", name: "Cascade Bay Water Park", kind: "pool",
    lat: 44.8330, lng: -93.1660, address: "1360 Civic Center Dr, Eagan, MN 55122",
    city: "Eagan", neighborhood: null, season: POOL_SUMMER, cost: "paid",
    tags: ["outdoor", "waterslide", "zero-depth-entry"],
    intro: "Eagan's outdoor water park by the Civic Arena, with tube slides and a zero-depth pool — a full-day summer stop.",
    sourceUrl: "https://cityofeagan.com/cb-plan-your-visit",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "chaska-community-center-pool", name: "Chaska Community Center Pool", kind: "pool",
    lat: 44.8050, lng: -93.6050, address: "1661 Park Ridge Dr, Chaska, MN 55318",
    city: "Chaska", neighborhood: null, season: YEAR_ROUND, cost: "paid",
    tags: ["indoor", "waterslide", "lap-lanes", "diving"],
    intro: "The indoor pool at the Chaska Community Center — a lap pool, two slides, a rope swing, and a diving platform, open year-round.",
    sourceUrl: "https://www.chaskamn.gov/674/Aquatics",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "como-regional-park-pool", name: "Como Regional Park Pool", kind: "pool",
    lat: 44.9850, lng: -93.1520, address: "1151 Wynne Ave, Saint Paul, MN 55108",
    city: "St. Paul", neighborhood: "como", season: POOL_SUMMER, cost: "paid",
    tags: ["outdoor", "zero-depth-entry", "waterslide"],
    intro: "St. Paul's outdoor pool at Como Regional Park, an easy pairing with the zoo and conservatory next door. Open mid-June to late August.",
    sourceUrl: "https://www.stpaul.gov/departments/parks-and-recreation/aquatics/como-regional-park-pool",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "edina-aquatic-center", name: "Edina Aquatic Center", kind: "pool",
    lat: 44.8850, lng: -93.3435, address: "4300 W 66th St, Edina, MN 55435",
    city: "Edina", neighborhood: null, season: POOL_SUMMER, cost: "paid",
    tags: ["outdoor", "waterslide", "zero-depth-entry", "diving"],
    intro: "Edina's long-running outdoor aquatic center off 66th, with waterslides, a zero-depth pool, and a diving well.",
    sourceUrl: "https://www.edinamn.gov/2159/Aquatic-Center",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "great-river-water-park", name: "Great River Water Park", kind: "pool",
    lat: 44.9560, lng: -93.1470, address: "270 Lexington Pkwy N, Saint Paul, MN 55104",
    city: "St. Paul", neighborhood: null, season: OFF_SEASON, cost: "paid",
    tags: ["indoor", "waterslide", "lap-lanes", "zero-depth-entry"],
    intro: "St. Paul's indoor water park inside the Oxford Community Center — a lap pool, two slides, and a kids' area. It runs the off-season: closed for summer, back in September.",
    sourceUrl: "https://www.stpaul.gov/departments/parks-and-recreation/aquatics/great-river-water-park",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "new-hope-aquatic-park", name: "New Hope Aquatic Park", kind: "pool",
    lat: 45.0380, lng: -93.3810, address: "4411 Xylon Ave N, New Hope, MN 55428",
    city: "New Hope", neighborhood: null, season: POOL_SUMMER, cost: "paid",
    tags: ["outdoor", "waterslide", "diving", "lap-lanes", "zero-depth-entry"],
    intro: "New Hope's outdoor aquatic park — an eight-lane, 50-meter pool, diving boards, a drop slide, and a zero-depth rec area with a current channel.",
    sourceUrl: "https://www.newhopemn.gov/city_hall/parks_and_recreation/aquatic_park",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "redwood-community-pool", name: "Redwood Community Pool", kind: "pool",
    lat: 44.7345, lng: -93.2180, address: "311 150th St W, Apple Valley, MN 55124",
    city: "Apple Valley", neighborhood: null, season: POOL_SUMMER, cost: "paid",
    tags: ["outdoor", "zero-depth-entry", "diving"],
    intro: "Apple Valley's neighborhood outdoor pool at Redwood Park — a zero-depth entry, a climbing wall, and a diving board.",
    sourceUrl: "https://www.applevalleymn.gov/1245/Redwood-Community-Pool",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "richfield-outdoor-pool", name: "Richfield Outdoor Pool", kind: "pool",
    lat: 44.8820, lng: -93.2650, address: "630 E 66th St, Richfield, MN 55423",
    city: "Richfield", neighborhood: null, season: POOL_SUMMER, cost: "paid",
    tags: ["outdoor", "zero-depth-entry", "waterslide", "diving", "lap-lanes"],
    intro: "Richfield's outdoor pool off 66th — a 50-meter main pool, a double waterslide, a diving board, and a zero-depth wading area.",
    sourceUrl: "https://www.richfieldmn.gov/621/Outdoor-Pool",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "st-louis-park-aquatic-park", name: "St. Louis Park Aquatic Park", kind: "pool",
    lat: 44.9430, lng: -93.3470, address: "3700 Monterey Dr, St. Louis Park, MN 55416",
    city: "St. Louis Park", neighborhood: null, season: POOL_SUMMER, cost: "paid",
    tags: ["outdoor", "waterslide", "zero-depth-entry"],
    intro: "St. Louis Park's outdoor aquatic park off Monterey, with slides and a zero-depth pool, open early June into late August.",
    sourceUrl: "https://www.stlouisparkmn.gov/government/departments-divisions/parks-rec/aquatic-park",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "shoreview-tropics-waterpark", name: "The Tropics Indoor Waterpark", kind: "pool",
    lat: 45.0750, lng: -93.1350, address: "4580 Victoria St N, Shoreview, MN 55126",
    city: "Shoreview", neighborhood: null, season: YEAR_ROUND, cost: "paid",
    tags: ["indoor", "waterslide", "lap-lanes", "zero-depth-entry"],
    intro: "The indoor Tropics water park at the Shoreview Community Center — a four-story slide, a lazy river, and a zero-depth area, open year-round.",
    sourceUrl: "https://www.shoreviewcommunitycenter.com/Waterpark/Tropics",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
];

// ── Selectors (pure) ────────────────────────────────────────────────────────

const COST_ORDER: Record<PlaceCost, number> = { free: 0, donation: 1, paid: 2 };

/** Places of one kind, free-first then alphabetical — free is half the point. */
export function placesByKind(kind: PlaceKind): Place[] {
  return PLACES.filter((p) => p.kind === kind).sort(
    (a, b) => COST_ORDER[a.cost] - COST_ORDER[b.cost] || a.name.localeCompare(b.name),
  );
}

/** Places in a neighborhood (by its registry key) — the connective tissue to
 *  neighborhood pages. Suburb/null places never match. */
export function placesByNeighborhood(key: string): Place[] {
  return PLACES.filter((p) => p.neighborhood === key).sort((a, b) => a.name.localeCompare(b.name));
}

/** A single place by slug, or null. */
export function placeBySlug(slug: string): Place | null {
  return PLACES.find((p) => p.slug === slug) ?? null;
}

/**
 * Group a set of places by kind, in KIND_META order, dropping empty kinds. For
 * the "Places in {neighborhood}" strip (P2.2) — the bridge that makes the events
 * and Places halves of the site feed each other.
 */
export function groupPlacesByKind(places: Place[]): { meta: KindMeta; places: Place[] }[] {
  return (Object.keys(KIND_META) as PlaceKind[])
    .map((k) => ({ meta: KIND_META[k], places: places.filter((p) => p.kind === k) }))
    .filter((g) => g.places.length > 0);
}

/** The kinds that currently have at least one place, with counts and open state
 *  — drives the /places index (no empty kind cards; honest emptiness). */
export function kindsWithPlaces(now: Date): { meta: KindMeta; count: number; open: boolean }[] {
  return (Object.keys(KIND_META) as PlaceKind[])
    .map((kind) => {
      const list = placesByKind(kind);
      return { meta: KIND_META[kind], count: list.length, open: list.some((p) => openNow(p, now)) };
    })
    .filter((k) => k.count > 0);
}

/**
 * Is a place open on `date`, evaluated in the Chicago frame (rule 10)? Year-round
 * places are always open; a seasonal place is open when the current Chicago month
 * falls inside its window. Handles a season that wraps the new year (a Dec–Feb
 * rink), so winter kinds work without special-casing.
 */
export function openNow(place: Place, date: Date): boolean {
  if (place.season.type === "year-round") return true;
  const month = Number(chiDayKey(date).slice(5, 7)); // 1–12, Chicago
  const { openMonth, closeMonth } = place.season;
  return openMonth <= closeMonth
    ? month >= openMonth && month <= closeMonth
    : month >= openMonth || month <= closeMonth; // wraps the new year
}

// ── Kind-page rendering helpers (pure; the page/components are thin shells) ──

/**
 * A Mapbox Static Images URL with NUMBERED gold pins (1..N) that MATCH the
 * numbered list beneath, auto-fit to the pins. Null when there's no token or no
 * places. Distinct from event-view's single-pin `staticMapUrl`. Capped at
 * `PLACES_MAP_MAX_PINS` so the URL stays under Mapbox's length limit — a kind
 * bigger than that paginates by area (a later refinement; the seed is far under).
 */
export const PLACES_MAP_MAX_PINS = 30;
export function placesStaticMapUrl(
  places: { lat: number; lng: number }[],
  token: string | undefined,
  size: { w: number; h: number } = { w: 720, h: 480 },
): string | null {
  const pts = places
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
    .slice(0, PLACES_MAP_MAX_PINS);
  if (!token || pts.length === 0) return null;
  const overlays = pts.map((p, i) => `pin-l-${i + 1}+c9a961(${p.lng},${p.lat})`).join(",");
  return (
    `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/` +
    `${overlays}/auto/${size.w}x${size.h}@2x?access_token=${token}`
  );
}

/**
 * The closed-season banner for a kind page, or null when at least one place is
 * open. Honest-emptiness operationalized: never hide the page (its SEO value and
 * a January planner both persist), but say so plainly up top.
 */
export function placesSeasonBanner(places: Place[], now: Date): string | null {
  if (places.length === 0 || places.some((p) => openNow(p, now))) return null;
  const seasonal = places.find((p) => p.season.type === "seasonal");
  const label = seasonal && seasonal.season.type === "seasonal" ? seasonal.season.label : null;
  return label
    ? `Closed for the season — these reopen around ${label.split("–")[0].trim()}.`
    : "Closed for the season right now.";
}
