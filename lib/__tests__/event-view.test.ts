import { describe, it, expect } from "vitest";
import {
  isPublicStatus,
  dayKeyOf,
  isEnded,
  eventTimeState,
  timeStateLabel,
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

describe("eventTimeState (F2.1 — three honest states, riding R0.1's fixtures)", () => {
  // Tonight's show: 7–10 PM CDT, Jul 20.
  const show = ev({ start: "2026-07-20T19:00", end: "2026-07-20T22:00" });

  it("the countdown: 5 PM → 'in 2 hours', 6:35 PM → 'in 25 minutes'", () => {
    const at5 = eventTimeState(show, new Date("2026-07-20T22:00:00Z"));
    expect(at5).toEqual({ kind: "soon", minutesUntil: 120 });
    expect(timeStateLabel(at5)).toBe("Starts in 2 hours");
    const at635 = eventTimeState(show, new Date("2026-07-20T23:35:00Z"));
    expect(at635).toEqual({ kind: "soon", minutesUntil: 25 });
    expect(timeStateLabel(at635)).toBe("Starts in 25 minutes");
  });

  it("during the show it's happening now; after the last minute it's ended", () => {
    expect(eventTimeState(show, new Date("2026-07-21T01:00:00Z")).kind).toBe("now"); // 8 PM
    expect(eventTimeState(show, new Date("2026-07-21T03:01:00Z")).kind).toBe("ended"); // 10:01 PM
  });

  it("beyond the 12h horizon there is NO countdown — the date row is the answer", () => {
    expect(eventTimeState(show, new Date("2026-07-20T11:00:00Z")).kind).toBe("upcoming"); // 6 AM
    expect(eventTimeState(show, new Date("2026-07-20T12:01:00Z")).kind).toBe("soon"); // 7:01 AM, 11h59m out
  });

  it("no recorded end: happening for the 2h the .ics already promises, then ended", () => {
    const noEnd = ev({ start: "2026-07-20T19:00", end: "" });
    expect(eventTimeState(noEnd, new Date("2026-07-21T01:30:00Z")).kind).toBe("now"); // +1h30
    expect(eventTimeState(noEnd, new Date("2026-07-21T02:01:00Z")).kind).toBe("ended"); // +2h01
  });

  it("mid-run collapsed event is happening now on day 2 (true spans, rule 5)", () => {
    const run = ev({ start: "2026-07-18T10:00", end: "2026-07-18T18:00", multiDayEnd: "2026-07-20T23:59" });
    expect(eventTimeState(run, new Date("2026-07-19T20:00:00Z")).kind).toBe("now");
  });

  it("all-day fair: upcoming the evening before (never a midnight countdown), now during, ended after", () => {
    const fair = ev({ start: "2026-07-20T00:00", end: "", allDay: true, multiDayEnd: "2026-07-21T23:59" });
    expect(eventTimeState(fair, new Date("2026-07-20T02:00:00Z")).kind).toBe("upcoming"); // 9 PM Jul 19
    expect(eventTimeState(fair, new Date("2026-07-21T02:00:00Z")).kind).toBe("now"); // 9 PM day 1
    expect(eventTimeState(fair, new Date("2026-07-22T03:00:00Z")).kind).toBe("now"); // 10 PM day 2
    expect(eventTimeState(fair, new Date("2026-07-22T06:00:00Z")).kind).toBe("ended"); // past midnight
  });

  it("labels: singular forms, and upcoming renders nothing", () => {
    expect(timeStateLabel({ kind: "soon", minutesUntil: 1 })).toBe("Starts in 1 minute");
    expect(timeStateLabel({ kind: "soon", minutesUntil: 65 })).toBe("Starts in 1 hour");
    expect(timeStateLabel({ kind: "now" })).toBe("Happening now");
    expect(timeStateLabel({ kind: "ended" })).toBe("This event has already happened.");
    expect(timeStateLabel({ kind: "upcoming" })).toBeNull();
  });

  it("winter frame: the countdown math survives CST (rule 10 via wallToInstant)", () => {
    const jan = ev({ start: "2027-01-10T19:00", end: "" });
    const state = eventTimeState(jan, new Date("2027-01-10T23:00:00Z")); // 5 PM CST
    expect(state).toEqual({ kind: "soon", minutesUntil: 120 });
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
