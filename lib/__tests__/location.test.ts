import { describe, it, expect } from "vitest";
import { cityLocations, filterByDistance, DEFAULT_RADIUS_MI, RADIUS_OPTIONS_MI } from "../location";
import type { EventRecord } from "../types";

function ev(o: Partial<EventRecord> & { city: string; lat: number; lng: number }): EventRecord {
  return {
    id: `${o.city}-${o.lat}-${o.lng}`,
    title: "E",
    category: "music",
    venue: "V",
    address: "",
    start: "2026-07-20T19:00",
    end: "2026-07-20T21:00",
    price: "Free",
    priceTier: "Free",
    ticketUrl: "",
    description: "",
    image: "",
    sourceUrl: "",
    status: "published",
    ...o,
  };
}

describe("cityLocations", () => {
  it("groups events by city and returns each city's centroid (mean of its coords)", () => {
    const locs = cityLocations([
      ev({ city: "Minneapolis", lat: 44.98, lng: -93.27 }),
      ev({ city: "Minneapolis", lat: 44.96, lng: -93.25 }),
      ev({ city: "St. Paul", lat: 44.95, lng: -93.09 }),
    ]);
    const mpls = locs.find((l) => l.key === "minneapolis")!;
    expect(mpls.count).toBe(2);
    expect(mpls.lat).toBeCloseTo(44.97, 5);
    expect(mpls.lng).toBeCloseTo(-93.26, 5);
    expect(mpls.label).toBe("Minneapolis");
  });

  it("normalizes city variants to one group (Saint Paul / St. Paul / St Paul, MN)", () => {
    const locs = cityLocations([
      ev({ city: "Saint Paul", lat: 44.95, lng: -93.09 }),
      ev({ city: "St. Paul", lat: 44.95, lng: -93.10 }),
      ev({ city: "St Paul, MN", lat: 44.95, lng: -93.11 }),
    ]);
    const stp = locs.filter((l) => l.key === "st paul");
    expect(stp).toHaveLength(1);
    expect(stp[0].count).toBe(3);
    expect(stp[0].label).toBe("St. Paul");
  });

  it("sorts busiest cities first, then alphabetical", () => {
    const locs = cityLocations([
      ev({ city: "Edina", lat: 44.9, lng: -93.35 }),
      ev({ city: "Minneapolis", lat: 44.98, lng: -93.27 }),
      ev({ city: "Minneapolis", lat: 44.96, lng: -93.25 }),
    ]);
    expect(locs.map((l) => l.key)).toEqual(["minneapolis", "edina"]);
  });

  it("returns empty for no events", () => {
    expect(cityLocations([])).toEqual([]);
  });
});

describe("filterByDistance", () => {
  const downtown = { lat: 44.9778, lng: -93.265 };

  it("keeps points within the radius and drops points beyond it", () => {
    const near = { lat: 44.99, lng: -93.27 }; // ~1 mile
    const far = { lat: 45.5, lng: -94.0 }; // tens of miles NW
    const out = filterByDistance([near, far], downtown, 25);
    expect(out).toContain(near);
    expect(out).not.toContain(far);
  });

  it("keeps the exact center point at any radius", () => {
    expect(filterByDistance([downtown], downtown, 5)).toHaveLength(1);
  });

  it("a tighter radius drops a point a larger radius keeps", () => {
    const suburb = { lat: 44.73, lng: -93.29 }; // Burnsville-ish, ~18 mi south
    expect(filterByDistance([suburb], downtown, 25)).toHaveLength(1);
    expect(filterByDistance([suburb], downtown, 5)).toHaveLength(0);
  });

  it("returns empty for empty input", () => {
    expect(filterByDistance([], downtown, 25)).toEqual([]);
  });
});

describe("radius config", () => {
  it("the default radius is one of the options", () => {
    expect(RADIUS_OPTIONS_MI).toContain(DEFAULT_RADIUS_MI);
  });
});
