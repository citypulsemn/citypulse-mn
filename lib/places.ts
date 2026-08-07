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
