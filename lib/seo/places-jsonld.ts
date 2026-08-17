import type { Place, PlaceKind } from "../places";
import { PLACE_DETAIL_LABELS, activeDetailKeys } from "../places";

/**
 * schema.org structured data for the Places directory — the payoff for the
 * winning-detail moat. Each place emits an `amenityFeature` list built from its
 * VERIFIED details (LocationFeatureSpecification), so Google reads exactly what a
 * pool/rink/orchard actually offers. Pure functions, unit-tested; the kind page
 * renders the ItemList inside a <script type="application/ld+json"> via the
 * shared jsonLdSafe (never raw JSON.stringify — the R0.6 breakout fix).
 *
 * Honesty carries through: amenityFeature only ever lists a detail that is
 * `true` (source-verified), so the structured data can't over-promise a fact the
 * badge itself wouldn't show.
 */

export interface PlacesJsonLdOptions {
  baseUrl: string;
}

/**
 * The schema.org @type for a kind. `TouristAttraction` is the safe default (valid
 * for any visitor destination); a few kinds get a more specific, still-valid type.
 */
const SCHEMA_TYPE: Partial<Record<PlaceKind, string>> = {
  museum: "Museum",
  rink: "SportsActivityLocation",
  pool: "SportsActivityLocation",
  "ski-hill": "SportsActivityLocation",
  "disc-golf": "SportsActivityLocation",
  "dog-park": "SportsActivityLocation",
  "trampoline-climbing": "SportsActivityLocation",
  park: "Park",
  garden: "Park",
  beach: "Park",
};

export function placeSchemaType(kind: PlaceKind): string {
  return SCHEMA_TYPE[kind] ?? "TouristAttraction";
}

/**
 * The place's verified details as schema.org LocationFeatureSpecification, in the
 * render order of PLACE_DETAIL_LABELS. Only `true` facts appear — an unverified
 * (absent) detail is never emitted.
 */
export function placeAmenityFeatures(
  place: Place,
): { "@type": "LocationFeatureSpecification"; name: string; value: true }[] {
  const d = place.details;
  if (!d) return [];
  return (Object.keys(PLACE_DETAIL_LABELS) as (keyof typeof PLACE_DETAIL_LABELS)[])
    .filter((k) => d[k] === true)
    .map((k) => ({ "@type": "LocationFeatureSpecification", name: PLACE_DETAIL_LABELS[k]!, value: true }));
}

/** schema.org object for a single place, with amenityFeature from verified details. */
export function placeJsonLd(
  place: Place,
  kind: PlaceKind,
  opts: PlacesJsonLdOptions,
): Record<string, unknown> {
  const data: Record<string, unknown> = {
    "@type": placeSchemaType(kind),
    name: place.name,
    url: `${opts.baseUrl}/places/${kind}#${place.slug}`,
    address: {
      "@type": "PostalAddress",
      streetAddress: place.address || undefined,
      addressLocality: place.city || undefined,
      addressRegion: "MN",
      addressCountry: "US",
    },
  };
  if (Number.isFinite(place.lat) && Number.isFinite(place.lng) && !(place.lat === 0 && place.lng === 0)) {
    data.geo = { "@type": "GeoCoordinates", latitude: place.lat, longitude: place.lng };
  }
  // Cost → isAccessibleForFree (donation is left ambiguous, so omitted).
  if (place.cost === "free") data.isAccessibleForFree = true;
  else if (place.cost === "paid") data.isAccessibleForFree = false;
  const feats = placeAmenityFeatures(place);
  if (feats.length) data.amenityFeature = feats;
  return data;
}

/** schema.org ItemList of the places on a kind page, each item carrying its facts. */
export function placesItemListJsonLd(
  places: Place[],
  kind: PlaceKind,
  opts: PlacesJsonLdOptions,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: places.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: placeJsonLd(p, kind, opts),
    })),
  };
}

/**
 * An honest, keyword-rich clause for the kind page's meta description — the
 * verified facts a visitor can filter by, in label order (e.g. "indoor, water
 * slide, and zero-depth entry"). Null for a kind with no verified details, so the
 * description simply omits the clause rather than inventing one. Capped at four
 * so the description stays short.
 */
export function placesFactSummary(places: Place[]): string | null {
  const keys = activeDetailKeys(places).slice(0, 4);
  if (!keys.length) return null;
  const labels = keys.map((k) => PLACE_DETAIL_LABELS[k]!.toLowerCase());
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}
