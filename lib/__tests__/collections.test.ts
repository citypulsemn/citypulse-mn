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

describe("collectionWindow — Chicago wall frame (R1.2)", () => {
  it("week runs from the wall-clock now through the 7th Chicago day", () => {
    const w = collectionWindow("week", NOW);
    expect(w.fromWall).toBe("2026-07-13T09:00");
    expect(w.endKey).toBe("2026-07-20");
    expect(w.days).toBeNull();
  });
  it("weekend covers the coming Fri–Sun as Chicago day keys", () => {
    // From Monday 7/13, the coming weekend is Fri 7/17 – Sun 7/19.
    const w = collectionWindow("weekend", NOW);
    expect([...w.days!].sort()).toEqual(["2026-07-17", "2026-07-18", "2026-07-19"]);
    expect(w.endKey).toBe("2026-07-19");
  });
  it("regression (R1.2): Sunday EVENING stays this weekend — no jump to next week", () => {
    // Sunday Jul 19, 8:00 PM CDT = Monday 01:00Z: the old server-frame getDay()
    // math saw Monday and produced NEXT weekend's window.
    const sundayEvening = new Date("2026-07-20T01:00:00Z");
    const w = collectionWindow("weekend", sundayEvening);
    expect([...w.days!]).toEqual(["2026-07-19"]);
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

  it("regression (R1.2): tonight's show is IN this afternoon — walls compared to walls", () => {
    // 3:30 PM CDT = 20:30Z. The old code parsed the 7 PM wall as 7 PM UTC
    // (= 2 PM CT) and dropped it from every collection after ~2 PM.
    const afternoon = new Date("2026-07-13T20:30:00Z");
    const tonight = ev({ id: "tonight", category: "music", start: "2026-07-13T19:00" });
    const earlier = ev({ id: "thisMorning", category: "music", start: "2026-07-13T09:00" });
    const ids = selectCollection([tonight, earlier], getCollection("live-music")!, afternoon).map((e) => e.id);
    expect(ids).toContain("tonight");
    expect(ids).not.toContain("thisMorning"); // already past — floor intact
  });

  it("regression (R1.2): Sunday-evening date-night shows tonight, not next weekend", () => {
    const sundayEvening = new Date("2026-07-20T01:00:00Z"); // Sun 7/19 8 PM CDT
    const tonight = ev({ id: "sunShow", category: "music", start: "2026-07-19T21:00" });
    const nextSat = ev({ id: "nextSat", category: "arts", start: "2026-07-25T19:00" });
    const ids = selectCollection([tonight, nextSat], getCollection("date-night")!, sundayEvening).map((e) => e.id);
    expect(ids).toEqual(["sunShow"]);
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
    expect(getCollection("free-this-week")?.title).toContain("Free");
    expect(getCollection("nonsense")).toBeUndefined();
    // 6.3 — this-weekend GRADUATED from a collection to the evergreen root
    // URL (/this-weekend, with a 301 from the old path). It must stay out of
    // the registry, or two pages would compete for the same query.
    expect(getCollection("this-weekend")).toBeUndefined();
  });
});
