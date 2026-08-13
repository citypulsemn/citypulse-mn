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
// Winter kinds (outdoor rinks, sledding hills) run the cold months, weather
// permitting — the Dec–Feb core, month-level. openMonth > closeMonth wraps the
// new year, so openNow reads them closed all summer and the page shows the
// "closed for the season" banner. Indoor rinks stay YEAR_ROUND.
const WINTER: PlaceSeason = { type: "seasonal", openMonth: 12, closeMonth: 2, label: "December–February" };

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
  {
    slug: "bush-lake-beach", name: "Bush Lake Beach", kind: "beach",
    lat: 44.8470, lng: -93.3830, address: "9140 E Bush Lake Rd, Bloomington, MN 55438",
    city: "Bloomington", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["sand", "concessions"],
    intro: "One of the state's most-visited beaches — a wide sand beach on Bush Lake in Bloomington's Hyland area, now run by Three Rivers, with a volleyball court and a concession stand.",
    sourceUrl: "https://www.threeriversparks.org/location/bush-lake",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "fish-lake-regional-park-beach", name: "Fish Lake Regional Park Beach", kind: "beach",
    lat: 45.0950, lng: -93.4570, address: "14900 Bass Lake Rd, Maple Grove, MN 55311",
    city: "Maple Grove", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["sand"],
    intro: "A clean, shallow sand beach on Fish Lake in Maple Grove — gentle water that suits young kids, free and unguarded.",
    sourceUrl: "https://www.threeriversparks.org/location/fish-lake-regional-park",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "cleary-lake-regional-park-beach", name: "Cleary Lake Regional Park Beach", kind: "beach",
    lat: 44.6850, lng: -93.3980, address: "18106 Texas Ave, Prior Lake, MN 55372",
    city: "Prior Lake", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["sand"],
    intro: "The swimming beach at Cleary Lake Regional Park in Prior Lake, part of a big park with a golf course, campground, and trails.",
    sourceUrl: "https://www.threeriversparks.org/location/cleary-lake-regional-park",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "baker-park-reserve-beach", name: "Baker Park Reserve Beach", kind: "beach",
    lat: 45.0280, lng: -93.6300, address: "2501 Baker Park Rd, Maple Plain, MN 55359",
    city: "Maple Plain", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["sand"],
    intro: "Two sand beaches on Lake Independence at Three Rivers' Baker Park Reserve in Maple Plain, with a creative play area a short walk off.",
    sourceUrl: "https://www.threeriversparks.org/location/baker-park-reserve",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "lake-minnetonka-swim-pond", name: "Lake Minnetonka Swim Pond", kind: "beach",
    lat: 44.9350, lng: -93.6600, address: "4610 County Rd 44, Minnetrista, MN 55331",
    city: "Minnetrista", neighborhood: null, season: SUMMER, cost: "paid",
    tags: ["sand", "restrooms"],
    intro: "A chlorinated, sand-bottomed swim pond at Lake Minnetonka Regional Park in Minnetrista — lake-swimming feel with pool-clean water. A daily pass is required.",
    sourceUrl: "https://www.threeriversparks.org/location/lake-minnetonka-swim-pond",
    verifiedAt: "2026-08-07", venueSlug: null,
  },

  // ── Beaches — metro-wide exhaustive sweep (Aug 2026, F2.7) ────────────────
  // County & suburban lake beaches beyond the MPRB city lakes. Existence is from
  // each county's official swimming-beach list (Ramsey 9, Anoka 4, Washington,
  // Dakota, Carver); coordinates are beach-level from official addresses or
  // known lake geography (same standard as the MPRB beaches above). County
  // beaches are free to enter even where the park charges a vehicle permit; only
  // the chlorinated Lake Elmo swim pond charges per person.
  {
    slug: "long-lake-regional-park-beach", name: "Long Lake Regional Park Beach", kind: "beach",
    lat: 45.0745, lng: -93.2170, address: "Long Lake Regional Park, New Brighton, MN 55112",
    city: "New Brighton", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["sand", "lifeguards"],
    intro: "Ramsey County's only lifeguarded beach — Long Lake Regional Park in New Brighton, with guards on duty Thursday through Sunday afternoons in summer.",
    sourceUrl: "https://www.ramseycountymn.gov/residents/parks-recreation/swimming-beaches",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "white-bear-lake-county-beach", name: "White Bear Lake County Park Beach", kind: "beach",
    lat: 45.0800, lng: -93.0060, address: "White Bear Lake County Park, White Bear Lake, MN 55110",
    city: "White Bear Lake", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["sand"],
    intro: "A Ramsey County sand beach on the big, boat-busy White Bear Lake — unguarded, open dawn to dusk through the summer.",
    sourceUrl: "https://www.ramseycountymn.gov/residents/parks-recreation/swimming-beaches",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "tony-schmidt-lake-johanna-beach", name: "Tony Schmidt Regional Park Beach", kind: "beach",
    lat: 45.0435, lng: -93.1770, address: "Tony Schmidt Regional Park, Arden Hills, MN 55112",
    city: "Arden Hills", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["sand"],
    intro: "The Lake Johanna beach at Tony Schmidt Regional Park in Arden Hills — a Ramsey County sand beach with trails and picnic spots around it.",
    sourceUrl: "https://www.ramseycountymn.gov/residents/parks-recreation/swimming-beaches",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "lake-josephine-county-beach", name: "Lake Josephine County Park Beach", kind: "beach",
    lat: 45.0300, lng: -93.1560, address: "Lake Josephine County Park, Arden Hills, MN 55113",
    city: "Arden Hills", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["sand"],
    intro: "A Ramsey County sand beach on Lake Josephine, on the Arden Hills–Roseville line — unguarded, open through the summer season.",
    sourceUrl: "https://www.ramseycountymn.gov/residents/parks-recreation/swimming-beaches",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "lake-mccarrons-county-beach", name: "Lake McCarrons County Park Beach", kind: "beach",
    lat: 44.9975, lng: -93.1290, address: "Lake McCarrons County Park, Roseville, MN 55113",
    city: "Roseville", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["sand"],
    intro: "Roseville's Lake McCarrons beach — a small, close-in Ramsey County sand beach just north of St. Paul.",
    sourceUrl: "https://www.ramseycountymn.gov/residents/parks-recreation/swimming-beaches",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "lake-owasso-county-beach", name: "Lake Owasso County Park Beach", kind: "beach",
    lat: 45.0330, lng: -93.1490, address: "Lake Owasso County Park, Shoreview, MN 55126",
    city: "Shoreview", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["sand"],
    intro: "A Ramsey County beach on Lake Owasso in Shoreview, with a playground and picnic area next to the sand.",
    sourceUrl: "https://www.ramseycountymn.gov/residents/parks-recreation/swimming-beaches",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "turtle-lake-county-beach", name: "Turtle Lake County Park Beach", kind: "beach",
    lat: 45.0980, lng: -93.1530, address: "Turtle Lake County Park, Shoreview, MN 55126",
    city: "Shoreview", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["sand"],
    intro: "A quiet Ramsey County sand beach on Turtle Lake in northern Shoreview — unguarded, open through the summer.",
    sourceUrl: "https://www.ramseycountymn.gov/residents/parks-recreation/swimming-beaches",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "snail-lake-beach", name: "Snail Lake Beach", kind: "beach",
    lat: 45.0610, lng: -93.1200, address: "Vadnais-Snail Lakes Regional Park, Shoreview, MN 55126",
    city: "Shoreview", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["sand"],
    intro: "The Snail Lake beach at Vadnais-Snail Lakes Regional Park in Shoreview — a Ramsey County sand beach with trails around the lakes.",
    sourceUrl: "https://www.ramseycountymn.gov/residents/parks-recreation/swimming-beaches",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "lake-gervais-county-beach", name: "Lake Gervais County Park Beach", kind: "beach",
    lat: 45.0180, lng: -93.0830, address: "Lake Gervais County Park, Little Canada, MN 55117",
    city: "Little Canada", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["sand"],
    intro: "A small Ramsey County beach on Lake Gervais in Little Canada — unguarded, open dawn to dusk in summer.",
    sourceUrl: "https://www.ramseycountymn.gov/residents/parks-recreation/swimming-beaches",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "coon-lake-county-beach", name: "Coon Lake County Park Beach", kind: "beach",
    lat: 45.2930, lng: -93.0650, address: "5450 197th Ave NE, Columbus, MN 55092",
    city: "Columbus", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["sand"],
    intro: "An Anoka County sand beach on Coon Lake in Columbus, at the north edge of the metro — a vehicle permit gets you in.",
    sourceUrl: "https://www.anokacountyparks.com/parks/category/Swimming+Beach",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "lake-george-regional-beach", name: "Lake George Regional Park Beach", kind: "beach",
    lat: 45.3350, lng: -93.2900, address: "3100 217th Ave NW, Oak Grove, MN 55011",
    city: "Oak Grove", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["sand"],
    intro: "Anoka County's Lake George Regional Park in Oak Grove — a sand swimming beach with a boat launch, picnic areas, and miles of trails.",
    sourceUrl: "https://www.anokacountyparks.com/parks/category/Swimming+Beach",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "martin-linwood-beach", name: "Martin-Island-Linwood Lakes Beach", kind: "beach",
    lat: 45.3650, lng: -93.1100, address: "22480 Martin Lake Rd NW, Linwood Township, MN 55092",
    city: "Linwood Township", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["sand"],
    intro: "A far-north Anoka County beach on Martin Lake in Linwood Township — a sand swimming area with picnic grounds and a boat launch.",
    sourceUrl: "https://www.anokacountyparks.com/parks/category/Swimming+Beach",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "rice-creek-chain-beach", name: "Rice Creek Chain of Lakes Beach", kind: "beach",
    lat: 45.1650, lng: -93.0900, address: "7373 Main St, Lino Lakes, MN 55038",
    city: "Lino Lakes", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["sand"],
    intro: "The swimming beach at Anoka County's Rice Creek Chain of Lakes Park Reserve in Lino Lakes, with camping and trails through the reserve.",
    sourceUrl: "https://www.anokacountyparks.com/parks/category/Swimming+Beach",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "schulze-lake-beach", name: "Schulze Lake Beach", kind: "beach",
    lat: 44.7820, lng: -93.1900, address: "860 Cliff Road, Eagan, MN 55123",
    city: "Eagan", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["sand"],
    intro: "The Schulze Lake beach at Lebanon Hills Regional Park in Eagan — Dakota County's main swimming beach, with water tested weekly through the season.",
    sourceUrl: "https://dakotacountymn.gov/parks/activities/swimming",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "lake-ann-park-beach", name: "Lake Ann Park Swim Beach", kind: "beach",
    lat: 44.8640, lng: -93.5600, address: "1456 W 78th St, Chanhassen, MN 55317",
    city: "Chanhassen", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["sand"],
    intro: "Chanhassen's Lake Ann Park beach, with paddle-craft rentals, a fishing pier, ball fields, and concessions right by the sand.",
    sourceUrl: "https://www.chanhassenmn.gov/departments/parks-recreation/parks-facilities/park-amenities/beaches",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "greenwood-shores-beach", name: "Greenwood Shores Beach", kind: "beach",
    lat: 44.8710, lng: -93.5560, address: "7110 Utica Lane, Chanhassen, MN 55317",
    city: "Chanhassen", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["sand"],
    intro: "A smaller, quieter Lake Ann beach in Chanhassen — Greenwood Shores, with a picnic area and trails and no boat launch crowd.",
    sourceUrl: "https://www.chanhassenmn.gov/departments/parks-recreation/parks-facilities/park-amenities/beaches",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "lake-minnewashta-regional-beach", name: "Lake Minnewashta Regional Park Beach", kind: "beach",
    lat: 44.8790, lng: -93.6060, address: "6900 Hazeltine Blvd, Chanhassen, MN 55331",
    city: "Chanhassen", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["sand"],
    intro: "Carver County's Lake Minnewashta Regional Park in Chanhassen — a sand beach with paddle rentals, a fishing pier, and sand volleyball.",
    sourceUrl: "https://www.carvercountymn.gov/departments/public-works/parks-recreation/parks-trails/lake-minnewashta-regional-park",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "roundhouse-park-beach", name: "Roundhouse Park Beach", kind: "beach",
    lat: 44.8720, lng: -93.6000, address: "3950 Kings Road, Chanhassen, MN 55317",
    city: "Chanhassen", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["sand"],
    intro: "A neighborhood beach on Lake Minnewashta at Chanhassen's Roundhouse Park, with a playground, fishing pier, and restrooms.",
    sourceUrl: "https://www.chanhassenmn.gov/departments/parks-recreation/parks-facilities/park-amenities/beaches",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "lake-waconia-regional-beach", name: "Lake Waconia Regional Park Beach", kind: "beach",
    lat: 44.8560, lng: -93.7500, address: "8170 Paradise Lane, Waconia, MN 55387",
    city: "Waconia", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["sand"],
    intro: "A sand beach on big Lake Waconia at Carver County's regional park, with kayak and paddleboard rentals at the water's edge.",
    sourceUrl: "https://www.waconiamn.gov/479/Regional-Parks",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "square-lake-park-beach", name: "Square Lake Park Beach", kind: "beach",
    lat: 45.1630, lng: -92.7920, address: "Square Lake Park, Stillwater, MN 55082",
    city: "Stillwater", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["sand", "lifeguards"],
    intro: "One of the metro's clearest swimming lakes — Washington County's Square Lake north of Stillwater, staffed with lifeguards on summer afternoons and popular with divers.",
    sourceUrl: "https://www.washingtoncountymn.gov/1363/Swimming-Beaches",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "big-marine-park-beach", name: "Big Marine Park Reserve Beach", kind: "beach",
    lat: 45.1350, lng: -92.8280, address: "Big Marine Park Reserve, Marine on St. Croix, MN 55047",
    city: "Marine on St. Croix", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["sand"],
    intro: "A wide sand beach on Big Marine Lake at Washington County's park reserve, open Memorial Day to Labor Day, with camping and trails nearby.",
    sourceUrl: "https://www.washingtoncountymn.gov/1363/Swimming-Beaches",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "lake-elmo-swim-pond", name: "Lake Elmo Park Reserve Swim Pond", kind: "beach",
    lat: 44.9580, lng: -92.9050, address: "1515 Keats Ave N, Lake Elmo, MN 55042",
    city: "Lake Elmo", neighborhood: null, season: SUMMER, cost: "paid",
    tags: ["sand", "lifeguards"],
    intro: "A chlorinated, sand-bottomed swim pond at Washington County's Lake Elmo Park Reserve — lake feel with pool-clean water and lifeguards. A daily pass is required.",
    sourceUrl: "https://www.washingtoncountymn.gov/1363/Swimming-Beaches",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "point-douglas-park-beach", name: "Point Douglas Park Beach", kind: "beach",
    lat: 44.7470, lng: -92.8080, address: "Point Douglas Park, Hastings, MN 55033",
    city: "Hastings", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["sand"],
    intro: "A St. Croix River beach at the southern tip of Washington County, where the St. Croix meets the Mississippi — unguarded, open through the summer.",
    sourceUrl: "https://www.washingtoncountymn.gov/1363/Swimming-Beaches",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "st-croix-bluffs-beach", name: "St. Croix Bluffs Regional Park Beach", kind: "beach",
    lat: 44.8330, lng: -92.7720, address: "St. Croix Bluffs Regional Park, Hastings, MN 55033",
    city: "Denmark Township", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["sand"],
    intro: "A river swimming beach on the St. Croix at Washington County's St. Croix Bluffs Regional Park, with a boat launch and wooded campground.",
    sourceUrl: "https://www.washingtoncountymn.gov/1363/Swimming-Beaches",
    verifiedAt: "2026-08-13", venueSlug: null,
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

  // ── Splash pads — metro-wide exhaustive sweep (Aug 2026, F2.7) ────────────
  // A 7-county source-driven sweep (MPRB, St. Paul, county park districts, and
  // every suburb's parks dept). Minneapolis (5) and St. Paul (4) confirmed
  // complete against MPRB's and the city's own splash-pad lists. Coordinates are
  // park-level, from each entry's official address; excludes spraygrounds inside
  // paid aquatic centers (those are the pool category) and playground misters.
  {
    slug: "phalen-beach-splash-pad", name: "Phalen Regional Park Beach Splash Pad", kind: "splash-pad",
    lat: 44.9795, lng: -93.0575, address: "1400 Phalen Drive, Saint Paul, MN 55106",
    city: "St. Paul", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["restrooms"],
    intro: "A free splash pad right at Phalen Beach — cool off in the sprays without getting in the lake, with restrooms and picnic spots close by.",
    sourceUrl: "https://www.stpaul.gov/departments/parks-and-recreation/aquatics/phalen-regional-park-beach",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "eagan-central-park-splash-pad", name: "Eagan Central Park Splash Pad", kind: "splash-pad",
    lat: 44.8320, lng: -93.1610, address: "1501 Central Parkway, Eagan, MN 55121",
    city: "Eagan", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["shade"],
    intro: "Ground sprays, overhead fountains, and dump buckets at Eagan's Central Park, with a sun shelter and picnic tables alongside.",
    sourceUrl: "https://cityofeagan.com/splash-pad",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "rosemount-central-park-splash-pad", name: "Rosemount Central Park Splash Pad", kind: "splash-pad",
    lat: 44.7388, lng: -93.1288, address: "2893 145th St W, Rosemount, MN 55068",
    city: "Rosemount", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["shade"],
    intro: "A big rain-deck splash pad in Rosemount with a 'Water Journey' maze of ground nozzles, plus a covered shelter and drinking fountain.",
    sourceUrl: "https://www.rosemountmn.gov/849/Splash-Pad",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "heritage-village-splash-pad", name: "Heritage Village Park Splash Pad", kind: "splash-pad",
    lat: 44.8551, lng: -93.0181, address: "4321 65th St E, Inver Grove Heights, MN 55076",
    city: "Inver Grove Heights", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["adjacent-playground", "restrooms", "shade"],
    intro: "Inver Grove Heights' inclusive splash pad — ground sprays and bucket dumps under a shade shelter, next to an accessible playground.",
    sourceUrl: "https://www.ighmn.gov/442/Heritage-Village-Park-and-Off-Leash-Dog-",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "harmon-park-splash-pad", name: "Harmon Park Splash Pad", kind: "splash-pad",
    lat: 44.9151, lng: -93.0935, address: "230 Bernard St W, West St. Paul, MN 55118",
    city: "West St. Paul", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["adjacent-playground", "restrooms", "shade"],
    intro: "West St. Paul's touch-activated spray park: 25-plus features on four-minute cycles, a playground next door, and shade trees over the benches.",
    sourceUrl: "https://wspmn.gov/750/Harmon-Park",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "miller-park-splash-pad", name: "Miller Park Splash Pad", kind: "splash-pad",
    lat: 44.8557, lng: -93.4854, address: "8208 Eden Prairie Rd, Eden Prairie, MN 55347",
    city: "Eden Prairie", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["adjacent-playground"],
    intro: "One of Eden Prairie's four splash pads — push-button sprays beside a sand-and-water play area and an accessible playground.",
    sourceUrl: "https://www.edenprairiemn.gov/amenities/parks-trails-recreation/recreational-amenities/splash-pads",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "homeward-hills-splash-pad", name: "Homeward Hills Park Splash Pad", kind: "splash-pad",
    lat: 44.8206, lng: -93.4301, address: "12000 Silverwood Dr, Eden Prairie, MN 55347",
    city: "Eden Prairie", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["adjacent-playground"],
    intro: "An Eden Prairie splash pad with a playground and picnic shelter a few steps away, off Homeward Hills Road.",
    sourceUrl: "https://www.edenprairiemn.gov/amenities/parks-trails-recreation/recreational-amenities/splash-pads",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "nesbitt-preserve-splash-pad", name: "Nesbitt Preserve Park Splash Pad", kind: "splash-pad",
    lat: 44.8466, lng: -93.4186, address: "8641 Center Way, Eden Prairie, MN 55344",
    city: "Eden Prairie", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["adjacent-playground"],
    intro: "A quieter neighborhood splash pad next to the Nesbitt Preserve playground in Eden Prairie.",
    sourceUrl: "https://www.edenprairiemn.gov/amenities/parks-trails-recreation/recreational-amenities/splash-pads",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "wayzata-panoway-splash-pad", name: "Wayzata Panoway Splash Pad", kind: "splash-pad",
    lat: 44.9694, lng: -93.5121, address: "681 Lake St E, Wayzata, MN 55391",
    city: "Wayzata", neighborhood: null, season: SUMMER, cost: "free",
    tags: [],
    intro: "Button-activated ground jets in downtown Wayzata's lakefront plaza — a quick cool-off steps from Lake Minnetonka.",
    sourceUrl: "https://www.wayzata.org/392/Panoway",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "new-brighton-lions-park-splash-pad", name: "New Brighton Lions Park Splash Pad", kind: "splash-pad",
    lat: 45.0754, lng: -93.1963, address: "1500 Old Highway 8 NW, New Brighton, MN 55112",
    city: "New Brighton", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["adjacent-playground", "restrooms", "shade"],
    intro: "An accessible splash pad beside the Lions Park playground in New Brighton, with restrooms and shade close by.",
    sourceUrl: "https://www.newbrightonmn.gov/facilities/facility/details/Lions-Park-11",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "mounds-view-splash-down", name: "Splash Down at City Hall Park", kind: "splash-pad",
    lat: 45.1044, lng: -93.2059, address: "2401 Mounds View Blvd, Mounds View, MN 55112",
    city: "Mounds View", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["adjacent-playground", "shade"],
    intro: "'Splash Down' at City Hall Park in Mounds View — sprays beside the playground, with shaded pavilions you can rent.",
    sourceUrl: "https://www.moundsviewmn.gov/government/city_departments/parks_and_recreation/city_parks/city_hall_park.php",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "chanhassen-city-center-splash-pad", name: "Chanhassen City Center Park Splash Pad", kind: "splash-pad",
    lat: 44.8628, lng: -93.5389, address: "7700 Market Blvd, Chanhassen, MN 55317",
    city: "Chanhassen", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["adjacent-playground"],
    intro: "The splash pad on Chanhassen's downtown Civic Campus, rebuilt and reopened in 2026, next to the playground, skate park, and amphitheater.",
    sourceUrl: "https://www.chanhassenmn.gov/government/civic-campus/city-center-park",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "chaska-firemens-park-splash-pad", name: "Firemen's Park Water Play Fountain", kind: "splash-pad",
    lat: 44.7907, lng: -93.6042, address: "3210 Chaska Blvd, Chaska, MN 55318",
    city: "Chaska", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["adjacent-playground", "restrooms"],
    intro: "A free interactive water fountain by the shelter at Chaska's Firemen's Park, steps from the Clayhole swimming beach and the playground.",
    sourceUrl: "https://www.chaskamn.gov/653/About-Parks-Recreation",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "cologne-city-square-splash-pad", name: "Cologne City Square Park Splash Pad", kind: "splash-pad",
    lat: 44.7712, lng: -93.7860, address: "107 John Ave N, Cologne, MN 55322",
    city: "Cologne", neighborhood: null, season: SUMMER, cost: "free",
    tags: [],
    intro: "A zero-depth splash pad with button-timed spray zones in downtown Cologne's City Square Park — it shuts off below 70 degrees.",
    sourceUrl: "https://www.colognemn.com/residents/cologne-splash-pad/",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "mississippi-gateway-splash-pad", name: "Mini-Mississippi Water Play Area", kind: "splash-pad",
    lat: 45.1403, lng: -93.3154, address: "10360 West River Rd, Brooklyn Park, MN 55444",
    city: "Brooklyn Park", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["adjacent-playground", "restrooms"],
    intro: "Three Rivers' free 'Mini-Mississippi' water-play area at Mississippi Gateway — shallow splashing beside the Hillside play area and the Treetop Trail.",
    sourceUrl: "https://www.threeriversparks.org/location/mississippi-gateway-regional-park",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "burnes-park-splash-pad", name: "Burnes Park Splash Pad", kind: "splash-pad",
    lat: 44.9288, lng: -93.4035, address: "301 2nd St N, Hopkins, MN 55343",
    city: "Hopkins", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["adjacent-playground", "restrooms"],
    intro: "Hopkins' button-activated splash pad at Burnes Park, with a playground, picnic shelters, and restrooms alongside.",
    sourceUrl: "https://www.hopkinsmn.com/facilities/facility/details/Burnes-Park-2",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "richfield-splash-pad", name: "Richfield Splash Pad", kind: "splash-pad",
    lat: 44.8834, lng: -93.2675, address: "630 E 66th St, Richfield, MN 55423",
    city: "Richfield", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["restrooms"],
    intro: "Richfield's nature-themed splash pad, new in 2026, right beside the outdoor pool with restrooms at the pool complex.",
    sourceUrl: "https://www.richfieldmn.gov/1000/Splash-Pad",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "lakeside-commons-splash-pad", name: "Lakeside Commons Park Splash Pad", kind: "splash-pad",
    lat: 45.1725, lng: -93.2080, address: "3020 Lakes Parkway NE, Blaine, MN 55449",
    city: "Blaine", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["adjacent-playground", "restrooms"],
    intro: "A free splash pad next to the beach and playground at Blaine's Lakeside Commons, with restrooms in the beach house.",
    sourceUrl: "https://www.blainemn.gov/facilities/facility/details/Lakeside-Commons-Park-Beach-55",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "fridley-commons-park-splash-pad", name: "Commons Park Splash Pad", kind: "splash-pad",
    lat: 45.0772, lng: -93.2620, address: "555 61st Ave NE, Fridley, MN 55432",
    city: "Fridley", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["adjacent-playground", "restrooms", "shade"],
    intro: "Fridley's splash pad at Commons Park, new in 2026, beside an inclusive playground with a shaded picnic pavilion.",
    sourceUrl: "https://www.fridleymn.gov/Community-Recreation/Parks-Trails/Park-System-Improvement-Plan/Commons-Park",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "ramsey-waterfront-splash-pad", name: "The Waterfront Splash Pad", kind: "splash-pad",
    lat: 45.2597, lng: -93.4515, address: "7667 Ramsey Parkway NW, Ramsey, MN 55303",
    city: "Ramsey", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["shade"],
    intro: "Ramsey's 12,000-square-foot splash pad — 80-plus jets and a calmer toddler area, with shaded Adirondack seating; opened summer 2026.",
    sourceUrl: "https://www.cityoframseymn.gov/recreation-culture/facility-and-equipment-rentals/public-safety-the-waterfront/",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "huset-park-splash-pad", name: "Huset Park Splash Pad", kind: "splash-pad",
    lat: 45.0407, lng: -93.2470, address: "520 Mill St NE, Columbia Heights, MN 55421",
    city: "Columbia Heights", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["adjacent-playground", "shade"],
    intro: "Columbia Heights' Huset Park splash pad — 40-plus sprayers under a triple-sail shade system, next to the playground.",
    sourceUrl: "https://www.columbiaheightsmn.gov/departments/recreation/huset_park_west.php",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "becker-park-splash-pad", name: "Becker Park Splash Pad", kind: "splash-pad",
    lat: 45.0565, lng: -93.3642, address: "5530 Douglas Dr N, Crystal, MN 55429",
    city: "Crystal", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["adjacent-playground", "restrooms"],
    intro: "Crystal's splash pad sits at the center of the rebuilt, inclusive Becker Park playground, with the community center and restrooms next door.",
    sourceUrl: "https://parksandrec.crystalmn.gov/recreation/parks_and_trails/becker_park",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "manor-park-splash-pad", name: "Manor Park Splash Pad", kind: "splash-pad",
    lat: 45.0108, lng: -93.3256, address: "3129 Abbott Ave N, Robbinsdale, MN 55422",
    city: "Robbinsdale", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["adjacent-playground"],
    intro: "Buckets and fountains at Robbinsdale's Manor Park, with a playground, picnic shelter, and a tennis court alongside.",
    sourceUrl: "https://www.robbinsdalemn.gov/250/Parks-Facilities",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "andrews-park-splash-pad", name: "Andrews Park Splash Pad", kind: "splash-pad",
    lat: 45.1682, lng: -93.3733, address: "7200 117th Ave N, Champlin, MN 55316",
    city: "Champlin", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["adjacent-playground"],
    intro: "Champlin's Andrews Park splash pad, with a snack shack, playgrounds, ballfields, and sand volleyball around it.",
    sourceUrl: "https://www.champlinmn.gov/482/Andrews-Park",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "mississippi-crossings-splash-pad", name: "Mississippi Crossings Splash Pad", kind: "splash-pad",
    lat: 45.1668, lng: -93.3945, address: "307 East River Parkway, Champlin, MN 55316",
    city: "Champlin", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["adjacent-playground"],
    intro: "A small touch-activated splash pad on Champlin's riverfront at Mississippi Crossings, by the event-center concession and the playground.",
    sourceUrl: "https://www.champlinmn.gov/193/Mississippi-Crossings",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "zanewood-splash-pad", name: "Zanewood Recreation Center Splash Pad", kind: "splash-pad",
    lat: 45.1001, lng: -93.3565, address: "7100 Zane Ave N, Brooklyn Park, MN 55429",
    city: "Brooklyn Park", neighborhood: null, season: SUMMER, cost: "free",
    tags: [],
    intro: "Brooklyn Park's splash pad at the Zanewood Recreation Center, home to the city's free Summer Splash days.",
    sourceUrl: "https://www.brooklynpark.org/event/summer-splash-2/",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "highlands-park-splash-pad", name: "Highlands Park Splash Pad", kind: "splash-pad",
    lat: 44.8060, lng: -92.9300, address: "6975 Idsen Ave S, Cottage Grove, MN 55016",
    city: "Cottage Grove", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["adjacent-playground", "restrooms"],
    intro: "Cottage Grove's zero-depth splash pad at Highlands Park — pillars, mushroom fountains, and touch-activated geysers, with a playground next door.",
    sourceUrl: "https://cottagegrovemn.gov/Facilities/Facility/Details/Splash-Pad-at-Highlands-Park-67",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "lagoon-park-splash-pad", name: "Lagoon Park Splash Pad", kind: "splash-pad",
    lat: 44.6604, lng: -93.6299, address: "300 Park Dr, Jordan, MN 55352",
    city: "Jordan", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["adjacent-playground", "restrooms"],
    intro: "Jordan's colorful splash pad at Lagoon Park, beside the Mill Pond swimming beach, a big playground, and the Sand Creek waterfall.",
    sourceUrl: "https://www.jordanmn.gov/lagoon-park",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "pioneer-park-splash-pad", name: "Pioneer Park Water Feature", kind: "splash-pad",
    lat: 45.0285, lng: -93.0818, address: "2950 Centerville Rd, Little Canada, MN 55117",
    city: "Little Canada", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["adjacent-playground", "restrooms"],
    intro: "Little Canada's Pioneer Park has button-activated fountains that spill into a man-made stream, next to an all-inclusive playground.",
    sourceUrl: "https://www.littlecanadamn.org/599/Pioneer-Park-Planning",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "shoreview-commons-splash-pad", name: "Shoreview Commons Splash Play", kind: "splash-pad",
    lat: 45.0805, lng: -93.1318, address: "4580 Victoria St N, Shoreview, MN 55126",
    city: "Shoreview", neighborhood: null, season: SUMMER, cost: "free",
    tags: ["adjacent-playground", "restrooms", "shade"],
    intro: "Shoreview Commons' destination playground has spray features built in — kids get soaked all summer — with the community center and restrooms right there.",
    sourceUrl: "https://www.shoreviewmn.gov/Parks-rec/Parks/Parks-directory/Shoreview-Commons-Destination-Playground",
    verifiedAt: "2026-08-13", venueSlug: null,
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
  {
    slug: "bunker-beach-water-park", name: "Bunker Beach Water Park", kind: "pool",
    lat: 45.1980, lng: -93.2760, address: "701 County Pkwy A, Coon Rapids, MN 55433",
    city: "Coon Rapids", neighborhood: null, season: POOL_SUMMER, cost: "paid",
    tags: ["outdoor", "waterslide", "lap-lanes"],
    intro: "Minnesota's largest outdoor water park, in Coon Rapids' Bunker Hills — a wave pool, multi-story slides, a lazy river, and a rock wall you climb over the water. (A park vehicle permit is required on top of admission.)",
    sourceUrl: "https://www.exploreminnesota.com/profile/bunker-beach/2383",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "crystal-cove-aquatic-center", name: "Crystal Cove Aquatic Center", kind: "pool",
    lat: 45.0330, lng: -93.3580, address: "4848 Douglas Dr N, Crystal, MN 55429",
    city: "Crystal", neighborhood: null, season: POOL_SUMMER, cost: "paid",
    tags: ["outdoor", "waterslide", "zero-depth-entry"],
    intro: "Crystal's outdoor aquatic center on Douglas Drive — slides, a zero-depth pool, and a July-afternoon crowd from the northwest suburbs.",
    sourceUrl: "https://pool.crystalmn.gov/pool",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "highland-park-aquatic-center", name: "Highland Park Aquatic Center", kind: "pool",
    lat: 44.9180, lng: -93.1880, address: "1840 Edgcumbe Rd, Saint Paul, MN 55116",
    city: "St. Paul", neighborhood: "highland-park", season: POOL_SUMMER, cost: "paid",
    tags: ["outdoor", "zero-depth-entry", "waterslide"],
    intro: "St. Paul's outdoor aquatic center on Edgcumbe, with a zero-depth entry and a waterslide, open early June through Labor Day.",
    sourceUrl: "https://www.stpaul.gov/departments/parks-and-recreation/aquatics/highland-park-aquatic-center",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "grove-cove-aquatic-center", name: "Grove Cove Aquatic Center", kind: "pool",
    lat: 45.1150, lng: -93.4570, address: "12951 Weaver Lake Rd, Maple Grove, MN 55369",
    city: "Maple Grove", neighborhood: null, season: YEAR_ROUND, cost: "paid",
    tags: ["indoor", "waterslide", "zero-depth-entry"],
    intro: "The indoor water park at the Maple Grove Community Center — a 130-foot slide, a zero-depth beach area, and lap lanes, open year-round.",
    sourceUrl: "https://www.maplegrovemn.gov/335/Swimming-pool",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "eagan-community-center-pool", name: "Eagan Community Center Pool", kind: "pool",
    lat: 44.8330, lng: -93.1630, address: "1501 Central Pkwy, Eagan, MN 55121",
    city: "Eagan", neighborhood: null, season: YEAR_ROUND, cost: "paid",
    tags: ["indoor", "lap-lanes"],
    intro: "The year-round indoor pool at the Eagan Community Center — an easy winter fallback when Cascade Bay is closed.",
    sourceUrl: "https://cityofeagan.com/eagan-community-center",
    verifiedAt: "2026-08-07", venueSlug: null,
  },

  // ── Pools — metro sweep (Aug 2026, F2.7) ─────────────────────────────────
  {
    slug: "north-commons-water-park", name: "North Commons Water Park", kind: "pool",
    lat: 44.9998, lng: -93.2988, address: "1701 Golden Valley Rd, Minneapolis, MN 55411",
    city: "Minneapolis", neighborhood: null, season: POOL_SUMMER, cost: "paid",
    tags: ["outdoor", "waterslides", "zero-depth"],
    intro: "MPRB's north-side water park — loop slides, a zero-depth pool, and a water playground off Golden Valley Road. Kids under 18 swim free.",
    sourceUrl: "https://www.minneapolisparks.org/activities-events/water-activities/water_parks/north_commons_water_park/",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "jim-lupient-water-park", name: "Jim Lupient Water Park", kind: "pool",
    lat: 45.0005, lng: -93.2358, address: "1520 Johnson St NE, Minneapolis, MN 55413",
    city: "Minneapolis", neighborhood: null, season: POOL_SUMMER, cost: "paid",
    tags: ["outdoor", "waterslides", "lap-lanes", "zero-depth"],
    intro: "An MPRB water park in Northeast — three big slides, a log walk, spray features, and lap lanes with a zero-depth end for easy access.",
    sourceUrl: "https://www.minneapolisparks.org/activities-events/water-activities/water_parks/jim_lupient_water_park/",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "sandventure-aquatic-park", name: "SandVenture Aquatic Park", kind: "pool",
    lat: 44.7855, lng: -93.5400, address: "1101 Adams St S, Shakopee, MN 55379",
    city: "Shakopee", neighborhood: null, season: POOL_SUMMER, cost: "paid",
    tags: ["outdoor", "waterslides", "sand"],
    intro: "Shakopee's sand-ringed chlorinated water park at Lions Park — a pool-meets-beach hybrid with two drop slides and a 300-foot waterslide.",
    sourceUrl: "https://www.shakopeemn.gov/recreation/sand_venture_aquatic_park.php",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "anoka-aquatic-center", name: "Anoka Aquatic Center", kind: "pool",
    lat: 45.2085, lng: -93.3960, address: "1551 7th Ave, Anoka, MN 55303",
    city: "Anoka", neighborhood: null, season: POOL_SUMMER, cost: "paid",
    tags: ["outdoor", "waterslides", "zero-depth"],
    intro: "Anoka's outdoor aquatic center — a 12-foot climbing wall, a 200-foot slide, a diving board, and zero-depth entry; open Memorial Day to late August.",
    sourceUrl: "https://www.anokamn.gov/164/Aquatic-Center",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "apple-valley-aquatic-center", name: "Apple Valley Family Aquatic Center", kind: "pool",
    lat: 44.7291, lng: -93.1998, address: "14421 Johnny Cake Ridge Rd, Apple Valley, MN 55124",
    city: "Apple Valley", neighborhood: null, season: POOL_SUMMER, cost: "paid",
    tags: ["outdoor", "waterslides", "zero-depth"],
    intro: "Apple Valley's Family Aquatic Center — Splash Valley — with waterslides, a zero-depth entry, and a sprayground in one paid outdoor complex.",
    sourceUrl: "https://www.applevalleymn.gov/971/Splash-Valley-Water-Park",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "hastings-aquatic-center", name: "Hastings Family Aquatic Center", kind: "pool",
    lat: 44.7460, lng: -92.8530, address: "901 Maple St, Hastings, MN 55033",
    city: "Hastings", neighborhood: null, season: POOL_SUMMER, cost: "paid",
    tags: ["outdoor", "waterslides", "zero-depth"],
    intro: "Hastings' outdoor family aquatic center — zero-depth entry, a 201-foot waterslide and a drop slide, a log crossing, and a rock wall.",
    sourceUrl: "https://www.hastingsmn.gov/city-government/city-departments/parks-recreation/facilities/hastings-family-aquatic-center",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "inver-grove-heights-aquatic-center", name: "Veterans Memorial Community Center — The Grove", kind: "pool",
    lat: 44.8480, lng: -93.0490, address: "8055 Barbara Ave, Inver Grove Heights, MN 55077",
    city: "Inver Grove Heights", neighborhood: null, season: YEAR_ROUND, cost: "paid",
    tags: ["indoor", "waterslides", "lap-lanes"],
    intro: "The Grove at Inver Grove Heights' Veterans Memorial Community Center — an indoor waterpark plus a lap pool and dive well, open year-round.",
    sourceUrl: "https://www.ighmn.gov/97/Aquatic-Center",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "brooklyn-center-community-center-pool", name: "Brooklyn Center Community Center Pool", kind: "pool",
    lat: 45.0680, lng: -93.3300, address: "6301 Shingle Creek Pkwy, Brooklyn Center, MN 55430",
    city: "Brooklyn Center", neighborhood: null, season: YEAR_ROUND, cost: "paid",
    tags: ["indoor", "waterslides", "lap-lanes"],
    intro: "Brooklyn Center's community center pool — an indoor 50-meter pool with a 150-foot waterslide and a zero-depth wading area, open year-round.",
    sourceUrl: "https://www.brooklyncentermn.gov/government/departments/recreation/community-center",
    verifiedAt: "2026-08-13", venueSlug: null,
  },

  // ── Parks (P2.1) ─────────────────────────────────────────────────────────
  {
    slug: "minnehaha-regional-park", name: "Minnehaha Regional Park", kind: "park",
    lat: 44.9153, lng: -93.2110, address: "4801 S Minnehaha Dr, Minneapolis, MN 55417",
    city: "Minneapolis", neighborhood: "minnehaha", season: YEAR_ROUND, cost: "free",
    tags: ["trails", "fishing-pier"],
    intro: "The 53-foot falls, the limestone bluffs, and the Sea Salt line out the door in July — one of the metro's oldest and most-loved parks, on the Mississippi at the mouth of Minnehaha Creek.",
    sourceUrl: "https://www.minneapolisparks.org/parks-destinations/parks-lakes/minnehaha_regional_park/",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "theodore-wirth-regional-park", name: "Theodore Wirth Regional Park", kind: "park",
    lat: 44.9880, lng: -93.3200, address: "1221 Theodore Wirth Pkwy, Minneapolis, MN 55411",
    city: "Minneapolis", neighborhood: null, season: YEAR_ROUND, cost: "free",
    tags: ["trails", "disc-golf"],
    intro: "The metro's biggest city park — mountain-bike singletrack, a wildflower garden, a swimming beach, and the Loppet's Trailhead for winter skiing, all a few minutes from downtown.",
    sourceUrl: "https://www.minneapolisparks.org/parks-destinations/parks-lakes/theodore_wirth_regional_park/",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "como-regional-park", name: "Como Regional Park", kind: "park",
    lat: 44.9820, lng: -93.1500, address: "1199 Midway Pkwy, Saint Paul, MN 55103",
    city: "St. Paul", neighborhood: "como", season: YEAR_ROUND, cost: "free",
    tags: ["trails"],
    intro: "The free zoo, the glass conservatory that stays 75 degrees in February, the lakeside pavilion, and a whole day's worth of paths around Como Lake.",
    sourceUrl: "https://www.stpaul.gov/departments/parks-and-recreation/como-regional-park",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "lebanon-hills-regional-park", name: "Lebanon Hills Regional Park", kind: "park",
    lat: 44.7830, lng: -93.1850, address: "860 Cliff Rd, Eagan, MN 55123",
    city: "Eagan", neighborhood: null, season: YEAR_ROUND, cost: "free",
    tags: ["trails", "fishing-pier", "dog-friendly"],
    intro: "Dakota County's biggest park — nearly 2,000 acres of trails, lakes, a swimming beach at Schulze Lake, canoe routes, and camping on the metro's south edge.",
    sourceUrl: "https://www.co.dakota.mn.us/parks/parksTrails/LebanonHills",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "hyland-lake-park-reserve", name: "Hyland Lake Park Reserve", kind: "park",
    lat: 44.8330, lng: -93.3780, address: "10145 Bush Lake Rd, Bloomington, MN 55438",
    city: "Bloomington", neighborhood: null, season: YEAR_ROUND, cost: "free",
    tags: ["trails", "disc-golf"],
    intro: "Bloomington's big Three Rivers reserve — the award-winning Chutes and Ladders playground, a visitor center, prairie-and-woods trails, and a chairlift-served tubing hill in winter.",
    sourceUrl: "https://www.threeriversparks.org/HylandLakeParkReserve",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "elm-creek-park-reserve", name: "Elm Creek Park Reserve", kind: "park",
    lat: 45.1550, lng: -93.4550, address: "12400 James Deane Pkwy, Maple Grove, MN 55369",
    city: "Maple Grove", neighborhood: null, season: YEAR_ROUND, cost: "free",
    tags: ["trails", "disc-golf"],
    intro: "The largest park in the Three Rivers district — 5,300 acres of trails, a swim pond, a nature center, and a tubing-and-ski hill, on the metro's northwest edge.",
    sourceUrl: "https://www.threeriversparks.org/location/elm-creek-park-reserve",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "silverwood-park", name: "Silverwood Park", kind: "park",
    lat: 45.0330, lng: -93.2200, address: "2500 County Rd E W, St. Anthony, MN 55421",
    city: "St. Anthony", neighborhood: null, season: YEAR_ROUND, cost: "free",
    tags: ["trails", "fishing-pier"],
    intro: "A Three Rivers park built around art and nature on Silver Lake — a gallery and café in the visitor center, restored prairie and oak woods, and classes year-round.",
    sourceUrl: "https://www.threeriversparks.org/location/silverwood-park",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "minnesota-landscape-arboretum", name: "Minnesota Landscape Arboretum", kind: "park",
    lat: 44.8620, lng: -93.6050, address: "3675 Arboretum Dr, Chaska, MN 55318",
    city: "Chaska", neighborhood: null, season: YEAR_ROUND, cost: "paid",
    tags: ["trails", "accessible"],
    intro: "The University of Minnesota's 1,200-acre arboretum in Chaska — display gardens, a three-mile drive, miles of trails, and a giant model-train garden, open 363 days a year. Admission for adults; kids free.",
    sourceUrl: "https://arb.umn.edu/",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "battle-creek-regional-park", name: "Battle Creek Regional Park", kind: "park",
    lat: 44.9380, lng: -93.0100, address: "2300 Upper Afton Rd, Maplewood, MN 55119",
    city: "Maplewood", neighborhood: null, season: YEAR_ROUND, cost: "free",
    tags: ["trails", "dog-friendly"],
    intro: "A big east-metro Ramsey County park — paved and mountain-bike trails, a dog park, and the seasonal Battle Creek Waterworks splash park for the under-10 crowd.",
    sourceUrl: "https://www.ramseycountymn.gov/residents/parks-recreation/parks-trails/find-park/battle-creek-regional-park",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "gold-medal-park", name: "Gold Medal Park", kind: "park",
    lat: 44.9770, lng: -93.2560, address: "2nd St & 11th Ave S, Minneapolis, MN 55415",
    city: "Minneapolis", neighborhood: "downtown-minneapolis", season: YEAR_ROUND, cost: "free",
    tags: ["trails"],
    intro: "The spiral-mound park behind the Guthrie in Downtown East — climb the 32-foot mound for a river-and-skyline view, best at dusk. Privately built, always free.",
    sourceUrl: "https://www.goldmedalpark.org/",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "bunker-hills-regional-park", name: "Bunker Hills Regional Park", kind: "park",
    lat: 45.1980, lng: -93.2760, address: "701 County Pkwy A, Coon Rapids, MN 55433",
    city: "Coon Rapids", neighborhood: null, season: YEAR_ROUND, cost: "free",
    tags: ["trails", "dog-friendly"],
    intro: "Anoka County's 1,700-acre park in Coon Rapids — 10-plus miles of trails, archery, camping, and Bunker Beach water park in summer. (A vehicle permit is required to enter.)",
    sourceUrl: "https://www.anokacountyparks.com/parks/bunker-hills-park",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "boom-island-park", name: "Boom Island Park", kind: "park",
    lat: 44.9920, lng: -93.2630, address: "Sibley St NE, Minneapolis, MN 55413",
    city: "Minneapolis", neighborhood: "northeast", season: YEAR_ROUND, cost: "free",
    tags: ["trails", "fishing-pier"],
    intro: "A riverfront park on the Mississippi in Northeast — a little lighthouse, a paddleboat dock, a playground, and the Nicollet Island footbridge into the old milling district.",
    sourceUrl: "https://www.minneapolisparks.org/parks-destinations/parks-lakes/boom_island_park/",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "crosby-farm-regional-park", name: "Crosby Farm Regional Park", kind: "park",
    lat: 44.9050, lng: -93.1800, address: "2595 Crosby Farm Rd, Saint Paul, MN 55116",
    city: "St. Paul", neighborhood: "highland-park", season: YEAR_ROUND, cost: "free",
    tags: ["trails", "fishing-pier"],
    intro: "St. Paul's largest natural park — nearly seven miles of paved trail through floodplain forest along the Mississippi and around Crosby Lake, below the Highland bluff.",
    sourceUrl: "https://www.exploreminnesota.com/profile/crosby-farm-hidden-falls-park/2970",
    verifiedAt: "2026-08-07", venueSlug: null,
  },

  // ── Playgrounds (P2.1) ───────────────────────────────────────────────────
  {
    slug: "hyland-chutes-and-ladders-playground", name: "Chutes and Ladders Play Area (Hyland)", kind: "playground",
    lat: 44.8330, lng: -93.3775, address: "10145 Bush Lake Rd, Bloomington, MN 55438",
    city: "Bloomington", neighborhood: null, season: YEAR_ROUND, cost: "free",
    tags: ["accessible", "shade"],
    intro: "The award-winning 16,000-square-foot creative play structure at Hyland Lake Park Reserve — ramps, towers, and slides that draw families from across the metro.",
    sourceUrl: "https://www.threeriversparks.org/location/hyland-play-area",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "madisons-place-playground", name: "Madison's Place Playground", kind: "playground",
    lat: 44.9080, lng: -92.9560, address: "4125 Radio Dr, Woodbury, MN 55129",
    city: "Woodbury", neighborhood: null, season: YEAR_ROUND, cost: "free",
    tags: ["accessible", "fenced", "shade"],
    intro: "Woodbury's fully inclusive playground on the M Health Fairview Sports Center campus — shaded decks, sensory play, and wheelchair ramps, built for kids of every ability.",
    sourceUrl: "https://www.woodburymn.gov/482/Madisons-Place-Playground",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "wabun-play-area", name: "Wabun Play Area", kind: "playground",
    lat: 44.9150, lng: -93.2070, address: "4655 46th Ave S, Minneapolis, MN 55406",
    city: "Minneapolis", neighborhood: "minnehaha", season: YEAR_ROUND, cost: "free",
    tags: ["accessible", "shade"],
    intro: "Minneapolis's first fully inclusive playground, tucked in the Wabun area of Minnehaha Park — a summer-camp-styled natural play space with a spraying-rock water feature.",
    sourceUrl: "https://www.minneapolisparks.org/parks-destinations/parks-lakes/minnehaha_regional_park/",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "maple-grove-central-park-playground", name: "Central Park Playground (Maple Grove)", kind: "playground",
    lat: 45.0700, lng: -93.4430, address: "12000 Central Park Way, Maple Grove, MN 55369",
    city: "Maple Grove", neighborhood: null, season: YEAR_ROUND, cost: "free",
    tags: ["accessible"],
    intro: "The big destination playground at Maple Grove's Central Park, steps from the interactive fountain and the Arbor Lakes shops.",
    sourceUrl: "https://www.maplegrovemn.gov/505/Central-Park",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "hamlet-park-playground", name: "Hamlet Park Playground", kind: "playground",
    lat: 44.8280, lng: -92.9430, address: "8883 Hamlet Ave S, Cottage Grove, MN 55016",
    city: "Cottage Grove", neighborhood: null, season: YEAR_ROUND, cost: "free",
    tags: ["fenced"],
    intro: "The playground and bike park at Cottage Grove's Hamlet Park, the east metro's go-to for a long afternoon with ball fields, trails, and shelters alongside.",
    sourceUrl: "https://www.cottagegrovemn.gov/facilities/facility/details/Hamlet-Park-9",
    verifiedAt: "2026-08-07", venueSlug: null,
  },

  // ── Destination playgrounds — curated (Aug 2026, F2.7) ────────────────────
  // The "worth the drive" playgrounds: inclusive, themed, or unusually big. This
  // is the CURATED half of playgrounds (with the age-fit / accessibility detail
  // that can't be scraped); the exhaustive "every playground" map layer is a
  // separate OSM-sourced build (owner's hybrid call).
  {
    slug: "french-regional-playground", name: "French Regional Park Playground", kind: "playground",
    lat: 45.0306, lng: -93.4390, address: "12605 Rockford Rd, Plymouth, MN 55441",
    city: "Plymouth", neighborhood: null, season: YEAR_ROUND, cost: "free",
    tags: ["inclusive", "themed"],
    intro: "Three Rivers' inclusive playground at French Regional Park in Plymouth, built around a three-story fire tower with slides on every level, plus zip lines and see-saws.",
    sourceUrl: "https://www.threeriversparks.org/location/french-regional-park",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "roseville-central-park-playground", name: "Central Park Playground (Roseville)", kind: "playground",
    lat: 45.0200, lng: -93.1470, address: "2540 Lexington Ave N, Roseville, MN 55113",
    city: "Roseville", neighborhood: null, season: YEAR_ROUND, cost: "free",
    tags: ["inclusive", "accessible"],
    intro: "Roseville's Central Park inclusive playground (Victoria West) — a We-Go-Round, a zip line, bucket swings, and ramps so kids of every ability play side by side.",
    sourceUrl: "https://www.cityofroseville.com/200/Central-Park---Lexington",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "staring-lake-playground", name: "Staring Lake Park Playground", kind: "playground",
    lat: 44.8530, lng: -93.4650, address: "14800 Pioneer Trail, Eden Prairie, MN 55347",
    city: "Eden Prairie", neighborhood: null, season: YEAR_ROUND, cost: "free",
    tags: ["themed"],
    intro: "Eden Prairie's fire-tower playground at Staring Lake — a three-story metal tower with slides, a telescope and old radio, a log prairie house, and a hollow tree to climb.",
    sourceUrl: "https://www.edenprairiemn.gov/home/components/facilitydirectory/facilitydirectory/146/1343",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "teddy-bear-park-playground", name: "Teddy Bear Park", kind: "playground",
    lat: 45.0555, lng: -92.8050, address: "207 Nelson St E, Stillwater, MN 55082",
    city: "Stillwater", neighborhood: null, season: YEAR_ROUND, cost: "free",
    tags: ["themed", "toddlers", "shade"],
    intro: "Stillwater's downtown Teddy Bear Park — a giant granite bear, a treehouse with a log slide, and a Lift Bridge climber, all geared to the seven-and-under crowd.",
    sourceUrl: "https://www.stillwatermn.gov/Home/Components/FacilityDirectory/FacilityDirectory/10/",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "becker-park-playground", name: "Becker Park Playground", kind: "playground",
    lat: 45.0565, lng: -93.3642, address: "5530 Douglas Dr N, Crystal, MN 55429",
    city: "Crystal", neighborhood: null, season: YEAR_ROUND, cost: "free",
    tags: ["inclusive", "accessible"],
    intro: "Crystal's Becker Park — a fully inclusive, ramped playground rebuilt in 2020 with poured-in-place surfacing, wrapped around the splash pad and community center.",
    sourceUrl: "https://parksandrec.crystalmn.gov/recreation/parks_and_trails/becker_park",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "elm-creek-play-area", name: "Elm Creek Play Area", kind: "playground",
    lat: 45.1300, lng: -93.4400, address: "12400 James Deane Pkwy, Maple Grove, MN 55369",
    city: "Maple Grove", neighborhood: null, season: YEAR_ROUND, cost: "free",
    tags: ["destination"],
    intro: "One of Minnesota's largest playgrounds — Three Rivers' Elm Creek Play Area in Maple Grove, with two three-story slide towers, a climbable fossil, and a spinning web.",
    sourceUrl: "https://www.threeriversparks.org/location/elm-creek-park-reserve",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "waterford-park-playground", name: "Waterford Park Playground", kind: "playground",
    lat: 44.8640, lng: -93.8000, address: "1702 Ravencroft Rd, Waconia, MN 55387",
    city: "Waconia", neighborhood: null, season: YEAR_ROUND, cost: "free",
    tags: ["inclusive"],
    intro: "Waconia's Waterford Park — a big, bright inclusive playground built so kids of all abilities can play together, out at the western edge of the metro.",
    sourceUrl: "https://www.waconiamn.gov/473/Community-Parks",
    verifiedAt: "2026-08-13", venueSlug: null,
  },
  {
    slug: "shoreview-commons-playground", name: "Shoreview Commons Destination Playground", kind: "playground",
    lat: 45.0805, lng: -93.1318, address: "4580 Victoria St N, Shoreview, MN 55126",
    city: "Shoreview", neighborhood: null, season: YEAR_ROUND, cost: "free",
    tags: ["destination", "inclusive"],
    intro: "Shoreview Commons' destination playground — a big nature-themed structure with built-in water-spray play, right by the community center.",
    sourceUrl: "https://www.shoreviewmn.gov/Parks-rec/Parks/Parks-directory/Shoreview-Commons-Destination-Playground",
    verifiedAt: "2026-08-13", venueSlug: null,
  },

  // ── Ice rinks (P2.1 — winter) ────────────────────────────────────────────
  {
    slug: "john-rose-minnesota-oval", name: "John Rose Minnesota Oval", kind: "rink",
    lat: 45.0100, lng: -93.1550, address: "2660 Civic Center Dr, Roseville, MN 55113",
    city: "Roseville", neighborhood: null, season: WINTER, cost: "paid",
    tags: ["outdoor", "skate-rental", "hockey-and-open"],
    intro: "The world's largest outdoor refrigerated skating surface, in Roseville — a 400-meter speed track wrapping a hockey sheet, lit and open November into March.",
    sourceUrl: "https://www.cityofroseville.com/3560/John-Rose-MN-OVAL",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "centennial-lakes-skating", name: "Centennial Lakes Park Skating", kind: "rink",
    lat: 44.8620, lng: -93.3280, address: "7499 France Ave S, Edina, MN 55435",
    city: "Edina", neighborhood: null, season: WINTER, cost: "free",
    tags: ["outdoor", "skate-rental"],
    intro: "Skate a groomed quarter-mile of winding canals across three ponds at Centennial Lakes in Edina — free with your own skates, with rentals and a warming pavilion.",
    sourceUrl: "https://www.edinamn.gov/700/Ice-Skating",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "groveland-ice-rinks", name: "Groveland Ice Rinks", kind: "rink",
    lat: 44.9340, lng: -93.1450, address: "2021 St. Clair Ave, Saint Paul, MN 55105",
    city: "St. Paul", neighborhood: "grand-avenue", season: WINTER, cost: "free",
    tags: ["outdoor", "skate-rental", "warming-house", "hockey-and-open"],
    intro: "St. Paul's outdoor skating hub off St. Clair — five rinks (hockey, pond hockey, an oval, and open skating), a warming house, and free skate rentals seven days a week.",
    sourceUrl: "https://www.stpaul.gov/facilities/groveland-recreation-center",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "parade-ice-garden", name: "Parade Ice Garden", kind: "rink",
    lat: 44.9690, lng: -93.2900, address: "600 Kenwood Pkwy, Minneapolis, MN 55403",
    city: "Minneapolis", neighborhood: null, season: YEAR_ROUND, cost: "paid",
    tags: ["indoor", "skate-rental", "hockey-and-open"],
    intro: "The city's indoor rinks off Kenwood Parkway, with open skate year-round when the outdoor ice is gone — three sheets, cheap admission, skate rental on site.",
    sourceUrl: "https://www.minneapolisparks.org/parks-destinations/recreation_centers_program_facilities/parade_ice_garden/",
    verifiedAt: "2026-08-07", venueSlug: null,
  },

  // ── Sledding hills (P2.1 — winter) ───────────────────────────────────────
  {
    slug: "theodore-wirth-sledding-hill", name: "Theodore Wirth Sledding Hill", kind: "sledding",
    lat: 44.9980, lng: -93.3180, address: "Theodore Wirth Pkwy, Minneapolis, MN 55422",
    city: "Minneapolis", neighborhood: null, season: WINTER, cost: "free",
    tags: ["steep", "parking-nearby"],
    intro: "The metro's marquee sledding hill, just north of the Wirth Chalet — long runs with a warming chalet steps away, open 7 am to 9 pm all winter.",
    sourceUrl: "https://www.minneapolisparks.org/activities-events/winter_activities/sledding/",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "columbia-park-sledding-hill", name: "Columbia Park Sledding Hill", kind: "sledding",
    lat: 45.0200, lng: -93.2460, address: "3300 Central Ave NE, Minneapolis, MN 55418",
    city: "Minneapolis", neighborhood: null, season: WINTER, cost: "free",
    tags: ["steep"],
    intro: "One of the steepest hills in Minneapolis, on the edge of the Columbia golf course in Northeast — not for the timid, and free.",
    sourceUrl: "https://www.minneapolisparks.org/activities-events/winter_activities/sledding/",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "powderhorn-park-sledding-hill", name: "Powderhorn Park Sledding Hill", kind: "sledding",
    lat: 44.9380, lng: -93.2640, address: "3400 15th Ave S, Minneapolis, MN 55407",
    city: "Minneapolis", neighborhood: "south-minneapolis", season: WINTER, cost: "free",
    tags: ["gentle"],
    intro: "The west slope above Powderhorn Lake in south Minneapolis — a friendly neighborhood hill, and home each January to the gloriously absurd Art Sled Rally.",
    sourceUrl: "https://www.minneapolisparks.org/parks-destinations/parks-lakes/powderhorn_park/",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "battle-creek-sledding-hill", name: "Battle Creek Sledding Hill", kind: "sledding",
    lat: 44.9380, lng: -93.0100, address: "2300 Upper Afton Rd, Maplewood, MN 55119",
    city: "Maplewood", neighborhood: null, season: WINTER, cost: "free",
    tags: ["steep", "parking-nearby"],
    intro: "A big, fast sledding hill in Battle Creek Regional Park on the east side — one of the metro's best, with a warming shelter and parking right there.",
    sourceUrl: "https://www.ramseycountymn.gov/residents/parks-recreation/parks-trails/find-park/battle-creek-regional-park",
    verifiedAt: "2026-08-07", venueSlug: null,
  },
  {
    slug: "como-park-sledding-hill", name: "Como Park Sledding Hill", kind: "sledding",
    lat: 44.9880, lng: -93.1520, address: "Como Park Golf Course, Saint Paul, MN 55103",
    city: "St. Paul", neighborhood: "como", season: WINTER, cost: "free",
    tags: ["gentle"],
    intro: "The gentle hill by the Como golf course — an easy, kid-friendly sled next to the zoo and conservatory.",
    sourceUrl: "https://www.stpaul.gov/departments/parks-and-recreation/como-regional-park",
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
