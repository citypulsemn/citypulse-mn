import { describe, it, expect } from "vitest";
import {
  assessCoverage,
  weekBuckets,
  weekStart,
  statusFor,
  formatCoverageAlerts,
  WEEKLY_FLOORS,
  type CoverageInput,
} from "../coverage";
import { CATEGORY_KEYS } from "../categories";
import type { CategoryKey } from "../types";

const NOW = new Date("2026-07-15T09:00:00-05:00"); // a Wednesday

/** n events of a category, spread inside the week starting `weekMonday`. */
function evs(category: CategoryKey, n: number, weekMonday: string): CoverageInput[] {
  return Array.from({ length: n }, (_, i) => ({
    category,
    start: `${weekMonday}T1${i % 9}:00`,
  }));
}

describe("weekStart / weekBuckets", () => {
  it("snaps to Monday", () => {
    expect(weekStart(NOW).getDay()).toBe(1); // Monday
    expect(weekStart(NOW).getDate()).toBe(13); // Mon Jul 13, 2026
  });

  it("treats Sunday as the end of the week, not the start", () => {
    const sunday = new Date("2026-07-19T12:00:00-05:00");
    expect(weekStart(sunday).getDate()).toBe(13); // same week as Wed Jul 15
  });

  it("produces consecutive, non-overlapping weeks", () => {
    const weeks = weekBuckets(NOW, 4);
    expect(weeks).toHaveLength(4);
    expect(weeks.map((w) => w.key)).toEqual([
      "2026-07-13",
      "2026-07-20",
      "2026-07-27",
      "2026-08-03",
    ]);
    for (let i = 1; i < weeks.length; i++) {
      expect(weeks[i].start.getTime()).toBeGreaterThan(weeks[i - 1].end.getTime());
    }
  });
});

describe("statusFor", () => {
  it("0 is empty, below floor is thin, at/above floor is ok", () => {
    expect(statusFor(0, 6)).toBe("empty");
    expect(statusFor(3, 6)).toBe("thin");
    expect(statusFor(6, 6)).toBe("ok");
    expect(statusFor(99, 6)).toBe("ok");
  });
});

describe("assessCoverage", () => {
  it("counts events into the right category × week cells", () => {
    const report = assessCoverage(
      [...evs("music", 7, "2026-07-13"), ...evs("music", 2, "2026-07-20")],
      NOW,
    );
    const wk1 = report.cells.find((c) => c.category === "music" && c.week === "2026-07-13")!;
    const wk2 = report.cells.find((c) => c.category === "music" && c.week === "2026-07-20")!;
    expect(wk1.count).toBe(7);
    expect(wk1.status).toBe("ok"); // floor 6
    expect(wk2.count).toBe(2);
    expect(wk2.status).toBe("thin");
  });

  it("ignores events outside the window and unparseable dates", () => {
    const report = assessCoverage(
      [
        ...evs("music", 6, "2026-07-13"),
        { category: "music", start: "2026-12-01T20:00" }, // far future
        { category: "music", start: "not-a-date" },
      ],
      NOW,
    );
    expect(report.totals.music).toBe(6);
  });

  it("builds a full grid — every category × every week", () => {
    const report = assessCoverage([], NOW, 4);
    expect(report.cells).toHaveLength(CATEGORY_KEYS.length * 4);
  });

  /**
   * THE REGRESSION THIS FEATURE EXISTS FOR. In July 2026 the live site had a
   * bloated Festivals bucket and a completely empty Live Music collection — and
   * nothing reported it. This asserts that exact shape now raises an alarm.
   */
  it("catches the real failure: festivals full, live music empty", () => {
    const report = assessCoverage(
      [
        ...evs("festival", 20, "2026-07-13"),
        ...evs("arts", 8, "2026-07-13"),
        // …and zero music.
      ],
      NOW,
      1,
    );

    expect(report.healthy).toBe(false);

    const music = report.alerts.find((a) => a.category === "music")!;
    expect(music).toBeDefined();
    expect(music.status).toBe("empty");
    expect(music.count).toBe(0);

    // Festivals being full must NOT mask the music hole.
    expect(report.alerts.some((a) => a.category === "festival")).toBe(false);
  });

  it("is healthy when every category meets its floor", () => {
    const events = CATEGORY_KEYS.flatMap((c) => evs(c, WEEKLY_FLOORS[c], "2026-07-13"));
    const report = assessCoverage(events, NOW, 1);
    expect(report.healthy).toBe(true);
    expect(report.alerts).toEqual([]);
  });

  it("sorts empties ahead of thins — the emergency first", () => {
    const report = assessCoverage(
      [
        ...evs("music", 1, "2026-07-13"), // thin (floor 6)
        // arts: 0 → empty
      ],
      NOW,
      1,
    );
    expect(report.alerts[0].status).toBe("empty");
    const statuses = report.alerts.map((a) => a.status);
    expect(statuses.indexOf("empty")).toBeLessThan(statuses.lastIndexOf("thin"));
  });
});

describe("formatCoverageAlerts", () => {
  it("reports a clean bill of health", () => {
    const events = CATEGORY_KEYS.flatMap((c) => evs(c, WEEKLY_FLOORS[c], "2026-07-13"));
    const lines = formatCoverageAlerts(assessCoverage(events, NOW, 1));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("meet their weekly floor");
  });

  it("names the empty category and the week", () => {
    const lines = formatCoverageAlerts(assessCoverage(evs("festival", 5, "2026-07-13"), NOW, 1));
    const musicLine = lines.find((l) => l.includes("Music"));
    expect(musicLine).toContain("EMPTY");
    expect(musicLine).toContain("0/6");
  });
});

describe("WEEKLY_FLOORS", () => {
  it("covers every category with a sane floor", () => {
    for (const c of CATEGORY_KEYS) {
      expect(WEEKLY_FLOORS[c]).toBeGreaterThan(0);
      expect(Number.isInteger(WEEKLY_FLOORS[c])).toBe(true);
    }
  });

  it("expects the most from music — it's the most-searched, least-aggregated category", () => {
    for (const c of CATEGORY_KEYS) {
      if (c === "music") continue;
      expect(WEEKLY_FLOORS.music).toBeGreaterThanOrEqual(WEEKLY_FLOORS[c]);
    }
  });
});
