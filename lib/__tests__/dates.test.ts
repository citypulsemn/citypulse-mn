import { describe, it, expect } from "vitest";
import {
  rangeWindow,
  eventsInWindow,
  classifyDay,
  isFocus,
  dkey,
} from "../dates";
import { sampleEvents } from "../sample-events";
import { CATEGORY_KEYS } from "../categories";
import type { CategoryKey, ViewState } from "../types";

// Deterministic "now": Sunday, June 14, 2026, noon.
const NOW = new Date("2026-06-14T12:00:00");
const ALL = new Set<CategoryKey>(CATEGORY_KEYS);
const view = (range: ViewState["range"]): ViewState => ({
  range,
  year: 2026,
  month: 5, // June
});

const idsFor = (range: ViewState["range"]) =>
  eventsInWindow(sampleEvents, ALL, rangeWindow(NOW, view(range)))
    .map((e) => Number(e.id))
    .sort((a, b) => a - b);

describe("rangeWindow", () => {
  it("NOW is a Sunday", () => {
    expect(NOW.getDay()).toBe(0);
  });

  it("today = just June 14", () => {
    const w = rangeWindow(NOW, view("today"));
    expect(dkey(w.start)).toBe("2026-06-14");
    expect(dkey(w.end)).toBe("2026-06-14");
  });

  it("weekend on a Sunday is STILL this weekend (today only) — aligned with /this-weekend (R1.7)", () => {
    // Taren's call, Jul 20: one weekend philosophy everywhere. A Sunday tap
    // on "Weekend" means tonight; past Fri/Sat are clipped as always.
    const w = rangeWindow(NOW, view("weekend"));
    expect(dkey(w.start)).toBe("2026-06-14");
    expect(dkey(w.end)).toBe("2026-06-14");
  });

  it("week = today through +6 days (Jun 14–20)", () => {
    const w = rangeWindow(NOW, view("week"));
    expect(dkey(w.start)).toBe("2026-06-14");
    expect(dkey(w.end)).toBe("2026-06-20");
  });

  it("month = full June", () => {
    const w = rangeWindow(NOW, view("month"));
    expect(dkey(w.start)).toBe("2026-06-01");
    expect(dkey(w.end)).toBe("2026-06-30");
  });

  it("weekend on a Wednesday points forward to that week's Fri–Sun", () => {
    const wed = new Date("2026-06-17T12:00:00"); // Wednesday
    const w = rangeWindow(wed, { range: "weekend", year: 2026, month: 5 });
    expect(dkey(w.start)).toBe("2026-06-19");
    expect(dkey(w.end)).toBe("2026-06-21");
  });
});

describe("eventsInWindow (sample data)", () => {
  it("today = ids 1,2,3", () => {
    expect(idsFor("today")).toEqual([1, 2, 3]);
  });

  it("weekend from Sunday = today's events only (R1.7 alignment)", () => {
    expect(idsFor("weekend")).toEqual(idsFor("today"));
  });

  it("weekend from a Wednesday = 8 events, all on Jun 19–21", () => {
    const wed = new Date("2026-06-17T12:00:00");
    const ids = eventsInWindow(sampleEvents, ALL, rangeWindow(wed, view("weekend")))
      .map((e) => Number(e.id))
      .sort((a, b) => a - b);
    expect(ids.length).toBe(8);
    for (const id of ids) {
      const ev = sampleEvents.find((e) => Number(e.id) === id)!;
      expect([19, 20, 21]).toContain(new Date(ev.start).getDate());
    }
  });

  it("week = 15 events, all within Jun 14–20", () => {
    const ids = idsFor("week");
    expect(ids.length).toBe(15);
    for (const id of ids) {
      const d = new Date(sampleEvents.find((e) => Number(e.id) === id)!.start);
      expect(d.getMonth()).toBe(5);
      expect(d.getDate()).toBeGreaterThanOrEqual(14);
      expect(d.getDate()).toBeLessThanOrEqual(20);
    }
  });

  it("month = the full dataset", () => {
    expect(idsFor("month").length).toBe(sampleEvents.length);
  });

  it("today is a subset of week", () => {
    const week = new Set(idsFor("week"));
    expect(idsFor("today").every((id) => week.has(id))).toBe(true);
  });

  it("category filter narrows results", () => {
    const onlySports = new Set<CategoryKey>(["sports"]);
    const w = rangeWindow(NOW, view("month"));
    const evs = eventsInWindow(sampleEvents, onlySports, w);
    expect(evs.length).toBeGreaterThan(0);
    expect(evs.every((e) => e.category === "sports")).toBe(true);
  });
});

describe("spotlight classification (weekend window)", () => {
  it("Sunday's weekend window spotlights today only (R1.7 alignment)", () => {
    const w = rangeWindow(NOW, view("weekend"));
    expect(classifyDay(2026, 5, 13, w)).toBe("outrange");
    expect(classifyDay(2026, 5, 14, w)).toBe("inrange");
    expect(classifyDay(2026, 5, 15, w)).toBe("outrange");
  });
  it("a mid-week window spotlights the coming Fri–Sun and nothing beyond", () => {
    const w = rangeWindow(new Date("2026-06-17T12:00:00"), view("weekend"));
    expect(classifyDay(2026, 5, 18, w)).toBe("outrange");
    expect(classifyDay(2026, 5, 19, w)).toBe("inrange");
    expect(classifyDay(2026, 5, 21, w)).toBe("inrange");
    expect(classifyDay(2026, 5, 22, w)).toBe("outrange");
  });
});

describe("isFocus", () => {
  it("month is neutral, others focus", () => {
    expect(isFocus("month")).toBe(false);
    expect(isFocus("today")).toBe(true);
    expect(isFocus("weekend")).toBe(true);
    expect(isFocus("week")).toBe(true);
  });
});
