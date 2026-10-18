import { describe, it, expect } from "vitest";
import {
  agreeingPin,
  groupByRoom,
  distinctPins,
  pinSpreadMetres,
  roomDisagrees,
  usableAddresses,
  AGREE_METRES,
  DISAGREE_METRES,
  type Hit,
} from "../venue-pins";

const hit = (provider: string, query: string, lat: number, lng: number): Hit => ({ provider, query, lat, lng });

describe("agreeingPin", () => {
  it("accepts two DIFFERENT providers landing close together", () => {
    // Dead End Hayride, from the address on the attraction's own site: 3m apart.
    const got = agreeingPin([
      hit("nominatim", "28186 Kettle River Blvd N", 45.3556802, -92.9990243),
      hit("census", "28186 Kettle River Blvd N", 45.355659313697, -92.998993765007),
    ]);
    expect(got).not.toBeNull();
    expect(got!.metres).toBeLessThanOrEqual(5);
    expect(got!.lat).toBe(45.3556802);
  });

  it("REFUSES two answers from the same provider, however close", () => {
    // The rule is "one geocoder is a question, two agreeing is a finding" — and
    // two queries to one geocoder is still one geocoder. These are byte-identical
    // and must still not count.
    expect(
      agreeingPin([
        hit("nominatim", "Varsity Theater, Minneapolis, MN", 44.9806127, -93.2368957),
        hit("nominatim", "1308 SE 4th Street, Minneapolis, MN", 44.9806127, -93.2368957),
      ]),
    ).toBeNull();
  });

  it("returns null when nothing agrees, rather than picking one", () => {
    // Downtown Anoka: nominatim sends its Main Street to Lino Lakes while census
    // resolves real Anoka intersections ~20km away. Four listings, no answer.
    expect(
      agreeingPin([
        hit("nominatim", "Main Street & 1st Avenue", 45.1966449, -93.1042389),
        hit("census", "Main Street & 1st Avenue", 45.19799401506, -93.39002697987),
      ]),
    ).toBeNull();
  });

  it("takes the tightest cross-provider pair when several agree", () => {
    const got = agreeingPin([
      hit("nominatim", "loose", 44.95, -93.1),
      hit("census", "loose", 44.9512, -93.1), // ~133m
      hit("nominatim", "tight", 44.97, -93.2),
      hit("census", "tight", 44.970027, -93.2), // ~3m
    ]);
    expect(got!.by).toContain("tight");
    expect(got!.by).not.toContain("loose");
    expect(got!.metres).toBeLessThan(10);
  });

  it("is lenient enough for a stadium and strict enough to reject a street centroid", () => {
    // Allianz Field's two sources sat 207m apart, both plainly meaning the
    // stadium — a tighter bar would reject every large venue.
    expect(
      agreeingPin([
        hit("nominatim", "Allianz Field, Saint Paul, MN", 44.953139, -93.1646871),
        hit("census", "400 Snelling Ave N, Saint Paul, MN", 44.952142701722, -93.166908191738),
      ]),
    ).not.toBeNull();
    // The actual bad pin: "W Kellogg Blvd" resolved to a street centroid 1.67km
    // from the arena, and was shared with the Science Museum.
    expect(
      agreeingPin([
        hit("nominatim", "Grand Casino Arena, Saint Paul, MN", 44.9447277, -93.1010971),
        hit("census", "199 W Kellogg Blvd", 44.932149, -93.112696),
      ]),
    ).toBeNull();
  });

  it("honours a caller-supplied tolerance", () => {
    const pair = [hit("a", "q", 44.95, -93.1), hit("b", "q", 44.9536, -93.1)]; // ~400m
    expect(agreeingPin(pair)).toBeNull();
    expect(agreeingPin(pair, 500)).not.toBeNull();
  });

  it("has thresholds that leave room between agreeing and disagreeing", () => {
    // A pin can be confirmed at up to AGREE_METRES and a room is only flagged
    // above DISAGREE_METRES; if these crossed, a freshly-settled room would
    // immediately re-flag itself.
    expect(AGREE_METRES).toBeLessThan(DISAGREE_METRES);
  });
});

describe("spotting a room that needs fixing", () => {
  it("folds venue aliases into one room", () => {
    // Exactly the rows that existed: three spellings of two rooms.
    const rows = [
      { venue: "Varsity Theater" },
      { venue: "Varsity Theater (Minneapolis)" },
      { venue: "Green Room" },
      { venue: "Green Room (Minneapolis)" },
    ];
    const grouped = groupByRoom(rows);
    expect(grouped.size).toBe(2);
    expect(grouped.get("varsity theater")).toHaveLength(2);
  });

  it("counts distinct pins commonest first and ignores rows without one", () => {
    const pins = distinctPins([
      { lat: 44.944728, lng: -93.101097 },
      { lat: 44.932149, lng: -93.112696 },
      { lat: 44.932149, lng: -93.112696 },
      { lat: null, lng: null },
      { lat: 44.932149, lng: null },
    ]);
    expect(pins).toHaveLength(2);
    expect(pins[0]).toEqual({ lat: 44.932149, lng: -93.112696, count: 2 });
  });

  it("measures the widest gap, not the first", () => {
    // Grand Casino Arena's three real pins: the outlier is 1.67km out.
    const spread = pinSpreadMetres([
      { lat: 44.944728, lng: -93.101097, count: 15 },
      { lat: 44.932149, lng: -93.112696, count: 18 },
      { lat: 44.944415, lng: -93.100951, count: 3 },
    ]);
    expect(spread).toBeGreaterThan(1600);
    expect(spread).toBeLessThan(1750);
  });

  it("does not flag one pin, or pins that merely round differently", () => {
    expect(roomDisagrees([{ lat: 44.98, lng: -93.23, count: 9 }])).toBe(false);
    expect(
      roomDisagrees([
        { lat: 44.980876, lng: -93.236924, count: 4 },
        { lat: 44.9809, lng: -93.23695, count: 1 },
      ]),
    ).toBe(false);
  });

  it("flags the real cases", () => {
    // The Children's Museum: the SAME address at two pins 8.2km apart.
    expect(
      roomDisagrees([
        { lat: 44.966734, lng: -92.996955, count: 7 },
        { lat: 44.946774, lng: -93.097212, count: 2 },
      ]),
    ).toBe(true);
  });
});

describe("usableAddresses", () => {
  it("drops the placeholders that geocode to a confident wrong answer", () => {
    // Every one of these was in an affected room. A geocoder answers them with a
    // street centroid or another town rather than failing, which is why a wrong
    // pin looked trustworthy.
    expect(usableAddresses(["See listing", "Main Street", "Wyoming, MN (see website)", "TBD", ""])).toEqual([]);
  });

  it("keeps numbered addresses, longest first, without duplicates", () => {
    expect(usableAddresses(["214 4th St E", "214 Fourth Street East", "214 4th St E", "  "])).toEqual([
      "214 Fourth Street East",
      "214 4th St E",
    ]);
  });

  it("is case-insensitive about duplicates", () => {
    expect(usableAddresses(["1010 Nicollet Mall", "1010 NICOLLET MALL"])).toHaveLength(1);
  });

  it("keeps an address that merely contains a placeholder-ish word", () => {
    // "Various" alone is noise; "1 Various Way" is an address.
    expect(usableAddresses(["120 W Kellogg Blvd"])).toEqual(["120 W Kellogg Blvd"]);
  });
});
