import { describe, it, expect } from "vitest";
import {
  normalizeVenueName,
  slugifyVenue,
  VENUE_PAGES,
  venuePageBySlug,
  matchVenueSlug,
  dominantCoords,
  dominantAddress,
  staticMapUrl,
} from "../venue-pages";
import { VENUES } from "../venues";

describe("normalizeVenueName / slugifyVenue", () => {
  it("meets in the middle: articles, ampersands, punctuation, parentheticals", () => {
    expect(normalizeVenueName("The Hook & Ladder Theater")).toBe("hook and ladder theater");
    expect(normalizeVenueName("Hook and Ladder Theater")).toBe("hook and ladder theater");
    expect(normalizeVenueName("Hennepin County Library (system-wide events)")).toBe("hennepin county library");
    expect(normalizeVenueName("Minnesota Children's Museum")).toBe("minnesota children s museum");
    expect(slugifyVenue("Palace Theatre")).toBe("palace-theatre");
    expect(slugifyVenue("Como Park Zoo & Conservatory")).toBe("como-park-zoo-and-conservatory");
  });
});

describe("VENUE_PAGES — the registry surface", () => {
  it("every 4.2 registry venue gets exactly one page with a unique slug", () => {
    expect(VENUE_PAGES).toHaveLength(VENUES.length);
    const slugs = VENUE_PAGES.map((v) => v.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9-]+$/);
  });

  it("awkward names get curated slugs", () => {
    expect(venuePageBySlug("first-avenue")?.name).toBe("First Avenue & 7th St Entry");
    expect(venuePageBySlug("nickelodeon-universe")?.name).toContain("Nickelodeon");
    expect(venuePageBySlug("hennepin-county-library")).not.toBeNull();
  });
});

describe("matchVenueSlug — free-text event strings find their venue", () => {
  const CASES: [string, string | null][] = [
    // The mainroom/Entry family all resolve to the First Avenue page:
    ["First Avenue", "first-avenue"],
    ["First Ave", "first-avenue"],
    ["7th St Entry", "first-avenue"],
    ["First Avenue & 7th St Entry", "first-avenue"],
    // Article/spelling variants:
    ["The Cedar", "cedar-cultural-center"],
    ["Cedar Cultural Center", "cedar-cultural-center"],
    ["Varsity Theatre", "varsity-theater"],
    ["The Fillmore", "fillmore-minneapolis"],
    ["Turf Club", "turf-club"],
    ["Icehouse", "icehouse"],
    ["The Dakota", "dakota-jazz-club"],
    ["Como Zoo", "como-park-zoo-and-conservatory"],
    ["Xcel", "xcel-energy-center"],
    // Unknown rooms stay unmatched — no venue page claims them:
    ["Some Random Basement", null],
    ["", null],
  ];
  for (const [input, expected] of CASES) {
    it(`"${input}" → ${expected ?? "null"}`, () => {
      expect(matchVenueSlug(input)).toBe(expected);
    });
  }
});

describe("dominantCoords / dominantAddress — the mode is the building", () => {
  it("picks the most common pair; one bad geocode is outvoted", () => {
    const events = [
      { lat: 44.9784, lng: -93.2762 },
      { lat: 44.9784, lng: -93.2762 },
      { lat: 44.9784, lng: -93.2762 },
      { lat: 45.2, lng: -93.9 }, // the bad geocode
    ];
    expect(dominantCoords(events)).toEqual({ lat: 44.9784, lng: -93.2762 });
  });

  it("ignores 0,0 and non-finite; empty → null", () => {
    expect(dominantCoords([{ lat: 0, lng: 0 }, { lat: NaN, lng: -93 }])).toBeNull();
    expect(dominantCoords([])).toBeNull();
  });

  it("dominantAddress: most common non-empty string wins", () => {
    expect(
      dominantAddress([
        { address: "701 First Ave N" },
        { address: "701 First Ave N" },
        { address: "" },
        { address: "701 1st Ave N" },
      ]),
    ).toBe("701 First Ave N");
    expect(dominantAddress([{ address: "" }])).toBeNull();
  });

  it("staticMapUrl: pin at TRUE coords, map center nudged north to frame the pin body", () => {
    const url = staticMapUrl(44.9784, -93.2762, "pk.test");
    // The pin is anchored at the exact coordinates — never moved:
    expect(url).toContain("pin-l+c9a961(-93.2762,44.9784)");
    expect(url).toContain("access_token=pk.test");
    // The CENTER is slightly north (pins render upward from their tip);
    // at zoom 14 near 45°N the nudge is ~0.0008° (≈ 85 m ≈ 25 style px):
    const center = url.match(/\/(-93\.2762),([0-9.]+),14,0\//);
    expect(center).not.toBeNull();
    const centerLat = Number(center![2]);
    expect(centerLat).toBeGreaterThan(44.9784 + 0.0004);
    expect(centerLat).toBeLessThan(44.9784 + 0.0012);
  });
});
