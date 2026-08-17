import type { Place, PlaceSeason } from "./places";

/**
 * Data shaping for the interactive (clustered) Places map. Kept pure and
 * unit-tested so the map component (components/PlacesMapInteractive.tsx) stays a
 * thin Mapbox shell — and so the one real footgun, GeoJSON's [lng, lat] order
 * (the registry stores lat, lng), is pinned by a test.
 *
 * Clustering is why this is GeoJSON, not DOM markers: a source with
 * `cluster: true` renders thousands of points on the GPU, which is what the
 * exhaustive-coverage plan needs — a "every splash pad in the metro" page can't
 * paint 200 DOM markers smoothly, and the old static map capped at 30 pins.
 */

const COST_LABEL: Record<Place["cost"], string> = {
  free: "Free",
  paid: "Paid",
  donation: "Donation",
};

/** Short human season label for a map popup ("Year-round" or the season label). */
export function placeSeasonShort(season: PlaceSeason): string {
  return season.type === "year-round" ? "Year-round" : season.label;
}

export interface PlaceFeatureProps {
  slug: string;
  name: string;
  cost: string; // "Free" | "Paid" | "Donation"
  city: string;
  season: string;
  kind: string;
}

export interface PlacePointFeature {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: PlaceFeatureProps;
}

export interface PlaceFeatureCollection {
  type: "FeatureCollection";
  features: PlacePointFeature[];
}

/**
 * Places → GeoJSON FeatureCollection for a clustered map source. Drops entries
 * with non-finite coordinates (honest data: a place we couldn't geocode is not
 * silently dropped ONTO the map at 0,0 — it's excluded here and still listed).
 * Coordinates are [lng, lat] — GeoJSON order.
 */
/**
 * The [[minLng, minLat], [maxLng, maxLat]] bounding box of a set of places, in
 * GeoJSON [lng, lat] order — for `map.fitBounds()` when the filtered set changes.
 * Pure (so the map component can refit without pulling in the Mapbox module for a
 * `LngLatBounds`), and ignores non-finite coords the same way `placesToGeoJSON`
 * does. Returns null for an empty/uncoordinated set so the caller keeps its
 * current viewport rather than jumping to 0,0.
 */
export function placesBounds(
  places: Place[],
): [[number, number], [number, number]] | null {
  let minLng = Infinity,
    minLat = Infinity,
    maxLng = -Infinity,
    maxLat = -Infinity;
  for (const p of places) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lat < minLat) minLat = p.lat;
    if (p.lng > maxLng) maxLng = p.lng;
    if (p.lat > maxLat) maxLat = p.lat;
  }
  if (!Number.isFinite(minLng)) return null;
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

export function placesToGeoJSON(places: Place[]): PlaceFeatureCollection {
  return {
    type: "FeatureCollection",
    features: places
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
      .map((p) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [p.lng, p.lat] },
        properties: {
          slug: p.slug,
          name: p.name,
          cost: COST_LABEL[p.cost],
          city: p.city,
          season: placeSeasonShort(p.season),
          kind: p.kind,
        },
      })),
  };
}
