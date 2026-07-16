import { describe, it, expect } from "vitest";
import { neighborhoodOf, distanceKm, eventNeighborhood, NEIGHBORHOODS } from "../neighborhoods";

/**
 * GOLDEN SET (roadmap 5.5): real Twin Cities venues at their real coordinates.
 * Every assignment below is one a local would sign off on — that's the bar for
 * the registry's centroids and radii. If a centroid gets tuned, these tests
 * are the guardrail.
 */
const VENUES: [string, number, number, string][] = [
  ["First Avenue", 44.9784, -93.2762, "downtown-minneapolis"],
  ["Orpheum Theatre", 44.9762, -93.2778, "downtown-minneapolis"],
  ["U.S. Bank Stadium", 44.9738, -93.2575, "downtown-minneapolis"],
  ["Guthrie Theater (Mill District)", 44.9781, -93.2555, "downtown-minneapolis"],
  ["Target Field", 44.9817, -93.2776, "north-loop"],
  ["331 Club", 45.0009, -93.2472, "northeast"],
  ["Bauhaus Brew Labs", 45.0038, -93.2669, "northeast"],
  ["Uptown Theatre (Hennepin & Lagoon)", 44.9490, -93.2985, "uptown"],
  ["Walker Art Center", 44.9683, -93.2891, "loring-park"],
  ["Icehouse", 44.9542, -93.2775, "whittier-eat-street"],
  ["Lake Harriet Bandshell", 44.9256, -93.3079, "southwest-lakes"],
  ["Minnehaha Falls", 44.9153, -93.2110, "minnehaha"],
  ["Palace Theatre", 44.9465, -93.0952, "downtown-st-paul"],
  ["Xcel Energy Center", 44.9447, -93.1013, "downtown-st-paul"],
  ["CHS Field (Lowertown)", 44.9505, -93.0846, "downtown-st-paul"],
  ["Turf Club", 44.9556, -93.1668, "midway-hamline"],
  ["Allianz Field", 44.9531, -93.1650, "midway-hamline"],
  ["Como Zoo", 44.9822, -93.1519, "como"],
];

describe("neighborhoodOf — the golden venues", () => {
  for (const [name, lat, lng, expected] of VENUES) {
    it(`${name} → ${expected}`, () => {
      expect(neighborhoodOf(lat, lng)?.key).toBe(expected);
    });
  }
});

describe("neighborhoodOf — boundaries and honesty", () => {
  it("suburbs resolve to null — their city name already says where they are", () => {
    expect(neighborhoodOf(44.9723, -93.0270)).toBeNull(); // Maplewood fairgrounds
    expect(neighborhoodOf(44.7974, -93.5270)).toBeNull(); // Shakopee
    expect(neighborhoodOf(45.0941, -93.3563)).toBeNull(); // Brooklyn Park
  });

  it("adjacent districts resolve to the NEAREST centroid (Downtown vs North Loop)", () => {
    // Target Field sits between the two; North Loop's centroid is closer.
    const d = distanceKm(44.9817, -93.2776, 44.977, -93.268, );
    const nl = distanceKm(44.9817, -93.2776, 44.9855, -93.2785);
    expect(nl).toBeLessThan(d);
    expect(neighborhoodOf(44.9817, -93.2776)?.key).toBe("north-loop");
  });

  it("garbage coordinates resolve to null, never throw", () => {
    expect(neighborhoodOf(NaN, -93.2)).toBeNull();
    expect(neighborhoodOf(0, 0)).toBeNull();
  });

  it("eventNeighborhood wraps it for the read path", () => {
    expect(eventNeighborhood({ lat: 44.9784, lng: -93.2762 })).toBe("downtown-minneapolis");
    expect(eventNeighborhood({ lat: 0, lng: 0 })).toBeNull();
  });
});

describe("registry hygiene", () => {
  it("keys are unique, slug-shaped, and labels/blurbs exist", () => {
    const keys = NEIGHBORHOODS.map((n) => n.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const n of NEIGHBORHOODS) {
      expect(n.key).toMatch(/^[a-z0-9-]+$/);
      expect(n.label.length).toBeGreaterThan(2);
      expect(n.blurb.length).toBeGreaterThan(10);
      expect(n.radiusKm).toBeGreaterThan(0.3);
      expect(n.radiusKm).toBeLessThan(4);
    }
  });

  it("distanceKm sanity: Minneapolis to St. Paul downtown ≈ 14–16 km", () => {
    const d = distanceKm(44.977, -93.268, 44.947, -93.091);
    expect(d).toBeGreaterThan(13);
    expect(d).toBeLessThan(17);
  });
});
