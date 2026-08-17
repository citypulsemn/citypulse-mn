import { describe, it, expect } from "vitest";
import { placesToGeoJSON, placeSeasonShort, placesBounds } from "../places-map";
import type { Place } from "../places";

function place(overrides: Partial<Place> = {}): Place {
  return {
    slug: "lake-harriet-beach",
    name: "Lake Harriet Beach",
    kind: "beach",
    lat: 44.92,
    lng: -93.31,
    address: "4740 Harriet Pkwy",
    city: "Minneapolis",
    neighborhood: "southwest-lakes",
    season: { type: "seasonal", openMonth: 5, closeMonth: 9, label: "Memorial Day–Labor Day" },
    cost: "free",
    tags: ["lifeguards"],
    intro: "A city lake beach.",
    sourceUrl: "https://www.minneapolisparks.org/",
    verifiedAt: "2026-08-07",
    venueSlug: null,
    ...overrides,
  };
}

describe("placeSeasonShort", () => {
  it("returns the season label for a seasonal place", () => {
    expect(placeSeasonShort({ type: "seasonal", openMonth: 6, closeMonth: 8, label: "Summer" })).toBe("Summer");
  });
  it("returns Year-round for a year-round place", () => {
    expect(placeSeasonShort({ type: "year-round" })).toBe("Year-round");
  });
});

describe("placesToGeoJSON", () => {
  it("wraps places in a FeatureCollection", () => {
    const fc = placesToGeoJSON([place()]);
    expect(fc.type).toBe("FeatureCollection");
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0].type).toBe("Feature");
    expect(fc.features[0].geometry.type).toBe("Point");
  });

  it("emits coordinates in [lng, lat] order (the GeoJSON footgun)", () => {
    const fc = placesToGeoJSON([place({ lat: 44.92, lng: -93.31 })]);
    expect(fc.features[0].geometry.coordinates).toEqual([-93.31, 44.92]);
  });

  it("maps popup properties: human cost + short season", () => {
    const fc = placesToGeoJSON([place({ cost: "paid", season: { type: "year-round" } })]);
    const props = fc.features[0].properties;
    expect(props.cost).toBe("Paid");
    expect(props.season).toBe("Year-round");
    expect(props.slug).toBe("lake-harriet-beach");
    expect(props.name).toBe("Lake Harriet Beach");
    expect(props.city).toBe("Minneapolis");
    expect(props.kind).toBe("beach");
  });

  it("drops entries with non-finite coordinates (not silently placed at 0,0)", () => {
    const fc = placesToGeoJSON([
      place({ slug: "ok" }),
      place({ slug: "bad-lat", lat: NaN }),
      place({ slug: "bad-lng", lng: Infinity }),
    ]);
    expect(fc.features.map((f) => f.properties.slug)).toEqual(["ok"]);
  });

  it("preserves input order and count for a clean set", () => {
    const fc = placesToGeoJSON([place({ slug: "a" }), place({ slug: "b" }), place({ slug: "c" })]);
    expect(fc.features.map((f) => f.properties.slug)).toEqual(["a", "b", "c"]);
  });
});

describe("placesBounds — refit box when filters change (map reacts)", () => {
  it("returns [[minLng,minLat],[maxLng,maxLat]] over the set", () => {
    const b = placesBounds([
      place({ lat: 44.9, lng: -93.3 }),
      place({ lat: 45.1, lng: -93.1 }),
      place({ lat: 44.8, lng: -93.4 }),
    ]);
    expect(b).toEqual([
      [-93.4, 44.8],
      [-93.1, 45.1],
    ]);
  });

  it("a single place gives a zero-area box (fitBounds centers on it)", () => {
    expect(placesBounds([place({ lat: 44.92, lng: -93.31 })])).toEqual([
      [-93.31, 44.92],
      [-93.31, 44.92],
    ]);
  });

  it("ignores non-finite coords, matching placesToGeoJSON", () => {
    const b = placesBounds([
      place({ lat: 44.9, lng: -93.3 }),
      place({ lat: NaN, lng: -93.0 }),
      place({ lat: 45.0, lng: Infinity }),
    ]);
    expect(b).toEqual([
      [-93.3, 44.9],
      [-93.3, 44.9],
    ]);
  });

  it("null on an empty / fully-uncoordinated set (caller keeps its viewport)", () => {
    expect(placesBounds([])).toBeNull();
    expect(placesBounds([place({ lat: NaN, lng: NaN })])).toBeNull();
  });
});
