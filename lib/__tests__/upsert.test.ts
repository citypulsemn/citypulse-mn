import { describe, it, expect } from "vitest";
import { dedupeByKey, guardEndAt } from "../upsert";
import type { DbEventInput } from "../types";

function ev(overrides: Partial<DbEventInput>): DbEventInput {
  return {
    event_key: "k1",
    title: "Show",
    category: "music",
    venue: "Venue",
    address: "",
    city: "Minneapolis",
    lat: 44.98,
    lng: -93.27,
    start_at: "2026-06-20T20:00",
    end_at: null,
    price: "Free",
    priceTier: "Free",
    ticket_url: "",
    description: "",
    image: "",
    source_url: "",
    status: "draft",
    ...overrides,
  };
}

describe("dedupeByKey", () => {
  it("collapses rows sharing an event_key", () => {
    const out = dedupeByKey([ev({ event_key: "k1" }), ev({ event_key: "k1" })]);
    expect(out).toHaveLength(1);
  });

  it("keeps distinct keys", () => {
    const out = dedupeByKey([ev({ event_key: "a" }), ev({ event_key: "b" })]);
    expect(out).toHaveLength(2);
  });

  it("prefers the richer row on collision", () => {
    const sparse = ev({ event_key: "k1", description: "", ticket_url: "" });
    const rich = ev({
      event_key: "k1",
      description: "Full details here",
      ticket_url: "https://tickets",
      address: "123 Main St",
    });
    const out = dedupeByKey([sparse, rich]);
    expect(out).toHaveLength(1);
    expect(out[0].description).toBe("Full details here");
    expect(out[0].ticket_url).toBe("https://tickets");
  });

  it("returns empty for empty input", () => {
    expect(dedupeByKey([])).toEqual([]);
  });
});

describe("guardEndAt — ingest backwards-span guard (event-integrity retro)", () => {
  it("nulls an end_at that falls before start_at (same-day time swap)", () => {
    // the real Saints-game case: 2:07 PM start, 11:05 AM 'end'
    expect(guardEndAt("2026-07-26T14:07", "2026-07-26T11:05")).toBeNull();
  });

  it("nulls an end_at on an earlier date (swapped run dates)", () => {
    // the real 'In the Heights' case: start Aug 25, end Aug 23
    expect(guardEndAt("2026-08-25T19:30", "2026-08-23T21:30")).toBeNull();
  });

  it("keeps a normal end after start", () => {
    expect(guardEndAt("2026-06-20T20:00", "2026-06-20T22:30")).toBe("2026-06-20T22:30");
  });

  it("keeps a genuine late-night end on the next morning (end > start numerically)", () => {
    // 9 PM show ending 1 AM — end is on the NEXT day, so not backwards
    expect(guardEndAt("2026-06-20T21:00", "2026-06-21T01:00")).toBe("2026-06-21T01:00");
  });

  it("keeps a true multi-day span", () => {
    expect(guardEndAt("2026-07-20T10:00", "2026-07-28T18:00")).toBe("2026-07-28T18:00");
  });

  it("passes null/empty end_at through as null", () => {
    expect(guardEndAt("2026-06-20T20:00", null)).toBeNull();
    expect(guardEndAt("2026-06-20T20:00", undefined)).toBeNull();
    expect(guardEndAt("2026-06-20T20:00", "")).toBeNull();
  });

  it("leaves an unparseable end_at untouched (don't guess)", () => {
    expect(guardEndAt("2026-06-20T20:00", "not-a-date")).toBe("not-a-date");
  });
});
