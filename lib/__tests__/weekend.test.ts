import { describe, it, expect } from "vitest";
import { weekendDays, weekendLabel, dayHeading, selectWeekend } from "../weekend";
import { spansDay } from "../multiday";
import type { EventRecord } from "../types";

// Noon Chicago (17:00 UTC in July, CDT) — no midnight ambiguity in these anchors.
const WED = new Date("2026-07-15T17:00:00Z");
const FRI = new Date("2026-07-17T17:00:00Z");
const SAT = new Date("2026-07-18T17:00:00Z");
const SUN = new Date("2026-07-19T17:00:00Z");
const MON = new Date("2026-07-20T17:00:00Z");

function ev(overrides: Partial<EventRecord> = {}): EventRecord {
  return {
    id: Math.random().toString(36).slice(2),
    title: "Show", category: "music", venue: "V", address: "",
    city: "Minneapolis", lat: 44.9, lng: -93.2,
    start: "2026-07-17T20:00", end: "", price: "$20", priceTier: "$$",
    ticketUrl: "", description: "", image: "", sourceUrl: "",
    status: "published", multiDayEnd: null, allDay: false,
    ...overrides,
  };
}

describe("weekendDays — the weekend clock", () => {
  it("midweek points at the upcoming Fri–Sun", () => {
    expect(weekendDays(WED)).toEqual(["2026-07-17", "2026-07-18", "2026-07-19"]);
  });
  it("Friday: the weekend has begun — today counts", () => {
    expect(weekendDays(FRI)).toEqual(["2026-07-17", "2026-07-18", "2026-07-19"]);
  });
  it("Saturday: Friday is gone, tonight and Sunday remain", () => {
    expect(weekendDays(SAT)).toEqual(["2026-07-18", "2026-07-19"]);
  });
  it("Sunday: still the weekend until it isn't", () => {
    expect(weekendDays(SUN)).toEqual(["2026-07-19"]);
  });
  it("Monday flips to the NEXT weekend — never stale", () => {
    expect(weekendDays(MON)).toEqual(["2026-07-24", "2026-07-25", "2026-07-26"]);
  });
});

describe("labels", () => {
  it("weekendLabel: same month, month boundary, single day", () => {
    expect(weekendLabel(["2026-07-17", "2026-07-18", "2026-07-19"])).toBe("July 17–19");
    expect(weekendLabel(["2026-07-31", "2026-08-01", "2026-08-02"])).toBe("July 31 – August 2");
    expect(weekendLabel(["2026-07-19"])).toBe("July 19");
  });
  it("dayHeading", () => {
    expect(dayHeading("2026-07-17")).toBe("Friday, July 17");
  });
});

describe("selectWeekend — grouping without duplicate cards", () => {
  it("single-day events land in their day's section, sorted by time", () => {
    const events = [
      ev({ id: "sat-late", start: "2026-07-18T21:00" }),
      ev({ id: "fri", start: "2026-07-17T19:00" }),
      ev({ id: "sat-early", start: "2026-07-18T10:00" }),
      ev({ id: "monday-after", start: "2026-07-20T19:00" }), // not the weekend
    ];
    const out = selectWeekend(events, WED);
    expect(out.map((s) => s.key)).toEqual(["2026-07-17", "2026-07-18"]);
    expect(out[1].events.map((e) => e.id)).toEqual(["sat-early", "sat-late"]);
  });

  it("a run that started BEFORE the weekend goes to 'Happening all weekend' — once", () => {
    const fair = ev({ id: "fair", start: "2026-07-10T09:00", multiDayEnd: "2026-07-26T23:59", allDay: true });
    const out = selectWeekend([fair, ev({ id: "fri", start: "2026-07-17T19:00" })], WED);
    expect(out[0].key).toBe("ongoing");
    expect(out[0].heading).toBe("Happening all weekend");
    expect(out[0].events.map((e) => e.id)).toEqual(["fair"]);
    // ...and it does NOT also appear in the day sections:
    const dayIds = out.slice(1).flatMap((s) => s.events.map((e) => e.id));
    expect(dayIds).toEqual(["fri"]);
  });

  it("a multi-day run STARTING Friday sits in Friday's section (its card carries the run label)", () => {
    const run = ev({ id: "run", start: "2026-07-17T10:00", multiDayEnd: "2026-07-19T17:00" });
    const out = selectWeekend([run], WED);
    expect(out).toHaveLength(1);
    expect(out[0].key).toBe("2026-07-17");
  });

  it("on Saturday, a Friday-start run still in progress moves to 'all weekend' (Friday's section no longer exists)", () => {
    const run = ev({ id: "run", start: "2026-07-17T10:00", multiDayEnd: "2026-07-19T17:00" });
    const out = selectWeekend([run], SAT);
    expect(out[0].key).toBe("ongoing");
  });

  it("drafts/cancelled excluded; empty input → no sections", () => {
    expect(selectWeekend([ev({ status: "draft" })], WED)).toEqual([]);
    expect(selectWeekend([], WED)).toEqual([]);
  });
});

describe("selectWeekend — self-spanned runs past the cap (R1.5, rule 5)", () => {
  it("a 31-day exhibition spanned by its OWN end_at appears in the ongoing section", () => {
    // No multiDayEnd — the span source is the row's end_at, longer than
    // EXPAND_MAX_DAYS. The old code read the capped expansion, saw a
    // single-day event from Jul 1, and dropped it — while the this-weekend
    // ICS feed (spansDay) correctly included it. Page and feed now agree.
    const exhibition = ev({
      id: "expo",
      start: "2026-07-01T10:00",
      end: "2026-07-31T17:00",
      multiDayEnd: null,
    });
    const sections = selectWeekend([exhibition], WED);
    expect(sections).toHaveLength(1);
    expect(sections[0].key).toBe("ongoing");
    expect(sections[0].events.map((e) => e.id)).toEqual(["expo"]);
  });

  it("parity fixture: the same row passes feeds.ts spansDay for every weekend day", () => {
    const exhibition = ev({ id: "expo", start: "2026-07-01T10:00", end: "2026-07-31T17:00" });
    for (const day of weekendDays(WED)) {
      expect(spansDay(exhibition, day), `spansDay(${day})`).toBe(true);
    }
  });

  it("a run that truly ended before the weekend stays out", () => {
    const over = ev({ id: "over", start: "2026-07-01T10:00", end: "2026-07-10T17:00" });
    expect(selectWeekend([over], WED)).toEqual([]);
  });
});
