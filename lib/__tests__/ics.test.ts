import { describe, it, expect } from "vitest";
import {
  icsBasicUTC,
  escapeICS,
  foldLine,
  eventToICS,
  googleCalendarUrl,
} from "../ics";
import type { EventRecord } from "../types";

function ev(overrides: Partial<EventRecord> = {}): EventRecord {
  return {
    id: "abc",
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
    ticketUrl: "https://t.co/x",
    description: "A hometown show.",
    image: "",
    sourceUrl: "",
    status: "published",
    ...overrides,
  };
}

describe("icsBasicUTC", () => {
  it("converts summer Central (CDT, -05:00) to UTC", () => {
    // 2026-07-15 20:00 CDT = 2026-07-16 01:00 UTC
    expect(icsBasicUTC("2026-07-15T20:00")).toBe("20260716T010000Z");
  });
  it("converts winter Central (CST, -06:00) to UTC", () => {
    // 2026-01-15 20:00 CST = 2026-01-16 02:00 UTC
    expect(icsBasicUTC("2026-01-15T20:00")).toBe("20260116T020000Z");
  });
});

describe("escapeICS", () => {
  it("escapes special characters", () => {
    expect(escapeICS("A, B; C\\D\nE")).toBe("A\\, B\\; C\\\\D\\nE");
  });
});

describe("foldLine", () => {
  it("leaves short lines untouched", () => {
    expect(foldLine("SUMMARY:Short")).toBe("SUMMARY:Short");
  });
  it("folds long lines with CRLF + space", () => {
    const long = "DESCRIPTION:" + "x".repeat(200);
    const folded = foldLine(long);
    expect(folded).toContain("\r\n ");
    for (const seg of folded.split("\r\n")) expect(seg.length).toBeLessThanOrEqual(75);
  });
});

describe("eventToICS", () => {
  const ics = eventToICS(ev(), { now: new Date("2026-07-01T00:00:00Z") });

  it("wraps a VEVENT in a VCALENDAR", () => {
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("END:VCALENDAR");
  });
  it("uses CRLF line endings", () => {
    expect(ics).toContain("\r\n");
    expect(ics.endsWith("\r\n")).toBe(true);
  });
  it("has correct start/end and a stable UID", () => {
    expect(ics).toContain("DTSTART:20260716T010000Z");
    expect(ics).toContain("DTEND:20260716T040000Z");
    expect(ics).toContain("UID:abc@citypulsemn.com");
  });
  it("includes summary, location, and the event URL", () => {
    expect(ics).toContain("SUMMARY:Trampled by Turtles");
    expect(ics).toContain("LOCATION:First Avenue\\, 701 1st Ave N\\, Minneapolis\\, MN");
    expect(ics).toContain("URL:https://citypulsemn.com/event/abc");
  });
  it("defaults to a 2-hour duration when there's no end", () => {
    const noEnd = eventToICS(ev({ end: "" }));
    expect(noEnd).toContain("DTSTART:20260716T010000Z");
    expect(noEnd).toContain("DTEND:20260716T030000Z");
  });
  it("marks cancelled events CANCELLED", () => {
    expect(eventToICS(ev({ status: "cancelled" }))).toContain("STATUS:CANCELLED");
  });
});

describe("googleCalendarUrl", () => {
  it("builds a template URL with dates, text, and location", () => {
    const url = googleCalendarUrl(ev());
    expect(url).toContain("calendar.google.com/calendar/render");
    expect(url).toContain("action=TEMPLATE");
    expect(url).toContain("dates=20260716T010000Z%2F20260716T040000Z");
    expect(url).toContain("text=Trampled+by+Turtles");
    expect(url).toContain("First+Avenue");
  });
});
