/**
 * Deciding whether a place's stored coordinate is actually wrong.
 *
 * A geocoder disagreeing with us is not evidence. The first coordinate audit
 * (6 Sep 2026) asked Nominatim alone and got 119 disagreements, of which the
 * great majority were the geocoder's own failures: it placed 2540 Nicollet Ave S
 * five miles south of itself and Sweetland Orchard in Missouri. Acting on that
 * list would have moved correct pins to wrong places.
 *
 * So the rule here is corroboration. Two providers reading different source
 * data (Nominatim → OpenStreetMap, Census → TIGER) have to agree with each
 * other AND against us before anything counts as a finding. Everything else is
 * a question, and questions go to a human — the same shape as the report-check
 * verdicts in lib/report-check.ts, where "unclear" never recommends removal.
 */
import { distanceMeters } from "./geo-distance";

export type Point = { lat: number; lng: number };
export type Hit = Point | null;

export type CoordVerdict =
  /** At least one provider landed on us. Our coordinate is a real match. */
  | "agreed"
  /** Both providers say we are wrong, and they agree where we should be. */
  | "confirmed"
  /** Both say we are wrong but point in different directions. No consensus. */
  | "providers-disagree"
  /** Only one provider answered at all, and it disagrees. Not corroborated. */
  | "one-provider"
  /** Neither provider resolved the address. Nothing was learned. */
  | "no-answer";

/**
 * @param threshold metres; below this, two points are "the same place". 500m is
 *   deliberately loose — a park entrance and a park centroid are both honest
 *   answers for the same address, and neither is an error worth chasing.
 */
export function judgeCoordinate(
  ours: Point,
  osm: Hit,
  tiger: Hit,
  threshold: number,
): CoordVerdict {
  const from = (h: Hit) => (h ? distanceMeters(ours.lat, ours.lng, h.lat, h.lng) : null);
  const dOsm = from(osm);
  const dTiger = from(tiger);

  if (dOsm === null && dTiger === null) return "no-answer";

  const far = (x: number | null) => x !== null && x >= threshold;
  const near = (x: number | null) => x !== null && x < threshold;

  // Either provider landing on us is an acquittal: our point matches the
  // address on at least one independent map, so the other provider is the one
  // that wandered off. This is what keeps the noise out.
  if (near(dOsm) || near(dTiger)) return "agreed";

  if (far(dOsm) && far(dTiger)) {
    const between = distanceMeters(osm!.lat, osm!.lng, tiger!.lat, tiger!.lng);
    return between < threshold ? "confirmed" : "providers-disagree";
  }

  return "one-provider";
}

/** Only a street address can settle a coordinate. "Northview Park, South St.
 *  Paul" is a name, and geocoding it returns the park centroid — which would
 *  produce noise, not findings. */
export function looksLikeStreetAddress(a: string): boolean {
  return /\d/.test(a) && a.trim().length > 8;
}

/** The point a confirmed finding suggests: midway between two providers that
 *  already agree, so neither one's rooftop-vs-parcel bias wins outright.
 *  Returns null unless both are present — a suggestion needs corroboration
 *  exactly as much as the finding did. */
export function consensusPoint(osm: Hit, tiger: Hit): Point | null {
  if (!osm || !tiger) return null;
  return { lat: (osm.lat + tiger.lat) / 2, lng: (osm.lng + tiger.lng) / 2 };
}
