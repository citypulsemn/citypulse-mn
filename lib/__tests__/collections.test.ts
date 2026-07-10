import { describe, it, expect } from "vitest";
import {
  selectCollection,
  collectionWindow,
  getCollection,
  COLLECTIONS,
  type CollectionSpec,
} from "../collections";
import type { EventRecord } from "../types";

const NOW = new Date("2026-07-13T09:00:00-05:00"); // Monday

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
    start: "2026-07-15T20:00", // Wed (in week window)
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

describe("collectionWindow", () => {
  it("week is a 7-day window", () => {
    const w = collectionWindow("week", NOW);
    expect(w.end - w.start).toBe(7 * 86_400_000);
  });
  it("weekend covers the coming Fri–Sun", () => {
    // From Monday 7/13, the coming weekend is Fri 7/17 – Sun 7/19.
    const w = collectionWindow("weekend", NOW);
    const start = new Date(w.start);
    const end = new Date(w.end);
    expect(start.getDate()).toBe(17); // Friday
    expect(end.getDate()).toBe(19); // Sunday
  });
});

describe("selectCollection", () => {
  const list = [
    ev({ id: "wedMusic", category: "music", start: "2026-07-15T20:00" }),
    ev({ id: "friFamilyFree", category: "family", priceTier: "Free", start: "2026-07-17T10:00" }),
    ev({ id: "satArts", category: "arts", start: "2026-07-18T19:00" }),
    ev({ id: "farMusic", category: "music", start: "2026-08-30T20:00" }), // outside week
    ev({ id: "draft", category: "music", start: "2026-07-15T21:00", status: "draft" }),
  ];

  it("live-music picks music within the week, excludes drafts and far events", () => {
    const out = selectCollection(list, getCollection("live-music")!, NOW);
    const ids = out.map((e) => e.id);
    expect(ids).toContain("wedMusic");
    expect(ids).not.toContain("farMusic");
    expect(ids).not.toContain("draft");
    expect(ids).not.toContain("friFamilyFree");
  });

  it("free-this-week filters to Free tier", () => {
    const out = selectCollection(list, getCollection("free-this-week")!, NOW);
    expect(out.map((e) => e.id)).toEqual(["friFamilyFree"]);
  });

  it("date-night matches any of music/arts/food on the weekend", () => {
    const out = selectCollection(list, getCollection("date-night")!, NOW);
    // satArts is on the weekend; wedMusic is Wednesday (not weekend)
    expect(out.map((e) => e.id)).toContain("satArts");
    expect(out.map((e) => e.id)).not.toContain("wedMusic");
  });

  it("results are sorted chronologically", () => {
    const spec: CollectionSpec = { slug: "x", title: "X", tagline: "", window: "month" };
    const out = selectCollection(list, spec, NOW);
    for (let i = 1; i < out.length; i++) {
      expect(new Date(out[i].start).getTime()).toBeGreaterThanOrEqual(
        new Date(out[i - 1].start).getTime(),
      );
    }
  });
});

describe("COLLECTIONS registry", () => {
  it("every collection has a unique slug and required fields", () => {
    const slugs = new Set<string>();
    for (const c of COLLECTIONS) {
      expect(c.slug).toMatch(/^[a-z0-9-]+$/);
      expect(c.title.length).toBeGreaterThan(0);
      expect(c.tagline.length).toBeGreaterThan(0);
      expect(slugs.has(c.slug)).toBe(false);
      slugs.add(c.slug);
    }
  });
  it("getCollection resolves by slug", () => {
    expect(getCollection("this-weekend")?.title).toContain("Weekend");
    expect(getCollection("nope")).toBeUndefined();
  });
});
