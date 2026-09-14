import { describe, it, expect } from "vitest";
import {
  judgeUsage,
  judgeCron,
  judgeDelivery,
  worstStatus,
  needsAttention,
  formatBytes,
  formatDuration,
  unknownTile,
  summarise,
  withDeadline,
  type VendorTile,
} from "../vendor-health";

const NOW = new Date("2026-09-13T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

/**
 * The whole point of this file is the last describe block. Everything above it
 * is ordinary threshold arithmetic; the thing that has actually bitten this
 * project is a probe that could not run rendering as if all were well.
 */

describe("judgeUsage — a metered resource against its plan", () => {
  it("is green with headroom, amber near the cliff, red past it", () => {
    expect(judgeUsage(1, 5)).toBe("ok"); // 20%
    expect(judgeUsage(3.9, 5)).toBe("ok"); // 78%
    expect(judgeUsage(4, 5)).toBe("warn"); // exactly 80%
    expect(judgeUsage(4.9, 5)).toBe("warn");
    expect(judgeUsage(5, 5)).toBe("down"); // exactly at the limit
    expect(judgeUsage(6, 5)).toBe("down");
  });

  it("reproduces the Vercel CPU overage that was never on a screen", () => {
    // 4h16m against a 4h limit — the real reading from Aug 2026.
    expect(judgeUsage(4 * 60 + 16, 4 * 60)).toBe("down");
  });

  it("takes custom thresholds", () => {
    expect(judgeUsage(5, 10, { warnAt: 0.5 })).toBe("warn");
    expect(judgeUsage(9, 10, { warnAt: 0.5, downAt: 0.9 })).toBe("down");
  });

  it("refuses to judge what it cannot measure", () => {
    for (const [u, l] of [
      [null, 5],
      [5, null],
      [undefined, undefined],
      [NaN, 5],
      [5, NaN],
      [5, 0], // a zero limit says nothing about headroom
      [5, -1],
      [-1, 5], // negative usage is a broken reading
    ] as [number | null | undefined, number | null | undefined][]) {
      expect(judgeUsage(u, l), `${u} / ${l}`).toBe("unknown");
    }
  });
});

describe("judgeCron — did the scheduled job actually fire, and pass", () => {
  const WEEK = 24 * 7;

  it("is green for a recent successful run", () => {
    expect(judgeCron(hoursAgo(2), true, WEEK, NOW)).toBe("ok");
    expect(judgeCron(hoursAgo(24 * 6), true, WEEK, NOW)).toBe("ok");
  });

  it("goes amber when the run is late", () => {
    expect(judgeCron(hoursAgo(WEEK * 1.3), true, WEEK, NOW)).toBe("warn");
  });

  it("goes red when two periods have passed — it is not coming", () => {
    // The failure that matters: GitHub drops ~60% of scheduled runs, and a
    // pipeline that never fired looks exactly like a quiet week.
    expect(judgeCron(hoursAgo(WEEK * 2.1), true, WEEK, NOW)).toBe("down");
  });

  it("goes red when it fired and failed, however recently", () => {
    expect(judgeCron(hoursAgo(1), false, WEEK, NOW)).toBe("down");
  });

  it("is unknown when there is no run to look at, or the timestamp is junk", () => {
    for (const t of [null, undefined, "", "last Tuesday", "2026-13-99T99:99"]) {
      expect(judgeCron(t, true, WEEK, NOW), String(t)).toBe("unknown");
    }
  });

  it("is unknown when it ran recently but we cannot tell whether it passed", () => {
    // A green tile here would claim a pass we never observed.
    expect(judgeCron(hoursAgo(2), null, WEEK, NOW)).toBe("unknown");
    expect(judgeCron(hoursAgo(2), undefined, WEEK, NOW)).toBe("unknown");
  });

  it("treats a run from the future as a clock problem, not health", () => {
    expect(judgeCron(new Date(NOW.getTime() + 5 * 3_600_000).toISOString(), true, WEEK, NOW)).toBe(
      "unknown",
    );
  });
});

describe("judgeDelivery — the weekly email is the retention asset", () => {
  it("is green on a clean send and escalates with the bounce rate", () => {
    expect(judgeDelivery(100, 0)).toBe("ok");
    expect(judgeDelivery(100, 1)).toBe("ok"); // 1%
    expect(judgeDelivery(100, 2)).toBe("warn"); // 2%
    expect(judgeDelivery(100, 5)).toBe("down"); // 5%
    expect(judgeDelivery(100, 90)).toBe("down");
  });

  it("treats nothing-sent as unknown, never as healthy", () => {
    // Zero sent with zero bounced is a 0% bounce rate arithmetically, and that
    // is exactly the reasoning that would have called a dead sender healthy.
    expect(judgeDelivery(0, 0)).toBe("unknown");
  });

  it("refuses impossible or missing readings", () => {
    for (const [s, b] of [
      [null, 0],
      [10, null],
      [-1, 0],
      [10, -1],
      [NaN, 0],
    ] as [number | null, number | null][]) {
      expect(judgeDelivery(s, b), `${s}/${b}`).toBe("unknown");
    }
  });
});

describe("worstStatus and needsAttention", () => {
  const t = (status: VendorTile["status"]): VendorTile => ({
    service: "x",
    status,
    headline: "h",
    detail: "d",
    link: "#",
  });

  it("picks the worst in the set", () => {
    expect(worstStatus([t("ok"), t("warn"), t("ok")])).toBe("warn");
    expect(worstStatus([t("warn"), t("down")])).toBe("down");
    expect(worstStatus([t("ok"), t("unknown")])).toBe("unknown");
    expect(worstStatus([t("ok"), t("ok")])).toBe("ok");
  });

  it("ranks a real failure above an unreadable probe", () => {
    // Both need a look, but a known outage is more urgent than a blind spot.
    expect(worstStatus([t("unknown"), t("down")])).toBe("down");
    expect(worstStatus([t("unknown"), t("warn")])).toBe("warn");
  });

  it("calls an empty set unknown, not healthy", () => {
    expect(worstStatus([])).toBe("unknown");
  });

  it("counts unknown as needing attention", () => {
    expect(needsAttention("unknown")).toBe(true);
    expect(needsAttention("down")).toBe(true);
    expect(needsAttention("warn")).toBe(true);
    expect(needsAttention("ok")).toBe(false);
  });
});

describe("a probe that could not run is never green", () => {
  it("builds an unknown tile that says why", () => {
    const tile = unknownTile("Vercel", "VERCEL_API_TOKEN is not set", "https://vercel.com");
    expect(tile.status).toBe("unknown");
    expect(tile.detail).toMatch(/not set/);
    expect(needsAttention(tile.status)).toBe(true);
  });

  it("still says something when the reason is blank", () => {
    // An empty detail would render an empty line, which reads as "fine".
    expect(unknownTile("Resend", "", "#").detail.length).toBeGreaterThan(0);
  });

  it("keeps unknown tiles out of the all-green summary", () => {
    const tiles: VendorTile[] = [
      { service: "GitHub", status: "ok", headline: "ran 2h ago", detail: "", link: "#" },
      { service: "Vercel", status: "unknown", headline: "not reported", detail: "no token", link: "#" },
    ];
    expect(summarise(tiles)).toMatch(/1 of 2 need a look/);
    expect(summarise(tiles)).toContain("Vercel");
    expect(summarise(tiles)).not.toMatch(/all green/);
  });

  it("says all green only when every tile really is", () => {
    const ok: VendorTile = { service: "a", status: "ok", headline: "h", detail: "d", link: "#" };
    expect(summarise([ok, { ...ok, service: "b" }])).toMatch(/✅ all 2 services green/);
  });

  it("does not claim health when nothing is configured at all", () => {
    expect(summarise([])).toMatch(/no vendor checks configured/);
    expect(summarise([])).not.toMatch(/green/);
  });

  it("names the worst service first so the summary is actionable", () => {
    const tiles: VendorTile[] = [
      { service: "Resend", status: "warn", headline: "", detail: "", link: "#" },
      { service: "Supabase", status: "down", headline: "", detail: "", link: "#" },
    ];
    expect(summarise(tiles)).toContain("Supabase, Resend");
  });
});

describe("formatters", () => {
  it("formats bytes at a readable precision", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(5 * 1024 ** 3)).toBe("5.0 GB");
    expect(formatBytes(12.5 * 1024 ** 3)).toBe("13 GB");
  });

  it("formats durations the way a usage page does", () => {
    expect(formatDuration(256)).toBe("4h 16m");
    expect(formatDuration(59)).toBe("59m");
    expect(formatDuration(60)).toBe("1h 0m");
  });

  it("shows an em dash rather than a fake zero for a missing reading", () => {
    for (const v of [null, undefined, NaN, -1]) {
      expect(formatBytes(v), String(v)).toBe("—");
      expect(formatDuration(v), String(v)).toBe("—");
    }
  });
});

describe("withDeadline — nothing may spin forever", () => {
  it("returns the real answer when it arrives in time", async () => {
    await expect(withDeadline(Promise.resolve("real"), 50, "fallback")).resolves.toBe("real");
  });

  it("returns the fallback when the work overruns", async () => {
    const slow = new Promise<string>((r) => setTimeout(() => r("too late"), 200));
    await expect(withDeadline(slow, 20, "fallback")).resolves.toBe("fallback");
  });

  it("still rejects if the work itself fails — the caller decides what that means", async () => {
    await expect(withDeadline(Promise.reject(new Error("boom")), 50, "fallback")).rejects.toThrow("boom");
  });

  it("does not wait out the deadline when the work is already done", async () => {
    // A leaked timer keeps a serverless function alive past its response. The
    // first version of this test counted process listeners, which is global
    // state other test files mutate in parallel — it went red once under load
    // and green on the next three runs, which is exactly the shape of a test
    // that teaches you to ignore red. Elapsed time is the property that
    // actually matters and it is local to this call.
    const t0 = Date.now();
    await withDeadline(Promise.resolve(1), 10_000, 0);
    expect(Date.now() - t0).toBeLessThan(1_000);
  });
});
