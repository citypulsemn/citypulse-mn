import { describe, it, expect } from "vitest";
import { dueWindows, weekIndex, HORIZON, type HorizonBand } from "../horizon";

describe("horizon windows", () => {
  // A Wednesday. weekIndex parity drives which bands are due.
  const base = new Date("2026-06-17T12:00:00Z");

  it("near band starts today and spans its configured length", () => {
    const near = dueWindows(base).find((w) => w.label === "near")!;
    expect(near.startDate).toBe("2026-06-17");
    expect(near.endDate).toBe("2026-07-08"); // +21 days
  });

  it("mid band picks up where near ends and reaches further out", () => {
    const mid = dueWindows(base).find((w) => w.label === "mid")!;
    expect(mid.startDate).toBe("2026-07-09"); // +22
    expect(mid.endDate).toBe("2026-08-16"); // +60
  });

  it("near and mid run every week; far runs every other week", () => {
    // Find an even-week and an odd-week date one week apart.
    let evenWeek = base;
    let oddWeek = new Date(base.getTime() + 7 * 86_400_000);
    if (weekIndex(evenWeek) % 2 !== 0) [evenWeek, oddWeek] = [oddWeek, evenWeek];

    const evenLabels = dueWindows(evenWeek).map((w) => w.label);
    const oddLabels = dueWindows(oddWeek).map((w) => w.label);

    expect(evenLabels).toContain("far"); // far runs on even weeks
    expect(oddLabels).not.toContain("far"); // …and skips odd weeks
    expect(oddLabels).toEqual(expect.arrayContaining(["near", "mid"])); // these always run
  });

  it("far band carries a smaller search budget than near", () => {
    const near = HORIZON.find((b) => b.label === "near")!;
    const far = HORIZON.find((b) => b.label === "far")!;
    expect(far.maxSearchUses).toBeLessThan(near.maxSearchUses);
  });

  it("respects a custom horizon definition", () => {
    const custom: HorizonBand[] = [
      { label: "only", startDay: 0, endDay: 7, maxSearchUses: 3, everyNWeeks: 1 },
    ];
    const w = dueWindows(base, custom);
    expect(w).toHaveLength(1);
    expect(w[0].endDate).toBe("2026-06-24");
  });
});
