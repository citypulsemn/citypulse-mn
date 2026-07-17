import { describe, it, expect } from "vitest";
import { selectOngoing, throughLabel, ONGOING_CAP } from "../ongoing";
import type { EventRecord } from "../types";

// Noon Chicago, Monday Jul 20 2026
const NOW = new Date("2026-07-20T17:00:00Z");

let seq = 0;
function ev(overrides: Partial<EventRecord> = {}): EventRecord {
  seq += 1;
  return {
    id: `e${seq}`,
    title: "Run", category: "arts", venue: "V", address: "",
    city: "Minneapolis", lat: 44.9, lng: -93.2,
    start: "2026-07-10T10:00", end: "", price: "$10", priceTier: "$",
    ticketUrl: "", description: "", image: "", sourceUrl: "",
    status: "published", multiDayEnd: "2026-07-26T17:00", allDay: false,
    ...overrides,
  };
}

describe("selectOngoing — boundary days", () => {
  it("ends today → included, labeled 'Last day today'", () => {
    const out = selectOngoing([ev({ multiDayEnd: "2026-07-20T17:00" })], NOW);
    expect(out).toHaveLength(1);
    expect(throughLabel(out[0].endDay, NOW)).toBe("Last day today");
  });
  it("ended yesterday → out", () => {
    expect(selectOngoing([ev({ multiDayEnd: "2026-07-19T17:00" })], NOW)).toHaveLength(0);
  });
  it("starts today → out (today's calendar, not the ongoing shelf)", () => {
    expect(
      selectOngoing([ev({ start: "2026-07-20T10:00", multiDayEnd: "2026-07-30T17:00" })], NOW),
    ).toHaveLength(0);
  });
  it("starts tomorrow → out", () => {
    expect(
      selectOngoing([ev({ start: "2026-07-21T10:00", multiDayEnd: "2026-07-30T17:00" })], NOW),
    ).toHaveLength(0);
  });
});

describe("selectOngoing — the >3-day floor", () => {
  it("a Fri–Sun run (3 days) is a weekend thing, not ongoing", () => {
    expect(
      selectOngoing([ev({ start: "2026-07-17T10:00", multiDayEnd: "2026-07-19T17:00" })],
        new Date("2026-07-18T17:00:00Z")),
    ).toHaveLength(0);
  });
  it("a 4-day run qualifies", () => {
    expect(
      selectOngoing([ev({ start: "2026-07-17T10:00", multiDayEnd: "2026-07-20T17:00" })], NOW),
    ).toHaveLength(1);
  });
  it("single-day events never qualify", () => {
    expect(selectOngoing([ev({ multiDayEnd: null, start: "2026-07-19T10:00" })], NOW)).toHaveLength(0);
  });
});

describe("selectOngoing — the true-span rule (the weekend-page regression)", () => {
  it("a 17-day fair mid-run IS ongoing — spanEnd, never the capped daysSpanned", () => {
    const fair = ev({ start: "2026-07-10T09:00", multiDayEnd: "2026-07-26T23:59", allDay: true });
    const out = selectOngoing([fair], NOW);
    expect(out).toHaveLength(1);
    expect(out[0].endDay).toBe("2026-07-26");
  });
  it("a late-night show (ends 1 AM next day) is NOT a run", () => {
    const show = ev({ start: "2026-07-19T21:00", multiDayEnd: null, end: "2026-07-20T01:00" });
    expect(selectOngoing([show], NOW)).toHaveLength(0);
  });
});

describe("selectOngoing — order and cap", () => {
  it("ending soonest first — last chance is the editorial angle", () => {
    const out = selectOngoing(
      [
        ev({ id: "november", multiDayEnd: "2026-11-01T17:00" }),
        ev({ id: "sunday", multiDayEnd: "2026-07-26T17:00" }),
        ev({ id: "friday", multiDayEnd: "2026-07-24T17:00" }),
      ],
      NOW,
    );
    expect(out.map((o) => o.event.id)).toEqual(["friday", "sunday", "november"]);
  });
  it(`caps at ${ONGOING_CAP}`, () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      ev({ multiDayEnd: `2026-08-${String(i + 1).padStart(2, "0")}T17:00` }),
    );
    expect(selectOngoing(many, NOW)).toHaveLength(ONGOING_CAP);
  });
  it("drafts excluded", () => {
    expect(selectOngoing([ev({ status: "draft" })], NOW)).toHaveLength(0);
  });
});

describe("throughLabel", () => {
  it("formats the closing date", () => {
    expect(throughLabel("2026-08-02", NOW)).toBe("Through Aug 2");
  });
});
