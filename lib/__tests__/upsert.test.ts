import { describe, it, expect } from "vitest";
import { dedupeByKey } from "../upsert";
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
