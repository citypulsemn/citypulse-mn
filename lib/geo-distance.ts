/**
 * Great-circle distance in meters between two lat/lng points (Haversine).
 * Mirrors the formula used in dedupeNearDuplicates() so the proximity rule is
 * the same in code and in SQL.
 */
export function distanceMeters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6_371_000; // Earth radius, meters
  const toRad = (d: number) => (d * Math.PI) / 180;
  const x =
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.cos(toRad(bLng) - toRad(aLng)) +
    Math.sin(toRad(aLat)) * Math.sin(toRad(bLat));
  return R * Math.acos(Math.max(-1, Math.min(1, x)));
}

/** Distance threshold (meters) under which two same-day events are "co-located". */
export const NEAR_DUP_METERS = 250;
/** Title trigram similarity above which two co-located same-day events merge. */
export const NEAR_DUP_TITLE_SIM = 0.6;
