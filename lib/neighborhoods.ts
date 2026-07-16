import type { EventRecord } from "./types";

/**
 * NEIGHBORHOODS (roadmap 5.5).
 *
 * The area layer (lib/areas.ts) answers "Minneapolis or the west metro?" —
 * but locals think finer than that inside the two core cities: Uptown vs
 * Northeast is a real decision about your night. This layer adds it.
 *
 * HOW: every event is already geocoded, so neighborhoods derive from
 * COORDINATES — nearest centroid within a per-neighborhood radius. No address
 * parsing, no schema change, no backfill: computed at the read path like the
 * 4.7 title hygiene, so the registry is tunable without touching data.
 * Suburban events resolve to null — their city name (Maplewood, Shakopee)
 * already says where they are; a fake "neighborhood" would add nothing.
 *
 * The registry is deliberately COARSE (16 well-known districts, generous
 * radii) — defensible assignments beat granular wrong ones. Every centroid is
 * validated in the golden tests against real venues whose locations are
 * known: First Avenue is Downtown, Target Field is North Loop, the Turf Club
 * is Midway, Como Zoo is Como.
 */

export interface Neighborhood {
  key: string;
  label: string;
  city: "Minneapolis" | "St. Paul";
  lat: number;
  lng: number;
  /** Max distance (km) for an event to belong here. */
  radiusKm: number;
  blurb: string;
}

export const NEIGHBORHOODS: Neighborhood[] = [
  // ── Minneapolis ─────────────────────────────────────────────────────────
  { key: "downtown-minneapolis", label: "Downtown Minneapolis", city: "Minneapolis", lat: 44.977, lng: -93.268, radiusKm: 1.5, blurb: "First Avenue, the theaters, the stadium blocks, and the Mill District." },
  { key: "north-loop", label: "North Loop", city: "Minneapolis", lat: 44.9855, lng: -93.2785, radiusKm: 0.9, blurb: "Warehouse-district restaurants and Target Field." },
  { key: "northeast", label: "Northeast", city: "Minneapolis", lat: 45.001, lng: -93.257, radiusKm: 2.2, blurb: "Breweries, art studios, and neighborhood stages across the river." },
  { key: "uptown", label: "Uptown", city: "Minneapolis", lat: 44.948, lng: -93.298, radiusKm: 1.5, blurb: "Hennepin-and-Lake nightlife, a short walk from the lakes." },
  { key: "loring-park", label: "Loring Park", city: "Minneapolis", lat: 44.9695, lng: -93.284, radiusKm: 0.9, blurb: "The Walker, the Sculpture Garden, and the park itself." },
  { key: "whittier-eat-street", label: "Whittier & Eat Street", city: "Minneapolis", lat: 44.955, lng: -93.2775, radiusKm: 1.0, blurb: "Nicollet's restaurant row, Icehouse, and the MIA." },
  { key: "dinkytown-u-of-m", label: "Dinkytown & U of M", city: "Minneapolis", lat: 44.98, lng: -93.235, radiusKm: 1.5, blurb: "Campus venues and the East Bank." },
  { key: "south-minneapolis", label: "South Minneapolis", city: "Minneapolis", lat: 44.938, lng: -93.235, radiusKm: 2.5, blurb: "Powderhorn, Longfellow, and the neighborhood spots between." },
  { key: "southwest-lakes", label: "Southwest & the Lakes", city: "Minneapolis", lat: 44.925, lng: -93.308, radiusKm: 2.5, blurb: "Bde Maka Ska, Lake Harriet, and the bandshell calendar." },
  { key: "minnehaha", label: "Minnehaha", city: "Minneapolis", lat: 44.915, lng: -93.211, radiusKm: 1.5, blurb: "The falls, the parkway, and Sea Salt season." },
  // ── St. Paul ────────────────────────────────────────────────────────────
  { key: "downtown-st-paul", label: "Downtown St. Paul & Lowertown", city: "St. Paul", lat: 44.947, lng: -93.091, radiusKm: 1.2, blurb: "The Palace, Xcel, CHS Field, and Lowertown's patios." },
  { key: "cathedral-hill", label: "Cathedral Hill & Summit", city: "St. Paul", lat: 44.94, lng: -93.122, radiusKm: 1.3, blurb: "Historic avenues and old-school supper spots." },
  { key: "grand-avenue", label: "Grand Avenue", city: "St. Paul", lat: 44.94, lng: -93.15, radiusKm: 1.8, blurb: "The long shopping-and-dining stretch." },
  { key: "midway-hamline", label: "Midway & Hamline", city: "St. Paul", lat: 44.9555, lng: -93.167, radiusKm: 1.8, blurb: "The Turf Club, Allianz Field, and University Avenue." },
  { key: "como", label: "Como", city: "St. Paul", lat: 44.981, lng: -93.146, radiusKm: 1.5, blurb: "The zoo, the conservatory, and the lakeside pavilion." },
  { key: "highland-park", label: "Highland Park", city: "St. Paul", lat: 44.918, lng: -93.187, radiusKm: 1.8, blurb: "Village shops and the river bluffs." },
];

const BY_KEY = new Map(NEIGHBORHOODS.map((n) => [n.key, n]));

export function neighborhoodByKey(key: string): Neighborhood | null {
  return BY_KEY.get(key) ?? null;
}

/** Haversine distance in km. */
export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Which neighborhood a point belongs to: the NEAREST centroid, provided the
 * point is inside that neighborhood's radius. Nearest-first means adjacent
 * districts (Downtown vs North Loop) resolve to the closer one, and the
 * radius check means Maplewood never gets claimed by Como.
 */
export function neighborhoodOf(lat: number, lng: number): Neighborhood | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  let best: Neighborhood | null = null;
  let bestDist = Infinity;
  for (const n of NEIGHBORHOODS) {
    const d = distanceKm(lat, lng, n.lat, n.lng);
    if (d <= n.radiusKm && d < bestDist) {
      best = n;
      bestDist = d;
    }
  }
  return best;
}

/** Read-path helper: the neighborhood key for an event, or null. */
export function eventNeighborhood(ev: Pick<EventRecord, "lat" | "lng">): string | null {
  return neighborhoodOf(ev.lat, ev.lng)?.key ?? null;
}
