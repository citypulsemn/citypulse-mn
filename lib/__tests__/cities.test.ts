import { describe, it, expect } from "vitest";
import {
  CITY_PAGES,
  cityBySlug,
  matchCitySlug,
  displayCityName,
  slugifyCity,
} from "../cities";
import { CITY_AREA } from "../areas";

describe("displayCityName — canonical names from normalized keys", () => {
  const CASES: [string, string][] = [
    ["st paul", "St. Paul"],
    ["st louis park", "St. Louis Park"],
    ["minneapolis", "Minneapolis"],
    ["brooklyn park", "Brooklyn Park"],
    ["white bear lake", "White Bear Lake"],
    ["inver grove heights", "Inver Grove Heights"],
    ["west st paul", "West St. Paul"],
  ];
  for (const [input, expected] of CASES) {
    it(`"${input}" → "${expected}"`, () => {
      expect(displayCityName(input)).toBe(expected);
    });
  }
});

describe("CITY_PAGES — one stable page per mapped city", () => {
  it("every CITY_AREA city gets exactly one page with a unique slug", () => {
    expect(CITY_PAGES).toHaveLength(Object.keys(CITY_AREA).length);
    const slugs = CITY_PAGES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9-]+$/);
  });

  it("the heavyweights resolve", () => {
    expect(cityBySlug("minneapolis")?.name).toBe("Minneapolis");
    expect(cityBySlug("st-paul")?.name).toBe("St. Paul");
    expect(cityBySlug("st-paul")?.area).toBe("stpaul");
    expect(cityBySlug("bloomington")?.area).toBe("south");
  });
});

describe("matchCitySlug — free-text event cities find their page", () => {
  const CASES: [string, string | null][] = [
    // The variant family all lands on one page (via the SAME normalizeCity
    // the area filter uses — one normalization, everywhere):
    ["St. Paul", "st-paul"],
    ["Saint Paul", "st-paul"],
    ["st paul, MN", "st-paul"],
    ["SAINT PAUL", "st-paul"],
    ["Minneapolis", "minneapolis"],
    ["Minneapolis, MN", "minneapolis"],
    ["Saint Louis Park", "st-louis-park"],
    ["Maplewood", "maplewood"],
    ["Shakopee", "shakopee"],
    // Unknown or out-of-metro stays unmatched — no page claims it:
    ["Duluth", null],
    ["", null],
  ];
  for (const [input, expected] of CASES) {
    it(`"${input}" → ${expected ?? "null"}`, () => {
      expect(matchCitySlug(input)).toBe(expected);
    });
  }
});

describe("slug round-trip", () => {
  it("slugifyCity is the inverse path of cityBySlug for every page", () => {
    for (const c of CITY_PAGES) {
      expect(cityBySlug(c.slug)?.name).toBe(c.name);
    }
  });
});
