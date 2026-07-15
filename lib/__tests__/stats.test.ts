import { describe, it, expect } from "vitest";
import {
  parseBeacon,
  ctr,
  shapeDaily,
  STAT_ACTIONS,
  BEACON_ACTIONS,
  type DailyRow,
} from "../stats";

const UUID = "1d87aa63-e89d-42d2-9944-54fa593f1fa9"; // shape of a real event id

describe("parseBeacon — the public surface", () => {
  it("accepts the three public actions with a valid UUID", () => {
    for (const action of BEACON_ACTIONS) {
      expect(parseBeacon({ id: UUID, action })).toEqual({ id: UUID, action });
    }
  });

  /**
   * THE ASYMMETRY THAT MATTERS: 'save' is a real stat action but is NOT
   * accepted from the public beacon — it's counted only inside the save
   * server-action. Otherwise the one metric tied to real user state could be
   * inflated with a curl loop.
   */
  it("rejects 'save' even though it's a valid stat action", () => {
    expect(STAT_ACTIONS).toContain("save");
    expect(parseBeacon({ id: UUID, action: "save" })).toBeNull();
  });

  it("rejects everything that isn't exactly a UUID + allow-listed action", () => {
    expect(parseBeacon({ id: "1 OR 1=1", action: "view" })).toBeNull();
    expect(parseBeacon({ id: UUID.slice(0, 20), action: "view" })).toBeNull();
    expect(parseBeacon({ id: UUID, action: "views" })).toBeNull();
    expect(parseBeacon({ id: UUID, action: "" })).toBeNull();
    expect(parseBeacon({ action: "view" })).toBeNull();
    expect(parseBeacon("view")).toBeNull();
    expect(parseBeacon(null)).toBeNull();
    expect(parseBeacon([UUID, "view"])).toBeNull();
  });

  it("ignores extra properties rather than failing on them", () => {
    expect(parseBeacon({ id: UUID, action: "view", junk: 1, nested: {} })).toEqual({
      id: UUID,
      action: "view",
    });
  });

  it("trims whitespace around the id but accepts nothing else non-canonical", () => {
    expect(parseBeacon({ id: `  ${UUID}  `, action: "view" })).toEqual({ id: UUID, action: "view" });
    expect(parseBeacon({ id: UUID.toUpperCase(), action: "view" })).toEqual({
      id: UUID.toUpperCase(),
      action: "view",
    }); // UUIDs are case-insensitive
  });
});

describe("ctr", () => {
  it("computes a whole-percent CTR and guards division by zero", () => {
    expect(ctr(200, 30)).toBe(15);
    expect(ctr(3, 1)).toBe(33);
    expect(ctr(0, 5)).toBe(0);
    expect(ctr(-1, 5)).toBe(0);
  });
});

describe("shapeDaily", () => {
  it("pivots (day, action, n) rows into one row per day, newest first", () => {
    const rows: DailyRow[] = [
      { day: "2026-07-14", action: "view", n: 120 },
      { day: "2026-07-14", action: "ticket_click", n: 18 },
      { day: "2026-07-15", action: "view", n: 80 },
      { day: "2026-07-15", action: "save", n: 6 },
      { day: "2026-07-15", action: "calendar", n: 4 },
    ];
    const out = shapeDaily(rows);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ day: "2026-07-15", view: 80, ticket_click: 0, save: 6, calendar: 4 });
    expect(out[1]).toEqual({ day: "2026-07-14", view: 120, ticket_click: 18, save: 0, calendar: 0 });
  });

  it("handles empty input", () => {
    expect(shapeDaily([])).toEqual([]);
  });
});
