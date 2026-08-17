import { describe, it, expect } from "vitest";
import { dueWindows, HORIZON, type HorizonBand } from "../horizon";

// All-weekly view of the real bands, so the date-MATH assertions below don't
// depend on which cadence phase `base` happens to land in.
const allWeekly = HORIZON.map((b) => ({ ...b, everyNWeeks: 1 }));

// Noon Thursday of epoch-week `w`, so weekIndex(weekDate(w)) === w exactly —
// lets the cadence test hit specific week indices deterministically.
function weekDate(w: number): Date {
  return new Date(w * 7 * 86_400_000 + 12 * 3_600_000);
}

describe("horizon windows — date math (3-month reach)", () => {
  const base = new Date("2026-06-17T12:00:00Z"); // a Wednesday

  it("near band starts today and spans 30 days", () => {
    const near = dueWindows(base, allWeekly).find((w) => w.label === "near")!;
    expect(near.startDate).toBe("2026-06-17");
    expect(near.endDate).toBe("2026-07-17"); // +30
  });

  it("mid band picks up where near ends", () => {
    const mid = dueWindows(base, allWeekly).find((w) => w.label === "mid")!;
    expect(mid.startDate).toBe("2026-07-18"); // +31
    expect(mid.endDate).toBe("2026-08-16"); // +60
  });

  it("far band reaches ~3 months out", () => {
    const far = dueWindows(base, allWeekly).find((w) => w.label === "far")!;
    expect(far.startDate).toBe("2026-08-17"); // +61
    expect(far.endDate).toBe("2026-09-17"); // +92
  });

  it("search depth tapers from near to far", () => {
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

describe("horizon cadence — staggered to cut API cost (Aug 2026)", () => {
  const labelsAt = (w: number) => dueWindows(weekDate(w)).map((x) => x.label);

  it("near weekly, mid every 2nd week, far every 3rd — over a full 6-week cycle", () => {
    expect(labelsAt(0)).toEqual(["near", "mid", "far"]); // 0 % 2 === 0, 0 % 3 === 0
    expect(labelsAt(1)).toEqual(["near"]);
    expect(labelsAt(2)).toEqual(["near", "mid"]);
    expect(labelsAt(3)).toEqual(["near", "far"]);
    expect(labelsAt(4)).toEqual(["near", "mid"]);
    expect(labelsAt(5)).toEqual(["near"]);
    expect(labelsAt(6)).toEqual(["near", "mid", "far"]); // cycle repeats
  });

  it("near ALWAYS runs — no week is left without a fresh 0–30d pass", () => {
    for (let w = 0; w < 20; w++) {
      expect(dueWindows(weekDate(w)).some((x) => x.label === "near"), `week ${w}`).toBe(true);
    }
  });

  it("averages ~12.8 generic bands/week vs 21 (the cost win), over 6 weeks", () => {
    let total = 0;
    for (let w = 0; w < 6; w++) total += dueWindows(weekDate(w)).length;
    // near×6 + mid×3 + far×2 = 11 band-runs over 6 weeks = ~1.83 bands/run.
    expect(total).toBe(11);
  });
});
