import { describe, it, expect } from "vitest";
import {
  isPublicStatus,
  dayKeyOf,
  isEnded,
  eventMetaDescription,
  staticMapUrl,
  longDate,
  isValidDayKey,
} from "../event-view";
import type { EventRecord } from "../types";

function ev(overrides: Partial<EventRecord> = {}): EventRecord {
  return {
    id: "1",
    title: "Trampled by Turtles",
    category: "music",
    venue: "First Avenue",
    address: "701 1st Ave N",
    city: "Minneapolis",
    lat: 44.9785,
    lng: -93.2762,
    start: "2026-07-15T20:00",
    end: "2026-07-15T23:00",
    price: "$35",
    priceTier: "$$",
    ticketUrl: "https://example.com",
    description: "A hometown show.",
    image: "",
    sourceUrl: "",
    status: "published",
    ...overrides,
  };
}

describe("isPublicStatus", () => {
  it("published/archived/cancelled are public; draft is not", () => {
    expect(isPublicStatus("published")).toBe(true);
    expect(isPublicStatus("archived")).toBe(true);
    expect(isPublicStatus("cancelled")).toBe(true);
    expect(isPublicStatus("draft")).toBe(false);
  });
});

describe("dayKeyOf", () => {
  it("returns the calendar day of the start", () => {
    expect(dayKeyOf(ev({ start: "2026-07-15T20:00" }))).toBe("2026-07-15");
  });
});

describe("isEnded", () => {
  const now = new Date("2026-07-16T12:00:00");
  it("true when end is in the past", () => {
    expect(isEnded(ev({ end: "2026-07-15T23:00" }), now)).toBe(true);
  });
  it("false when end is in the future", () => {
    expect(isEnded(ev({ end: "2026-07-20T23:00" }), now)).toBe(false);
  });
  it("falls back to start when end is empty", () => {
    expect(isEnded(ev({ start: "2026-07-10T20:00", end: "" }), now)).toBe(true);
  });
});

describe("eventMetaDescription", () => {
  it("includes when, venue and price and stays <= 200 chars", () => {
    const d = eventMetaDescription(ev());
    expect(d).toContain("First Avenue");
    expect(d).toContain("$35");
    expect(d.length).toBeLessThanOrEqual(200);
  });
});

describe("staticMapUrl", () => {
  it("null without a token", () => {
    expect(staticMapUrl(44.9, -93.2, undefined)).toBeNull();
  });
  it("null at 0,0 (ungeocoded)", () => {
    expect(staticMapUrl(0, 0, "pk.test")).toBeNull();
  });
  it("builds a Mapbox static URL with a gold pin", () => {
    const url = staticMapUrl(44.9, -93.2, "pk.test")!;
    expect(url).toContain("api.mapbox.com/styles/v1/mapbox/dark-v11/static");
    expect(url).toContain("pin-l+c9a961");
    expect(url).toContain("access_token=pk.test");
  });
});

describe("longDate", () => {
  it("formats a valid key", () => {
    expect(longDate("2026-07-04")).toBe("Saturday, July 4, 2026");
  });
  it("returns the input when invalid", () => {
    expect(longDate("nope")).toBe("nope");
  });
});

describe("isValidDayKey", () => {
  it("accepts real dates", () => {
    expect(isValidDayKey("2026-07-04")).toBe(true);
  });
  it("rejects bad shapes and impossible dates", () => {
    expect(isValidDayKey("2026-7-4")).toBe(false);
    expect(isValidDayKey("2026-13-01")).toBe(false);
    expect(isValidDayKey("2026-02-30")).toBe(false);
    expect(isValidDayKey("garbage")).toBe(false);
  });
});
