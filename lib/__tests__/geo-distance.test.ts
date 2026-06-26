import { describe, it, expect } from "vitest";
import { distanceMeters, NEAR_DUP_METERS } from "../geo-distance";

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
