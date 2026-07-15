import { describe, it, expect } from "vitest";
import {
  normalizeAgentTime,
  isImprobableStart,
  IMPROBABLE_BEFORE_HOUR,
} from "../time-integrity";
import { timeLabel } from "../dates";
import { eventToICS } from "../ics";
import type { EventRecord } from "../types";

describe("normalizeAgentTime — THE LIVE BUGS", () => {
  /**
   * The Ramsey County Fair: the agent returned a date-only string; stored in a
   * UTC session it became midnight UTC and rendered as 7 PM THE PREVIOUS DAY
   * ("Wednesday, July 15 · 7 PM" on an event that starts July 16).
   */
  it("date-only stays on its own date, as an all-day event", () => {
    const t = normalizeAgentTime("2026-07-16")!;
    expect(t.wallClock).toBe("2026-07-16T00:00");
    expect(t.iso).toBe("2026-07-16T00:00:00-05:00"); // July = CDT
    expect(t.allDay).toBe(true);
    expect(t.changed).toBe(true);
  });

  /**
   * The "5 AM Aquatennial" class: the agent meant 10 AM local but appended Z;
   * stored as 10:00 UTC it rendered 5 AM Central. The zone suffix is noise —
   * the clock face is the truth.
   */
  it("a Z suffix is stripped; the wall-clock face is kept as local", () => {
    const t = normalizeAgentTime("2026-07-18T10:00:00Z")!;
    expect(t.wallClock).toBe("2026-07-18T10:00");
    expect(t.iso).toBe("2026-07-18T10:00:00-05:00");
    expect(t.allDay).toBe(false);
    expect(t.changed).toBe(true);
  });

  /**
   * The silent majority: even the WELL-FORMED "19:30" the prompt asks for was
   * being read as UTC by the database session (2:30 PM Central). Normalization
   * attaches the real offset so the stored instant can't drift.
   */
  it("a zone-less local time gains the correct explicit offset", () => {
    const t = normalizeAgentTime("2026-07-18T19:30")!;
    expect(t.iso).toBe("2026-07-18T19:30:00-05:00");
    expect(t.changed).toBe(false); // the string was fine; storage was the bug
  });

  it("handles offsets, seconds, millis, and space separators", () => {
    expect(normalizeAgentTime("2026-07-18T19:30:00-05:00")!.wallClock).toBe("2026-07-18T19:30");
    expect(normalizeAgentTime("2026-07-18T19:30:00.000Z")!.wallClock).toBe("2026-07-18T19:30");
    expect(normalizeAgentTime("2026-07-18 19:30")!.wallClock).toBe("2026-07-18T19:30");
    expect(normalizeAgentTime("2026-07-18T19:30:00+0000")!.wallClock).toBe("2026-07-18T19:30");
  });

  it("is DST-aware (a January date gets -06:00)", () => {
    expect(normalizeAgentTime("2026-01-20T19:00")!.iso).toBe("2026-01-20T19:00:00-06:00");
  });

  it("explicit midnight is a date wearing a clock — treated as all-day", () => {
    const t = normalizeAgentTime("2026-07-16T00:00:00")!;
    expect(t.allDay).toBe(true);
  });

  it("rejects garbage instead of guessing", () => {
    expect(normalizeAgentTime("next Friday")).toBeNull();
    expect(normalizeAgentTime("2026-07-18T25:00")).toBeNull();
    expect(normalizeAgentTime("")).toBeNull();
    expect(normalizeAgentTime(undefined)).toBeNull();
  });
});

describe("isImprobableStart", () => {
  it("flags the artifact window, honors the boundary", () => {
    expect(isImprobableStart("2026-07-18T05:00", false)).toBe(true); // the 5 AM art fair
    expect(isImprobableStart("2026-07-18T06:59", false)).toBe(true);
    expect(isImprobableStart(`2026-07-18T0${IMPROBABLE_BEFORE_HOUR}:00`, false)).toBe(false);
    expect(isImprobableStart("2026-07-18T19:30", false)).toBe(false);
  });

  it("all-day placeholders are exempt — their midnight isn't a claim", () => {
    expect(isImprobableStart("2026-07-16T00:00", true)).toBe(false);
  });
});

function ev(overrides: Partial<EventRecord> = {}): EventRecord {
  return {
    id: "e1", title: "Ramsey County Fair", category: "festival",
    venue: "Ramsey County Fairgrounds", address: "", city: "Maplewood",
    lat: 45, lng: -93, start: "2026-07-16T00:00", end: "",
    price: "Free", priceTier: "Free", ticketUrl: "", description: "",
    image: "", sourceUrl: "", status: "published",
    multiDayEnd: "2026-07-19T23:59", allDay: true,
    ...overrides,
  };
}

describe("all-day display", () => {
  it("timeLabel never invents a clock time", () => {
    expect(timeLabel(ev())).toBe("All day");
    expect(timeLabel(ev({ allDay: false, start: "2026-07-16T19:00" }))).toBe("7 PM");
  });
});

describe("all-day .ics export", () => {
  it("emits DATE values with an exclusive DTEND after the last day", () => {
    const ics = eventToICS(ev(), { now: new Date("2026-07-01T12:00:00Z") });
    expect(ics).toContain("DTSTART;VALUE=DATE:20260716");
    expect(ics).toContain("DTEND;VALUE=DATE:20260720"); // day after Jul 19
    expect(ics).not.toContain("DTSTART:2026"); // no timed form
  });

  it("timed events keep the timed form", () => {
    const ics = eventToICS(ev({ allDay: false, start: "2026-07-16T19:00", end: "2026-07-16T22:00", multiDayEnd: null }), {
      now: new Date("2026-07-01T12:00:00Z"),
    });
    expect(ics).toContain("DTSTART:");
    expect(ics).not.toContain("VALUE=DATE");
  });
});
