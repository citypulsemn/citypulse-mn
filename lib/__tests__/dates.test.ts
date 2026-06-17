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

  it("weekend rolls to the upcoming Fri–Sun (Jun 19–21) since now is Sunday", () => {
    const w = rangeWindow(NOW, view("weekend"));
    expect(dkey(w.start)).toBe("2026-06-19");
    expect(dkey(w.end)).toBe("2026-06-21");
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

  it("weekend = 8 events, all on Jun 19–21", () => {
    const ids = idsFor("weekend");
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
  const w = rangeWindow(NOW, view("weekend"));
  it("June 14 is out of range", () => {
    expect(classifyDay(2026, 5, 14, w)).toBe("outrange");
  });
  it("June 19 and 21 are in range", () => {
    expect(classifyDay(2026, 5, 19, w)).toBe("inrange");
    expect(classifyDay(2026, 5, 21, w)).toBe("inrange");
  });
  it("June 22 is out of range", () => {
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
