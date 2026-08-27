import { describe, it, expect } from "vitest";
import { isoWeekNumber, buildWeekWindow, defaultPostDay } from "../keys";

// No offset suffix => parsed as LOCAL time, matching what the runner passes.
// Noon keeps the calendar day stable regardless of the machine's timezone.
const local = (ymd: string) => new Date(`${ymd}T12:00:00`);

/*
 * Golden derivations (all by hand, from known anchors):
 *
 * 2026-01-01 is a Thursday (2024-01-01 Mon; +366 leap => 2025 Wed; +365 => Thu).
 * Because Jan 1 falls on a Thursday, 2026 is a 53-week ISO year, and ISO
 * week 1 of 2026 runs Mon 2025-12-29 .. Sun 2026-01-04.
 *
 * 2026-08-24: day-of-year 236 (31+28+31+30+31+30+31+24). (236-1) % 7 = 4,
 * Thu + 4 = Monday. Days since Mon 2025-12-29 = 3 + 235 = 238 = 34 weeks
 * exactly => week 1 + 34 = week 35.
 *
 * 2026-12-28: day-of-year 362. (362-1) % 7 = 4 => Monday. Its Thursday is
 * 2026-12-31, still in 2026 => week 53 (the last week of the 53-week year).
 *
 * 2027-01-01: Thu + 365 % 7 = Friday. Its week's Thursday is 2026-12-31,
 * so it still belongs to 2026's week 53. 2027-01-04 is the first Monday
 * of 2027 => week 1.
 */

describe("isoWeekNumber", () => {
  it("anchor sanity: the golden dates fall on the weekdays derived above", () => {
    expect(local("2026-01-01").getDay()).toBe(4); // Thursday
    expect(local("2026-08-24").getDay()).toBe(1); // Monday
    expect(local("2025-12-29").getDay()).toBe(1); // Monday
    expect(local("2026-12-28").getDay()).toBe(1); // Monday
    expect(local("2027-01-01").getDay()).toBe(5); // Friday
  });

  it("2026-08-24 (Monday) is week 35", () => {
    expect(isoWeekNumber(local("2026-08-24"))).toBe(35);
  });

  it("mid-week and Sunday of the same ISO week share the number", () => {
    expect(isoWeekNumber(local("2026-08-26"))).toBe(35); // Wednesday
    expect(isoWeekNumber(local("2026-08-30"))).toBe(35); // Sunday, still week 35
  });

  it("late December can be week 1 of the NEXT year", () => {
    // Mon 2025-12-29 opens the week containing Thu 2026-01-01.
    expect(isoWeekNumber(local("2025-12-29"))).toBe(1);
    expect(isoWeekNumber(local("2025-12-31"))).toBe(1);
  });

  it("early January can be week 53 of the PRIOR year", () => {
    // Fri 2027-01-01 sits in the week whose Thursday is 2026-12-31.
    expect(isoWeekNumber(local("2027-01-01"))).toBe(53);
    expect(isoWeekNumber(local("2026-12-28"))).toBe(53);
    // First Monday of 2027 starts week 1.
    expect(isoWeekNumber(local("2027-01-04"))).toBe(1);
  });
});

describe("buildWeekWindow", () => {
  it("monday window from a Wednesday covers Mon–Fri of that week", () => {
    const w = buildWeekWindow(local("2026-08-26"), "monday");
    expect(w).toEqual({
      postDay: "monday",
      start: "2026-08-24",
      end: "2026-08-28",
      isoWeek: 35,
      shotTypeKey: 3, // 35 % 4
      audioLane: 2, // 35 % 3
    });
  });

  it("friday window from the same Wednesday covers Sat–Sun of that week", () => {
    const w = buildWeekWindow(local("2026-08-26"), "friday");
    expect(w.start).toBe("2026-08-29");
    expect(w.end).toBe("2026-08-30");
    expect(w.isoWeek).toBe(35);
  });

  it("run ON the posting Monday: the window starts today", () => {
    const w = buildWeekWindow(local("2026-08-24"), "monday");
    expect(w.start).toBe("2026-08-24");
    expect(w.end).toBe("2026-08-28");
  });

  it("Sunday still belongs to the CURRENT ISO week, not the next", () => {
    const w = buildWeekWindow(local("2026-08-30"), "friday");
    expect(w.start).toBe("2026-08-29");
    expect(w.end).toBe("2026-08-30"); // today is the window's last day
    expect(w.isoWeek).toBe(35);
  });

  it("year boundary: monday window can span December into January", () => {
    const w = buildWeekWindow(local("2027-01-01"), "monday");
    expect(w.start).toBe("2026-12-28");
    expect(w.end).toBe("2027-01-01");
    expect(w.isoWeek).toBe(53);
    expect(w.shotTypeKey).toBe(1); // 53 % 4
    expect(w.audioLane).toBe(2); // 53 % 3
  });

  it("year boundary: friday window lands fully in the new year", () => {
    const w = buildWeekWindow(local("2027-01-01"), "friday");
    expect(w.start).toBe("2027-01-02");
    expect(w.end).toBe("2027-01-03");
    expect(w.isoWeek).toBe(53); // keyed from the week's Monday, 2026-12-28
  });
});

describe("defaultPostDay", () => {
  it("Fri/Sat/Sun prepare the weekend reel", () => {
    expect(defaultPostDay(local("2026-08-28"))).toBe("friday"); // Friday
    expect(defaultPostDay(local("2026-08-29"))).toBe("friday"); // Saturday
    expect(defaultPostDay(local("2026-08-30"))).toBe("friday"); // Sunday
  });

  it("Mon–Thu prepare the weekday reel", () => {
    expect(defaultPostDay(local("2026-08-24"))).toBe("monday"); // Monday
    expect(defaultPostDay(local("2026-08-26"))).toBe("monday"); // Wednesday
    expect(defaultPostDay(local("2026-08-27"))).toBe("monday"); // Thursday
  });
});
