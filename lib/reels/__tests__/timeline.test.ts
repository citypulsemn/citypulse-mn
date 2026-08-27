import { describe, it, expect } from "vitest";
import { buildTimeline } from "../timeline";

/*
 * Template math, in frames at 30fps: each slot shows 152 frames, consecutive
 * slots overlap by the 12-frame crossfade, so slot starts step by 140 frames
 * and total = n*152 - (n-1)*12. Seven clips: 7*152 - 6*12 = 1064 - 72 = 992
 * frames = 33.0667s — the published reels' template length.
 */

describe("buildTimeline", () => {
  it("default 7-clip timeline matches the published template exactly", () => {
    const t = buildTimeline();
    expect(t.fps).toBe(30);
    expect(t.fadeSec).toBe(12 / 30);
    expect(t.slots).toHaveLength(7);
    expect(t.slots.map((s) => s.index)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    // Slot i starts at i*140 frames.
    expect(t.slots.map((s) => s.startSec)).toEqual([
      0,
      140 / 30,
      280 / 30,
      14, // 420/30
      560 / 30,
      700 / 30,
      28, // 840/30
    ]);
    for (const s of t.slots) expect(s.durationSec).toBe(152 / 30);
    expect(t.totalSec).toBe(992 / 30);
    expect(t.totalSec).toBeCloseTo(33.0667, 3);
  });

  it("last slot's end coincides with the total (nothing dangling)", () => {
    const t = buildTimeline(7);
    const last = t.slots[t.slots.length - 1];
    expect(last.startSec + last.durationSec).toBeCloseTo(t.totalSec, 10);
  });

  it("total in frames is whole: 992 at 30fps", () => {
    expect(buildTimeline(7).totalSec * 30).toBeCloseTo(992, 8);
  });

  it("single clip: one slot, no crossfade, total = 152 frames", () => {
    const t = buildTimeline(1);
    expect(t.slots).toEqual([
      { index: 0, startSec: 0, durationSec: 152 / 30 },
    ]);
    expect(t.totalSec).toBe(152 / 30);
  });

  it("honest emptiness: zero or negative clip counts yield an empty timeline", () => {
    for (const n of [0, -3]) {
      const t = buildTimeline(n);
      expect(t.slots).toEqual([]);
      expect(t.totalSec).toBe(0);
      expect(t.fps).toBe(30);
    }
  });
});
