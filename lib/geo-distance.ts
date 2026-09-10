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
/** Venue WORD similarity above which two same-day, same-title events are the
 *  same event REGARDLESS of distance. Word similarity, not plain trigram: venue
 *  names differ by containment far more often than by typo. See isNearDuplicate. */
export const NEAR_DUP_VENUE_SIM = 0.6;

/**
 * Are these two same-day events the same event?
 *
 * `computeEventKey` already defines identity as title + venue + day. This pass
 * exists for the case where those STRINGS differ slightly, and it used to
 * arbitrate purely on distance — which quietly made agent-supplied coordinates
 * the arbiter of identity. They are not reliable enough for that job: on
 * 10 Sep 2026 the live calendar held four same-day pairs with an IDENTICAL
 * venue name whose coordinates were 3.6km, 6.9km, 21km and 122km apart. All
 * four survived as duplicates because the 250m gate believed the coordinates
 * over the venue name.
 *
 * So: matching venue names settle it on their own, and distance only arbitrates
 * when the names genuinely differ.
 *
 * Mirrors the SQL in dedupeNearDuplicates() — change both together.
 */
export function isNearDuplicate(args: {
  titleSim: number;
  /** max(word_similarity(a,b), word_similarity(b,a)) — the SQL takes the
   *  better direction because word_similarity is asymmetric. */
  venueSim: number;
  metres: number;
}): boolean {
  if (args.titleSim <= NEAR_DUP_TITLE_SIM) return false;
  return args.venueSim > NEAR_DUP_VENUE_SIM || args.metres < NEAR_DUP_METERS;
}
