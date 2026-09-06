import { describe, it, expect } from "vitest";
import {
  judgeCoordinate,
  looksLikeStreetAddress,
  consensusPoint,
  type Point,
  type Hit,
} from "../coord-audit";

const ARNESON: Point = { lat: 44.87627, lng: -93.34352 };
/** ~1.6km west of Arneson — far enough to fail a 500m threshold. */
const WEST: Point = { lat: 44.87627, lng: -93.36352 };
/** ~1.6km east. Same distance from Arneson as WEST, opposite direction, so a
 *  provider pair of WEST + EAST disagrees with us *and* with itself. */
const EAST: Point = { lat: 44.87627, lng: -93.32352 };
/** ~100m from Arneson: the entrance-versus-centroid case. */
const NEXT_DOOR: Point = { lat: 44.8772, lng: -93.34352 };

describe("judgeCoordinate", () => {
  it("acquits when both providers land on us", () => {
    expect(judgeCoordinate(ARNESON, ARNESON, NEXT_DOOR, 500)).toBe("agreed");
  });

  it("acquits when only ONE provider lands on us", () => {
    // This is the whole point of the two-provider design. Nominatim put
    // 2540 Nicollet Ave S five miles south of itself while Census put it on the
    // building. One good match is enough to clear a coordinate.
    expect(judgeCoordinate(ARNESON, WEST, ARNESON, 500)).toBe("agreed");
    expect(judgeCoordinate(ARNESON, ARNESON, WEST, 500)).toBe("agreed");
  });

  it("confirms only when both providers are far from us AND near each other", () => {
    const alsoWest: Point = { lat: 44.8767, lng: -93.36352 };
    expect(judgeCoordinate(ARNESON, WEST, alsoWest, 500)).toBe("confirmed");
  });

  it("refuses to confirm when the two providers point opposite ways", () => {
    expect(judgeCoordinate(ARNESON, WEST, EAST, 500)).toBe("providers-disagree");
  });

  it("refuses to confirm on a single provider's word", () => {
    expect(judgeCoordinate(ARNESON, WEST, null, 500)).toBe("one-provider");
    expect(judgeCoordinate(ARNESON, null, WEST, 500)).toBe("one-provider");
  });

  it("reports no-answer when neither provider resolved the address", () => {
    // 367 of 567 addresses did this on the first run. Silence is not agreement.
    expect(judgeCoordinate(ARNESON, null, null, 500)).toBe("no-answer");
  });

  it("never returns confirmed without both providers present", () => {
    const cases: [Hit, Hit][] = [
      [null, null],
      [WEST, null],
      [null, WEST],
    ];
    for (const [a, b] of cases) {
      expect(judgeCoordinate(ARNESON, a, b, 500)).not.toBe("confirmed");
    }
  });

  it("treats the threshold as exclusive-below: exactly at it is still far", () => {
    // One degree of latitude is 111_195m under the R=6_371_000 sphere that
    // distanceMeters uses. Don't reach for 111_320 (the WGS84 figure) — it
    // lands 0.8m short of the threshold and quietly tests nothing.
    const M = 1 / 111_195;
    const halfKmNorth: Point = { lat: ARNESON.lat + 501 * M, lng: ARNESON.lng };
    expect(judgeCoordinate(ARNESON, halfKmNorth, halfKmNorth, 500)).toBe("confirmed");
    // …and just inside it is an acquittal.
    const justInside: Point = { lat: ARNESON.lat + 498 * M, lng: ARNESON.lng };
    expect(judgeCoordinate(ARNESON, justInside, WEST, 500)).toBe("agreed");
  });

  it("widening the threshold turns findings into acquittals, not the reverse", () => {
    const alsoWest: Point = { lat: 44.8767, lng: -93.36352 };
    expect(judgeCoordinate(ARNESON, WEST, alsoWest, 500)).toBe("confirmed");
    expect(judgeCoordinate(ARNESON, WEST, alsoWest, 5000)).toBe("agreed");
  });
});

describe("looksLikeStreetAddress", () => {
  it("accepts a real street address", () => {
    expect(looksLikeStreetAddress("4711 W 70th St, Edina, MN 55424")).toBe(true);
  });

  it("rejects a park name with no number", () => {
    expect(looksLikeStreetAddress("Northview Park, South St. Paul")).toBe(false);
  });

  it("rejects something too short to be an address", () => {
    expect(looksLikeStreetAddress("Lot 3")).toBe(false);
    expect(looksLikeStreetAddress("")).toBe(false);
  });
});

describe("consensusPoint", () => {
  it("returns the midpoint of two providers", () => {
    const mid = consensusPoint({ lat: 44.0, lng: -93.0 }, { lat: 44.2, lng: -93.4 });
    expect(mid).toEqual({ lat: 44.1, lng: -93.2 });
  });

  it("suggests nothing without corroboration", () => {
    expect(consensusPoint({ lat: 44, lng: -93 }, null)).toBeNull();
    expect(consensusPoint(null, { lat: 44, lng: -93 })).toBeNull();
    expect(consensusPoint(null, null)).toBeNull();
  });
});
