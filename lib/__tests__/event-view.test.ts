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

describe("isEnded (R0.1 — Chicago frame, true spans)", () => {
  // Instants below are explicit UTC; event times are Chicago wall strings.
  it("the live bug, as regression: tonight's show is NOT ended at 6 PM CT (23:00Z)", () => {
    // Old code parsed end "22:00" as 22:00 UTC → ended at 5 PM CT.
    const now = new Date("2026-07-20T23:00:00Z"); // 6:00 PM CDT
    expect(isEnded(ev({ start: "2026-07-20T19:00", end: "2026-07-20T22:00" }), now)).toBe(false);
  });
  it("mid-run collapsed event (day-1 end passed, multiDayEnd future) → not ended", () => {
    const now = new Date("2026-07-19T20:00:00Z");
    expect(
      isEnded(ev({ start: "2026-07-18T10:00", end: "2026-07-18T18:00", multiDayEnd: "2026-07-20T23:59" }), now),
    ).toBe(false);
  });
  it("run's final day: not ended during the day, ended after its last minute", () => {
    const run = ev({ start: "2026-07-18T10:00", end: "", multiDayEnd: "2026-07-20T18:00" });
    expect(isEnded(run, new Date("2026-07-20T20:00:00Z"))).toBe(false); // 3 PM CDT
    expect(isEnded(run, new Date("2026-07-21T06:00:00Z"))).toBe(true); // 1:00 AM CDT next day
  });
  it("all-day event on its own day → not ended until the day is over (Chicago day)", () => {
    const fair = ev({ start: "2026-07-20T00:00", end: "", allDay: true });
    expect(isEnded(fair, new Date("2026-07-21T02:00:00Z"))).toBe(false); // 9 PM CDT same day
    expect(isEnded(fair, new Date("2026-07-21T06:00:00Z"))).toBe(true); // past midnight CDT
  });
  it("genuinely past events are ended; future ones are not", () => {
    const now = new Date("2026-07-16T17:00:00Z"); // noon CDT Jul 16
    expect(isEnded(ev({ end: "2026-07-15T23:00" }), now)).toBe(true);
    expect(isEnded(ev({ end: "2026-07-20T23:00" }), now)).toBe(false);
    expect(isEnded(ev({ start: "2026-07-10T20:00", end: "" }), now)).toBe(true);
  });
  it("CST (winter) frame: offset is 6 hours, not 5", () => {
    const now = new Date("2027-01-10T18:30:00Z"); // 12:30 PM CST
    expect(isEnded(ev({ start: "2027-01-10T11:00", end: "" }), now)).toBe(true);
    expect(isEnded(ev({ start: "2027-01-10T13:00", end: "" }), now)).toBe(false);
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
