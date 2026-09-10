import { describe, it, expect } from "vitest";
import {
  distanceMeters,
  isNearDuplicate,
  NEAR_DUP_METERS,
  NEAR_DUP_TITLE_SIM,
  NEAR_DUP_VENUE_SIM,
} from "../geo-distance";

describe("distanceMeters", () => {
  it("is zero for the same point", () => {
    expect(distanceMeters(44.95, -93.2, 44.95, -93.2)).toBeCloseTo(0, 5);
  });

  it("~111m for 0.001° of latitude", () => {
    const d = distanceMeters(44.95, -93.2, 44.951, -93.2);
    expect(d).toBeGreaterThan(105);
    expect(d).toBeLessThan(118);
  });

  it("treats two spellings of the same park as co-located (< threshold)", () => {
    // McMurray Fields / Como Park geocodes land within a few dozen meters.
    const d = distanceMeters(44.9803, -93.1466, 44.9809, -93.1471);
    expect(d).toBeLessThan(NEAR_DUP_METERS);
  });

  it("keeps Minneapolis and St Paul downtowns far apart (well over threshold)", () => {
    const d = distanceMeters(44.9778, -93.265, 44.9537, -93.09);
    expect(d).toBeGreaterThan(10_000);
  });
});

describe("isNearDuplicate — venue name beats distance (Sep 2026)", () => {
  it("merges an identical venue name however far apart the coordinates claim to be", () => {
    // All four were live on 10 Sep 2026 with the SAME venue name: Varsity
    // Theater 3.6km, Mystic Lake 6.9km, Renaissance Fest 21km, and Downtown
    // Anoka 122km apart. The old distance-only gate kept every one of them.
    for (const metres of [3593, 6949, 21187, 122352]) {
      expect(isNearDuplicate({ titleSim: 1, venueSim: 1, metres })).toBe(true);
    }
  });

  it("still merges co-located events whose venue names differ", () => {
    // "Minnehaha Park" vs "Minnehaha Regional Park" — 0m apart, venueSim 0.63.
    expect(isNearDuplicate({ titleSim: 1, venueSim: 0.2, metres: 0 })).toBe(true);
  });

  it("keeps two different venues that merely share a title", () => {
    // Same title, different place, far apart — a real pair of distinct events.
    expect(isNearDuplicate({ titleSim: 1, venueSim: 0.1, metres: 5000 })).toBe(false);
  });

  it("never merges on venue alone when the titles differ", () => {
    // Two different shows at one theatre on one night must both survive.
    expect(isNearDuplicate({ titleSim: 0.2, venueSim: 1, metres: 0 })).toBe(false);
  });

  it("treats the thresholds as exclusive, matching the SQL's > and <", () => {
    expect(isNearDuplicate({ titleSim: NEAR_DUP_TITLE_SIM, venueSim: 1, metres: 0 })).toBe(false);
    expect(isNearDuplicate({ titleSim: 1, venueSim: NEAR_DUP_VENUE_SIM, metres: NEAR_DUP_METERS })).toBe(false);
    expect(isNearDuplicate({ titleSim: 1, venueSim: NEAR_DUP_VENUE_SIM, metres: NEAR_DUP_METERS - 1 })).toBe(true);
  });

  it("a placeholder venue never matches a real one — those need a human", () => {
    // "TBD" vs "Pilot Knob / Oheyawahe" is venueSim 0, and the coordinate for a
    // placeholder is a city centroid, so neither test fires. Deliberate: the
    // survivorship rule keeps the EARLIEST row, which for a placeholder pair is
    // the one carrying no venue at all.
    expect(isNearDuplicate({ titleSim: 1, venueSim: 0, metres: 793 })).toBe(false);
  });
});
