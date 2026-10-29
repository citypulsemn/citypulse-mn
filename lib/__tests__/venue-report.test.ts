import { describe, it, expect } from "vitest";
import { venueReportKey, aggregateVenueStats, findVenueReport } from "../venue-report";
import type { VenueStatRow } from "../stats";

const row = (venue: string, views: number, clicks: number): VenueStatRow => ({ venue, views, clicks });

/**
 * C1's pure half. The thing these tests exist to stop is a WRONG NUMBER IN A
 * SALES EMAIL: a venue's clicks split across four spellings of its own name,
 * quoted as the fragment. Every case below is a real string out of the live
 * events table (measured 29 Oct 2026), not an invented one.
 */
describe("venueReportKey", () => {
  it("prefers the registry slug, which is the only thing that knows the aliases", () => {
    // Nothing derivable from the string itself connects these to First Avenue.
    expect(venueReportKey("7th St Entry")).toBe("first-avenue");
    expect(venueReportKey("First Avenue & 7th St Entry")).toBe("first-avenue");
    // The building was renamed in 2025; the slug deliberately was not.
    expect(venueReportKey("Grand Casino Arena")).toBe("xcel-energy-center");
    expect(venueReportKey("Xcel Energy Center")).toBe("xcel-energy-center");
  });

  it("falls back to the slugified name, which is 79% of the businesses that earn clicks", () => {
    // None of these are in the venue registry, and together they are most of
    // the top ten by ticket clicks. A registry-only key would have missed them.
    expect(venueReportKey("Ferguson's Orchard")).toBe("ferguson-s-orchard");
    expect(venueReportKey("Scream Town")).toBe("scream-town");
    expect(venueReportKey("Pryes Brewing Company")).toBe("pryes-brewing-company");
  });

  it("collapses the parenthetical sub-room without any hand-maintained list", () => {
    const keys = [
      "Como Park Zoo & Conservatory",
      "Como Park Zoo & Conservatory (Sunken Garden)",
      "Como Park Zoo & Conservatory (Marjorie McNeely Conservatory)",
    ].map(venueReportKey);
    expect(new Set(keys).size).toBe(1);
  });

  it("returns null when there is no name, rather than a key nobody can own", () => {
    expect(venueReportKey("")).toBeNull();
    expect(venueReportKey("   ")).toBeNull();
    expect(venueReportKey("—")).toBeNull();
    expect(venueReportKey("()")).toBeNull();
  });
});

describe("aggregateVenueStats", () => {
  it("sums every spelling of one business into one row", () => {
    // Live shape: Three Rivers Park District's clicks were spread over four
    // venue strings, so the per-string table showed the fragment, not the sum.
    const out = aggregateVenueStats([
      row("Three Rivers Park District (Baker Campground)", 135, 39),
      row("Three Rivers Park District", 40, 3),
      row("Three Rivers Park District (Plymouth)", 11, 2),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].views).toBe(186);
    expect(out[0].clicks).toBe(44);
    expect(out[0].spellings).toHaveLength(3);
  });

  it("names a registry venue with the curated name, not the top spelling", () => {
    const out = aggregateVenueStats([row("Mall of America", 62, 12)]);
    expect(out[0].key).toBe("nickelodeon-universe");
    expect(out[0].name).toBe("Nickelodeon Universe / Mall of America");
    expect(out[0].registry).toBe(true);
  });

  it("names a non-registry business with its most-clicked spelling, verbatim", () => {
    const out = aggregateVenueStats([
      row("Trail of Terror Grounds (Minnesota Renaissance Festival Site)", 63, 41),
      row("Trail of Terror Grounds", 5, 1),
    ]);
    expect(out[0].name).toBe("Trail of Terror Grounds (Minnesota Renaissance Festival Site)");
    expect(out[0].registry).toBe(false);
    expect(out[0].spellings[0]).toBe("Trail of Terror Grounds (Minnesota Renaissance Festival Site)");
  });

  it("orders by clicks, because clicks are the pitch and views are the context", () => {
    const out = aggregateVenueStats([
      row("Walker Art Center", 880, 12),
      row("Scream Town", 106, 27),
    ]);
    expect(out.map((r) => r.key)).toEqual(["scream-town", "walker-art-center"]);
  });

  it("drops rows with no venue name instead of inventing a business", () => {
    expect(aggregateVenueStats([row("  ", 90, 9)])).toEqual([]);
  });

  it("is honestly empty on empty input", () => {
    expect(aggregateVenueStats([])).toEqual([]);
  });
});

describe("findVenueReport", () => {
  const rows = aggregateVenueStats([row("Scream Town", 106, 27)]);

  it("finds the business", () => {
    expect(findVenueReport(rows, "scream-town")?.clicks).toBe(27);
  });

  it("returns null for a venue with nothing in the window, never a zero row", () => {
    // The page needs to tell "no traffic" apart from "a row of zeros we made
    // up" — honest emptiness is the caller's job and it needs the null to do it.
    expect(findVenueReport(rows, "first-avenue")).toBeNull();
  });
});
