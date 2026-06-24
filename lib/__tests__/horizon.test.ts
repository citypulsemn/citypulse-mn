import { describe, it, expect } from "vitest";
import { dueWindows, HORIZON, type HorizonBand } from "../horizon";

describe("horizon windows (3-month, all bands weekly)", () => {
  const base = new Date("2026-06-17T12:00:00Z"); // a Wednesday

  it("near band starts today and spans 30 days", () => {
    const near = dueWindows(base).find((w) => w.label === "near")!;
    expect(near.startDate).toBe("2026-06-17");
    expect(near.endDate).toBe("2026-07-17"); // +30
  });

  it("mid band picks up where near ends", () => {
    const mid = dueWindows(base).find((w) => w.label === "mid")!;
    expect(mid.startDate).toBe("2026-07-18"); // +31
    expect(mid.endDate).toBe("2026-08-16"); // +60
  });

  it("far band reaches ~3 months out", () => {
    const far = dueWindows(base).find((w) => w.label === "far")!;
    expect(far.startDate).toBe("2026-08-17"); // +61
    expect(far.endDate).toBe("2026-09-17"); // +92
  });

  it("all three bands run EVERY week (no skipped weeks)", () => {
    const wk1 = dueWindows(base).map((w) => w.label);
    const wk2 = dueWindows(new Date(base.getTime() + 7 * 86_400_000)).map((w) => w.label);
    expect(wk1).toEqual(["near", "mid", "far"]);
    expect(wk2).toEqual(["near", "mid", "far"]);
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
