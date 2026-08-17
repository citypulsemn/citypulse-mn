import { describe, it, expect } from "vitest";
import {
  placeSchemaType,
  placeAmenityFeatures,
  placeJsonLd,
  placeDetailJsonLd,
  placesItemListJsonLd,
  placesFactSummary,
} from "../seo/places-jsonld";
import { jsonLdSafe } from "../seo/event-jsonld";
import { placesByKind, PLACES, type Place } from "../places";

const OPTS = { baseUrl: "https://citypulsemn.com" };
const synthetic = (overrides: Partial<Place>): Place => ({ ...PLACES[0], ...overrides });

describe("placeSchemaType", () => {
  it("maps kinds to valid schema.org types, TouristAttraction as the safe default", () => {
    expect(placeSchemaType("museum")).toBe("Museum");
    expect(placeSchemaType("pool")).toBe("SportsActivityLocation");
    expect(placeSchemaType("rink")).toBe("SportsActivityLocation");
    expect(placeSchemaType("park")).toBe("Park");
    expect(placeSchemaType("splash-pad")).toBe("TouristAttraction"); // fallback
  });
});

describe("placeAmenityFeatures — verified facts → LocationFeatureSpecification", () => {
  it("emits only true details, in label order, with the render label", () => {
    // A pool with indoor + waterSlide + zeroDepth.
    const pool = placesByKind("pool").find((p) => p.slug === "chaska-community-center-pool")!;
    const feats = placeAmenityFeatures(pool);
    expect(feats).toEqual([
      { "@type": "LocationFeatureSpecification", name: "Indoor", value: true },
      { "@type": "LocationFeatureSpecification", name: "Water slide", value: true },
      { "@type": "LocationFeatureSpecification", name: "Zero-depth entry", value: true },
    ]);
  });

  it("a place with no details emits no features (honest — never an empty promise)", () => {
    expect(placeAmenityFeatures(synthetic({ details: undefined }))).toEqual([]);
  });

  it("never emits a false/absent detail", () => {
    const p = synthetic({ details: { indoor: true, waterSlide: false } });
    const names = placeAmenityFeatures(p).map((f) => f.name);
    expect(names).toEqual(["Indoor"]); // waterSlide:false is dropped
  });
});

describe("placeJsonLd", () => {
  const pool = placesByKind("pool").find((p) => p.slug === "chaska-community-center-pool")!;
  const obj = placeJsonLd(pool, "pool", OPTS);

  it("carries type, name, deep-link url, address, geo, and amenityFeature", () => {
    expect(obj["@type"]).toBe("SportsActivityLocation");
    expect(obj.name).toBe(pool.name);
    expect(obj.url).toBe(`https://citypulsemn.com/places/pool#${pool.slug}`);
    const addr = obj.address as Record<string, unknown>;
    expect(addr["@type"]).toBe("PostalAddress");
    expect(addr.addressRegion).toBe("MN");
    const geo = obj.geo as Record<string, unknown>;
    expect(geo["@type"]).toBe("GeoCoordinates");
    expect(geo.latitude).toBe(pool.lat);
    expect(Array.isArray(obj.amenityFeature)).toBe(true);
  });

  it("cost → isAccessibleForFree (free true, paid false, donation omitted)", () => {
    expect(placeJsonLd(synthetic({ cost: "free" }), "beach", OPTS).isAccessibleForFree).toBe(true);
    expect(placeJsonLd(synthetic({ cost: "paid" }), "museum", OPTS).isAccessibleForFree).toBe(false);
    expect(placeJsonLd(synthetic({ cost: "donation" }), "museum", OPTS)).not.toHaveProperty(
      "isAccessibleForFree",
    );
  });

  it("omits geo for a place at 0,0 (never a fabricated Null-Island pin)", () => {
    expect(placeJsonLd(synthetic({ lat: 0, lng: 0 }), "park", OPTS)).not.toHaveProperty("geo");
  });
});

describe("placesItemListJsonLd", () => {
  it("wraps the kind's places in a positioned ItemList of full Place objects", () => {
    const rinks = placesByKind("rink");
    const list = placesItemListJsonLd(rinks, "rink", OPTS);
    expect(list["@type"]).toBe("ItemList");
    const items = list.itemListElement as Record<string, unknown>[];
    expect(items.length).toBe(rinks.length);
    expect(items[0].position).toBe(1);
    expect((items[0].item as Record<string, unknown>)["@type"]).toBe("SportsActivityLocation");
  });

  it("survives jsonLdSafe with a script-breakout name (R0.6 — no raw </script>)", () => {
    const evil = synthetic({ slug: "x", name: "Pool </script><img src=x onerror=alert(1)>" });
    const html = jsonLdSafe(placesItemListJsonLd([evil], "pool", OPTS));
    expect(html).not.toContain("</script>");
    expect(html).toContain("\\u003c"); // the < is escaped
  });
});

describe("placeDetailJsonLd — the standalone per-place page object", () => {
  const pool = placesByKind("pool").find((p) => p.slug === "chaska-community-center-pool")!;
  const obj = placeDetailJsonLd(pool, "pool", OPTS);

  it("stands alone with @context, description, and the amenity features", () => {
    expect(obj["@context"]).toBe("https://schema.org");
    expect(obj["@type"]).toBe("SportsActivityLocation");
    expect(obj.description).toBe(pool.intro);
    expect(Array.isArray(obj.amenityFeature)).toBe(true);
    expect(obj.url).toBe(`https://citypulsemn.com/places/pool#${pool.slug}`);
  });

  it("survives jsonLdSafe (R0.6 breakout guard on the standalone object too)", () => {
    const evil = synthetic({ slug: "x", name: "X </script><script>", intro: "hi" });
    const html = jsonLdSafe(placeDetailJsonLd(evil, "pool", OPTS));
    expect(html).not.toContain("</script>");
  });
});

describe("placesFactSummary — honest, keyword-rich meta clause", () => {
  it("lists the verified filterable facts in label order, grammatically", () => {
    expect(placesFactSummary(placesByKind("pool"))).toBe("indoor, water slide, and zero-depth entry");
  });

  it("null for a kind with no verified details (description omits the clause)", () => {
    expect(placesFactSummary(placesByKind("beach"))).toBeNull();
  });

  it("handles one and two facts without a trailing comma", () => {
    const one = synthetic({ details: { indoor: true } });
    expect(placesFactSummary([one])).toBe("indoor");
    const two = synthetic({ details: { fenced: true, smallDogArea: true } });
    expect(placesFactSummary([two])).toBe("fenced and small-dog area");
  });
});
