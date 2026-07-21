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

describe("R2.5 — calendar-export correctness", () => {
  // A timed collapsed run: daily 10:00–17:00, folded Jul 17 → Jul 28.
  const run = (overrides: Partial<EventRecord> = {}) =>
    ev({
      start: "2026-07-17T10:00",
      end: "2026-07-17T17:00",
      multiDayEnd: "2026-07-28T23:59", // the collapse writes last-day 23:59
      ...overrides,
    });

  it("a) a timed collapsed run's DTEND lands on its LAST day (true spans, rule 5)", () => {
    const ics = eventToICS(run(), { now: new Date("2026-07-01T00:00:00Z") });
    expect(ics).toContain("DTSTART:20260717T150000Z"); // Jul 17 10:00 CDT
    expect(ics).toContain("DTEND:20260729T045900Z"); // Jul 28 23:59 CDT — not day 1
  });

  it("a) the Google link for the same run carries the same true span", () => {
    expect(googleCalendarUrl(run())).toContain("dates=20260717T150000Z%2F20260729T045900Z");
  });

  it("b) the Google link for an ALL-DAY fair is the DATE form, end-exclusive — no invented clock times", () => {
    const url = googleCalendarUrl(
      run({ allDay: true, start: "2026-07-17T00:00", end: "" }),
    );
    expect(url).toContain("dates=20260717%2F20260729");
    expect(url).not.toMatch(/dates=[^&]*T\d/);
  });

  it("c) foldLine folds on OCTETS (RFC 5545) and never splits an emoji", () => {
    const line = "SUMMARY:" + "🎸".repeat(40); // 4 bytes per emoji, 168 bytes total
    const folded = foldLine(line);
    for (const seg of folded.split("\r\n")) {
      expect(Buffer.byteLength(seg, "utf8")).toBeLessThanOrEqual(75);
      // a split surrogate pair would round-trip through UTF-8 as U+FFFD
      expect(Buffer.from(seg, "utf8").toString("utf8")).toBe(seg);
    }
    expect(folded.replace(/\r\n /g, "")).toBe(line); // unfolding reconstructs exactly
  });

  it("round-trip: node-ical parses an emoji title + multi-day timed run back exactly", async () => {
    const { sync } = await import("node-ical");
    const event = run({ title: "Twin Cities Ribfest 🍖🎸 with an intentionally long name for folding" });
    const ics = eventToICS(event, { now: new Date("2026-07-01T00:00:00Z") });
    const parsed = sync.parseICS(ics);
    const ve = Object.values(parsed).find(
      (v) => (v as { type?: string }).type === "VEVENT",
    ) as { summary: string; start: Date; end: Date };
    expect(ve.summary).toBe("Twin Cities Ribfest 🍖🎸 with an intentionally long name for folding");
    expect(ve.start.toISOString()).toBe("2026-07-17T15:00:00.000Z");
    expect(ve.end.toISOString()).toBe("2026-07-29T04:59:00.000Z");
  });
});
