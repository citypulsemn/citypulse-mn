import { describe, it, expect } from "vitest";
import { VENUES, venuesFor, shardVenues, isVenueAnchored, VENUE_ANCHORED } from "../venues";
import { buildVenueSweepPrompt } from "../agents/prompts";
import { areaOf } from "../areas";
import { CATEGORY_KEYS } from "../categories";
import { classifyEvent } from "../classify";

describe("venue registry", () => {
  it("has venues and they're well-formed", () => {
    expect(VENUES.length).toBeGreaterThan(20);
    for (const v of VENUES) {
      expect(v.name.trim().length).toBeGreaterThan(0);
      expect(v.city.trim().length).toBeGreaterThan(0);
      expect(CATEGORY_KEYS).toContain(v.category);
    }
  });

  it("has no duplicate venue names", () => {
    const names = VENUES.map((v) => v.name);
    expect(new Set(names).size).toBe(names.length);
  });

  /**
   * If a venue's city isn't in the area map, every event we discover there lands
   * in the "Elsewhere" bucket and quietly disappears from area filters. This test
   * is the guard against that whole class of silent failure.
   */
  it("every venue's city maps to a real area (not 'other')", () => {
    const unmapped = VENUES.filter((v) => areaOf({ city: v.city }) === "other");
    expect(unmapped.map((v) => `${v.name} (${v.city})`)).toEqual([]);
  });

  it("covers the flagship Twin Cities music rooms", () => {
    const music = venuesFor("music").map((v) => v.name.toLowerCase()).join(" | ");
    for (const room of ["first avenue", "palace", "turf club", "icehouse", "dakota", "cedar"]) {
      expect(music).toContain(room);
    }
  });

  it("music is the biggest registry — it's the most fragmented category", () => {
    const music = venuesFor("music").length;
    expect(music).toBeGreaterThanOrEqual(20);
    for (const cat of CATEGORY_KEYS) {
      if (cat === "music") continue;
      expect(music).toBeGreaterThanOrEqual(venuesFor(cat).length);
    }
  });

  it("venue-anchors exactly the fragmented categories", () => {
    expect(isVenueAnchored("music")).toBe(true);
    expect(isVenueAnchored("family")).toBe(true);
    expect(isVenueAnchored("festival")).toBe(false); // festivals aggregate fine
    for (const c of VENUE_ANCHORED) expect(venuesFor(c).length).toBeGreaterThan(0);
  });
});

describe("shardVenues", () => {
  const vs = venuesFor("music");

  it("splits into shards of the requested size, losing nothing", () => {
    const shards = shardVenues(vs, 5);
    expect(shards.flat().length).toBe(vs.length);
    for (const s of shards.slice(0, -1)) expect(s.length).toBe(5);
    expect(shards.at(-1)!.length).toBeLessThanOrEqual(5);
  });

  it("handles an empty list and a single venue", () => {
    expect(shardVenues([], 5)).toEqual([]);
    expect(shardVenues([vs[0]], 5)).toHaveLength(1);
  });

  it("rejects a nonsensical shard size", () => {
    expect(() => shardVenues(vs, 0)).toThrow();
  });

  it("preserves order (so runs are reproducible)", () => {
    expect(shardVenues(vs, 4).flat().map((v) => v.name)).toEqual(vs.map((v) => v.name));
  });
});

describe("buildVenueSweepPrompt", () => {
  const shard = venuesFor("music").slice(0, 3);
  const prompt = buildVenueSweepPrompt("music", shard, "2026-08-01", "2026-08-31");

  it("names every venue in the shard", () => {
    for (const v of shard) expect(prompt).toContain(v.name);
  });

  it("carries the date window and demands per-venue completeness", () => {
    expect(prompt).toContain("2026-08-01");
    expect(prompt).toContain("2026-08-31");
    expect(prompt.toLowerCase()).toContain("one by one");
    expect(prompt).toContain("```json");
  });

  it("tells the agent to report the true category, not force one", () => {
    // With 4.1, the classifier decides — the agent should report honestly.
    expect(prompt.toLowerCase()).toContain("report honestly");
  });
});

describe("venue sweeps compose with the 4.1 classifier", () => {
  it("a comedy night found at a music venue is still classified arts", () => {
    const r = classifyEvent({
      title: "Stand-Up Comedy Showcase",
      venue: "Turf Club",
      category: "music", // the sweep's category
    });
    expect(r.category).toBe("arts");
  });

  it("a show at First Avenue is music", () => {
    const r = classifyEvent({
      title: "Trampled by Turtles",
      venue: "First Avenue & 7th St Entry",
      category: "music",
    });
    expect(r.category).toBe("music");
  });
});
