import { describe, it, expect } from "vitest";
import { matchesQuery, searchEvents } from "../search";
import type { EventRecord } from "../types";

function ev(overrides: Partial<EventRecord> = {}): EventRecord {
  return {
    id: "1",
    title: "Trampled by Turtles",
    category: "music",
    venue: "First Avenue",
    address: "701 1st Ave N",
    city: "Minneapolis",
    lat: 44.9,
    lng: -93.2,
    start: "2026-07-15T20:00",
    end: "2026-07-15T23:00",
    price: "$35",
    priceTier: "$$",
    ticketUrl: "",
    description: "A hometown bluegrass show.",
    image: "",
    sourceUrl: "",
    status: "published",
    ...overrides,
  };
}

describe("matchesQuery", () => {
  it("matches on title", () => expect(matchesQuery(ev(), "turtles")).toBe(true));
  it("matches on venue", () => expect(matchesQuery(ev(), "first avenue")).toBe(true));
  it("matches on city", () => expect(matchesQuery(ev({ city: "Plymouth" }), "plymouth")).toBe(true));
  it("matches on description", () => expect(matchesQuery(ev(), "bluegrass")).toBe(true));

  it("is case-insensitive", () => expect(matchesQuery(ev(), "TURTLES")).toBe(true));

  it("folds accents (query without accent matches accented text)", () => {
    expect(matchesQuery(ev({ venue: "Café Racer" }), "cafe")).toBe(true);
  });
  it("folds accents (accented query matches plain text)", () => {
    expect(matchesQuery(ev({ venue: "Cafe Racer" }), "café")).toBe(true);
  });

  it("matches partial words (substring)", () => {
    expect(matchesQuery(ev({ venue: "Como Regional Park" }), "como")).toBe(true);
  });

  it("multi-word is AND — all words must appear", () => {
    expect(matchesQuery(ev(), "turtles avenue")).toBe(true); // both present
    expect(matchesQuery(ev(), "turtles armory")).toBe(false); // armory absent
  });

  it("empty or punctuation-only query matches everything", () => {
    expect(matchesQuery(ev(), "")).toBe(true);
    expect(matchesQuery(ev(), "   ")).toBe(true);
    expect(matchesQuery(ev(), "!!!")).toBe(true);
  });

  it("returns false when nothing matches", () => {
    expect(matchesQuery(ev(), "zzzznotpresent")).toBe(false);
  });
});

describe("searchEvents", () => {
  const list = [
    ev({ id: "1", title: "Jazz Night", venue: "The Dakota" }),
    ev({ id: "2", title: "Rock Show", venue: "First Avenue" }),
    ev({ id: "3", title: "Farmers Market", venue: "Mill City", city: "Minneapolis" }),
  ];

  it("filters to matching events", () => {
    expect(searchEvents(list, "market").map((e) => e.id)).toEqual(["3"]);
  });
  it("returns the original list for an empty query", () => {
    expect(searchEvents(list, "")).toHaveLength(3);
  });
});
