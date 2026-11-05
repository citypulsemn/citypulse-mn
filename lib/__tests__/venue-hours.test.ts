import { describe, it, expect } from "vitest";
import { VENUE_HOURS, venueHours, readOnLabel } from "../venue-hours";
import { VENUE_PAGES } from "../venue-pages";

/**
 * These hours replaced eight "Daily General Admission" EVENT rows that the
 * pipeline kept minting against a standing fact (5 Nov 2026). The rows carried
 * no provenance worth the name — two of them cited a third-party roundup rather
 * than the venue. The whole point of moving the fact here is that it arrives
 * with a source and a date, so these tests guard exactly that.
 */
describe("VENUE_HOURS — the drift guard", () => {
  const venueSlugs = new Set(VENUE_PAGES.map((v) => v.slug));

  it("every entry keys to a REAL venue-page slug", () => {
    for (const slug of Object.keys(VENUE_HOURS)) {
      expect(venueSlugs.has(slug), `VENUE_HOURS["${slug}"] has no venue page`).toBe(true);
    }
  });

  it("every entry carries at least one hours line, and none is blank", () => {
    for (const [slug, h] of Object.entries(VENUE_HOURS)) {
      expect(h.lines.length, `${slug} has no hours`).toBeGreaterThan(0);
      for (const line of h.lines) {
        expect(line.trim().length, `${slug} has a blank line`).toBeGreaterThan(0);
      }
    }
  });

  // THE RULE THIS TABLE EXISTS TO ENFORCE. The archived rows were sourced from
  // familyfuntwincities.com, playtimecompass.com and mallofamerica.com/events —
  // roundups, not the venue. An aggregator URL here would be the same mistake
  // in a new place.
  it("every source is the VENUE's own site over https, never an aggregator", () => {
    const aggregators = [
      "familyfuntwincities.com",
      "playtimecompass.com",
      "mallofamerica.com",
      "experiencesbynick.com",
      "eventbrite.",
      "facebook.com",
      "tripadvisor.",
      "yelp.com",
    ];
    for (const [slug, h] of Object.entries(VENUE_HOURS)) {
      expect(h.sourceUrl.startsWith("https://"), `${slug} source is not https`).toBe(true);
      const host = new URL(h.sourceUrl).hostname.toLowerCase();
      for (const bad of aggregators) {
        expect(host.includes(bad), `${slug} cites the aggregator ${bad}`).toBe(false);
      }
    }
  });

  it("every entry says WHEN a person read it — a real past date", () => {
    for (const [slug, h] of Object.entries(VENUE_HOURS)) {
      expect(h.readOn, `${slug} readOn is malformed`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const t = Date.parse(`${h.readOn}T12:00:00Z`);
      expect(Number.isNaN(t), `${slug} readOn is not a real date`).toBe(false);
      // The table was created on 5 Nov 2026; nothing in it can predate that work.
      expect(h.readOn >= "2026-11-05", `${slug} readOn is older than this table`).toBe(true);
    }
  });

  // CLAUDE.md's banned list. These strings are read by people deciding whether
  // to drive across the metro; brochure voice is the thing to keep out.
  it("no brochure voice", () => {
    const banned = ["nestled", "vibrant", "hidden gem", "look no further", "in the heart of"];
    for (const [slug, h] of Object.entries(VENUE_HOURS)) {
      const text = [...h.lines, h.admission ?? "", h.note ?? ""].join(" ").toLowerCase();
      for (const word of banned) {
        expect(text.includes(word), `${slug} uses "${word}"`).toBe(false);
      }
    }
  });

  // Honest emptiness: a venue nobody has read the site of renders no box at all,
  // rather than a "Hours: see website" placeholder.
  it("venueHours is null for a venue with no entry, and for a ghost slug", () => {
    expect(venueHours("first-avenue")).toBeNull();
    expect(venueHours("not-a-venue-at-all")).toBeNull();
    expect(venueHours("como-park-zoo-and-conservatory")).not.toBeNull();
  });
});

describe("the three venues whose rows were archived", () => {
  // Each of these replaced a live "admission" event row, so each must exist —
  // otherwise the archive threw the fact away instead of moving it.
  it("Como, the Minnesota Zoo and Nickelodeon Universe all carry hours", () => {
    for (const slug of [
      "como-park-zoo-and-conservatory",
      "minnesota-zoo",
      "nickelodeon-universe",
    ]) {
      expect(VENUE_HOURS[slug], `${slug} lost its hours in the archive`).toBeTruthy();
    }
  });

  it("Como keeps the Conservatory's Monday exceptions — the detail a row flattened", () => {
    const lines = VENUE_HOURS["como-park-zoo-and-conservatory"].lines.join(" ");
    expect(lines).toContain("Tuesday–Sunday");
    expect(lines).toContain("9 November");
  });

  it("Nickelodeon keeps the Sunday difference, the one that catches people out", () => {
    const lines = VENUE_HOURS["nickelodeon-universe"].lines.join(" ");
    expect(lines).toContain("Sunday");
    expect(lines).toContain("11 a.m.");
  });

  it("the Minnesota Zoo keeps the online-ticket requirement", () => {
    expect(VENUE_HOURS["minnesota-zoo"].lines.join(" ")).toMatch(/online tickets/i);
  });
});

describe("readOnLabel", () => {
  it("reads as a date a person would say", () => {
    expect(readOnLabel("2026-11-05")).toBe("5 November 2026");
    expect(readOnLabel("2027-01-10")).toBe("10 January 2027");
  });
});
