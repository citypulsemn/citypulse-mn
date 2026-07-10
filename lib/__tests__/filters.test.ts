import { describe, it, expect } from "vitest";
import { areaOf, normalizeCity, AREAS } from "../areas";
import { applyPriceArea, matchesPrice, matchesArea, PRICE_TIERS } from "../filters";
import type { EventRecord, PriceTier } from "../types";
import type { AreaKey } from "../areas";

function ev(overrides: Partial<EventRecord> = {}): EventRecord {
  return {
    id: Math.random().toString(36).slice(2),
    title: "Event",
    category: "music",
    venue: "Venue",
    address: "1 Main St",
    city: "Minneapolis",
    lat: 44.9,
    lng: -93.2,
    start: "2026-07-15T20:00",
    end: "",
    price: "$25",
    priceTier: "$$",
    ticketUrl: "",
    description: "",
    image: "",
    sourceUrl: "",
    status: "published",
    ...overrides,
  };
}

describe("normalizeCity", () => {
  it("lowercases, folds saint→st, strips periods and state", () => {
    expect(normalizeCity("St. Paul, MN")).toBe("st paul");
    expect(normalizeCity("Saint Louis Park")).toBe("st louis park");
    expect(normalizeCity("  Minneapolis  ")).toBe("minneapolis");
  });
});

describe("areaOf", () => {
  it("maps the core cities", () => {
    expect(areaOf(ev({ city: "Minneapolis" }))).toBe("mpls");
    expect(areaOf(ev({ city: "St Paul" }))).toBe("stpaul");
    expect(areaOf(ev({ city: "Saint Paul" }))).toBe("stpaul");
  });
  it("maps suburbs to compass areas", () => {
    expect(areaOf(ev({ city: "Plymouth" }))).toBe("west");
    expect(areaOf(ev({ city: "Blaine" }))).toBe("north");
    expect(areaOf(ev({ city: "Bloomington" }))).toBe("south");
    expect(areaOf(ev({ city: "Woodbury" }))).toBe("east");
  });
  it("falls back to 'other' for unmapped cities", () => {
    expect(areaOf(ev({ city: "Duluth" }))).toBe("other");
    expect(areaOf(ev({ city: "" }))).toBe("other");
  });
  it("every mapped area key is a valid AREAS entry", () => {
    const keys = new Set(AREAS.map((a) => a.key));
    for (const city of ["Minneapolis", "St Paul", "Plymouth", "Blaine", "Eagan", "Woodbury"]) {
      expect(keys.has(areaOf(ev({ city })))).toBe(true);
    }
  });
});

describe("price/area predicates", () => {
  it("matchesPrice: empty set matches all", () => {
    expect(matchesPrice(ev({ priceTier: "$$" }), new Set())).toBe(true);
  });
  it("matchesPrice: filters by tier", () => {
    const free = new Set<PriceTier>(["Free"]);
    expect(matchesPrice(ev({ priceTier: "Free" }), free)).toBe(true);
    expect(matchesPrice(ev({ priceTier: "$$" }), free)).toBe(false);
  });
  it("matchesArea: filters by area", () => {
    const west = new Set<AreaKey>(["west"]);
    expect(matchesArea(ev({ city: "Plymouth" }), west)).toBe(true);
    expect(matchesArea(ev({ city: "Blaine" }), west)).toBe(false);
  });
  it("PRICE_TIERS covers the four buckets", () => {
    expect(PRICE_TIERS).toEqual(["Free", "$", "$$", "$$$"]);
  });
});

describe("applyPriceArea", () => {
  const list = [
    ev({ id: "a", priceTier: "Free", city: "Minneapolis" }),
    ev({ id: "b", priceTier: "$$", city: "Plymouth" }),
    ev({ id: "c", priceTier: "Free", city: "Blaine" }),
  ];

  it("no filters returns the same list", () => {
    expect(applyPriceArea(list, new Set(), new Set())).toHaveLength(3);
  });
  it("price only", () => {
    const out = applyPriceArea(list, new Set<PriceTier>(["Free"]), new Set());
    expect(out.map((e) => e.id).sort()).toEqual(["a", "c"]);
  });
  it("area only", () => {
    const out = applyPriceArea(list, new Set(), new Set<AreaKey>(["west"]));
    expect(out.map((e) => e.id)).toEqual(["b"]);
  });
  it("price AND area together", () => {
    const out = applyPriceArea(list, new Set<PriceTier>(["Free"]), new Set<AreaKey>(["north"]));
    expect(out.map((e) => e.id)).toEqual(["c"]);
  });
});
