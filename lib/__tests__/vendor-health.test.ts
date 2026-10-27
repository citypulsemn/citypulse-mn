import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  judgeUsage,
  judgeSourceSweep,
  parseStampMs,
  lastDueAt,
  sweepsMissed,
  expectedPages,
  type SourceSweepHealth,
  judgeCron,
  judgeDigest,
  worstStatus,
  needsAttention,
  formatBytes,
  formatDuration,
  unknownTile,
  summarise,
  withDeadline,
  judgeCostCoverage,
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

describe("judgeDigest — the weekly email is the retention asset", () => {
  const STALE = 8; // the email's own DIGEST_STALE_DAYS

  it("is green through a normal week", () => {
    // Thursday send, Monday report: a healthy week reads 4 days.
    for (const d of [0, 1, 4, 5]) expect(judgeDigest(d, false, STALE), `${d}d`).toBe("ok");
  });

  it("goes amber on the shoulder, when a send is about due", () => {
    expect(judgeDigest(6, false, STALE)).toBe("warn");
    expect(judgeDigest(7, false, STALE)).toBe("warn");
  });

  it("goes red once a Thursday has actually been missed", () => {
    // The real 6 Aug 2026 miss read 11 days by the following Monday.
    for (const d of [8, 11, 30]) expect(judgeDigest(d, false, STALE), `${d}d`).toBe("down");
  });

  it("goes red when the last attempt FAILED, however recent", () => {
    // A failure this morning beats a success yesterday: mail did not go out.
    expect(judgeDigest(0, true, STALE)).toBe("down");
    expect(judgeDigest(1, true, STALE)).toBe("down");
  });

  it("is unknown when nothing has ever been sent — not green", () => {
    // A brand-new install has never missed a send and has never made one. That
    // is a blind spot, not a clean bill of health.
    expect(judgeDigest(null, false, STALE)).toBe("unknown");
  });

  it("is unknown on a broken reading rather than guessing", () => {
    for (const d of [NaN, -1, Infinity]) expect(judgeDigest(d, false, STALE), String(d)).toBe("unknown");
  });

  it("uses the threshold it is given, so it cannot drift from the email", () => {
    expect(judgeDigest(8, false, 14)).toBe("ok");
    expect(judgeDigest(14, false, 14)).toBe("down");
  });
});

describe("judgeCostCoverage — a floor must not render as a total", () => {
  it("is ok only when every run in the window is priced", () => {
    expect(judgeCostCoverage(4, 4)).toBe("ok");
  });

  it("warns when some runs are unpriced — the September shape", () => {
    // 4 pipeline runs, 2 of them older than the cost-recording code.
    expect(judgeCostCoverage(4, 2)).toBe("warn");
  });

  it("is unknown when nothing is priced, rather than reporting $0", () => {
    expect(judgeCostCoverage(4, 0)).toBe("unknown");
    expect(judgeCostCoverage(0, 0)).toBe("unknown");
  });

  it("refuses nonsense rather than guessing", () => {
    expect(judgeCostCoverage(NaN, 1)).toBe("unknown");
    expect(judgeCostCoverage(-1, -1)).toBe("unknown");
  });

  it("never reports ok for a partial measurement, whatever the budget says", () => {
    // The tile takes the worse of coverage and budget, so a comfortable budget
    // cannot talk a blind measurement into green.
    const coverage = judgeCostCoverage(4, 2);
    const budget = judgeUsage(22.78, 500);
    expect(budget).toBe("ok");
    expect(worstStatus([{ status: coverage }, { status: budget }])).toBe("warn");
  });
});

describe("judgeSourceSweep — the alarm for the silence that lasted four weeks", () => {
  /**
   * EVERY TIME HERE IS A MONDAY MORNING, because that is when the email is
   * composed: ops-digest.yml fires on `workflow_run: completed` for Weekly
   * Event Research, and check-sources is the last step of that same workflow.
   * A test that samples at any other moment is testing a reading the email
   * never takes — which is how the first version of this alarm passed its own
   * tests while reading green on the first dead Monday.
   */
  const SCHEDULE = { everyHours: 24 * 7, dueDayUTC: 1, dueHourUTC: 6 };
  const MONDAY = new Date("2026-11-02T06:10:00Z"); // digest firing, 10 min after the slot
  const WEEK_MS = 7 * 86_400_000;

  const h = (over: Partial<SourceSweepHealth> = {}): SourceSweepHealth => ({
    newestIso: "2026-11-02T06:12:00Z", // this morning's run
    pagesSwept: 372,
    pagesTotal: 593,
    pagesExpected: 400,
    neverChecked: 41,
    listings: 902,
    runWindowHours: 24,
    unverifiedBy: [{ category: "not-an-index", listings: 30 }, { category: "blocked", listings: 11 }],
    ...over,
  });
  const judge = (over: Partial<SourceSweepHealth> = {}, now = MONDAY) =>
    judgeSourceSweep(h(over), SCHEDULE, now);

  /** The stamp a run N Mondays ago would have left. */
  const mondaysAgo = (n: number) => new Date(MONDAY.getTime() - n * WEEK_MS + 2 * 60_000).toISOString();

  it("is green when this morning's sweep ran and read its budget", () => {
    const v = judge();
    expect(v.status).toBe("ok");
    expect(v.lines[0]).toMatch(/the latest sweep read 372 of 400 cited pages \(today\)/);
  });

  it("CATCHES THE FIRST DEAD MONDAY — the reading the email actually takes", () => {
    // THE REGRESSION. The first version compared elapsed time against the
    // period with judgeCron's 1.25x grace. At this sampling the stamp is
    // exactly ONE period old, which that grace called fine: measured green on
    // the first dead Monday, amber on the second, red on the third. An alarm
    // for a four-week silence that stays quiet for three weeks of it.
    //
    // And `pagesSwept` is 372 here ON PURPOSE: last Monday's run really did
    // read 372 pages and its stamps really are still in the table, which is
    // what the old 8-day window counted. Both faults had to be fixed for this
    // to go amber.
    const v = judge({ newestIso: mondaysAgo(1), pagesSwept: 372 });
    expect(v.status).toBe("warn");
    expect(v.lines[0]).toMatch(/the scheduled sweep did not run/);
    expect(v.lines[0]).toMatch(/7 days old/);
  });

  it("escalates to down once two scheduled sweeps are gone", () => {
    const v = judge({ newestIso: mondaysAgo(2), pagesSwept: 372 });
    expect(v.status).toBe("down");
    expect(v.lines[0]).toMatch(/2 scheduled sweeps missed/);
  });

  it("names the real four-week outage for what it was", () => {
    // 28 Sep 2026 was the newest stamp; the next Mondays were 5, 12, 19 and 26
    // Oct. By 2 Nov that is five missed slots.
    const v = judge({ newestIso: "2026-09-28T13:14:38.494716+00", pagesSwept: 0 });
    expect(v.status).toBe("down");
    expect(v.lines[0]).toMatch(/5 scheduled sweeps missed/);
    expect(v.lines[0]).toMatch(/nothing source-checked for 35 days/);
    // The unit, which the first version dropped: "it runs every 7" said nothing.
    expect(v.lines[0]).toMatch(/it runs every 7 days/);
  });

  it("does NOT cry wolf on the mid-week tile, which samples the same judge", () => {
    // /admin/ops read on Thursday, Saturday, Sunday — all after a healthy
    // Monday run. Any elapsed-time threshold tight enough to catch the dead
    // Monday above would make every one of these amber, which is exactly why
    // the judge asks about the schedule instead.
    const healthyRun = "2026-10-26T06:12:00Z"; // the Monday before
    for (const day of ["2026-10-29T12:00:00Z", "2026-10-31T20:00:00Z", "2026-11-01T23:00:00Z"]) {
      const v = judge({ newestIso: healthyRun }, new Date(day));
      expect(v.status, day).toBe("ok");
    }
  });

  it("tolerates GitHub running the sweep hours late, which it routinely does", () => {
    // The slot is 06:00 UTC; a run at 09:30 is still a run for that slot.
    const v = judge({ newestIso: "2026-11-02T09:30:00Z" }, new Date("2026-11-02T10:00:00Z"));
    expect(v.status).toBe("ok");
  });

  it("CATCHES A PARTIAL RUN, which an age check alone cannot", () => {
    // Only pages actually READ are stamped, so a sweep that dies after a few
    // fetches — or meets a wall of 403s — leaves a FRESH stamp and no coverage.
    const v = judge({ pagesSwept: 7 });
    expect(v.status).toBe("warn");
    expect(v.lines[0]).toMatch(/read only 7 of 400 pages/);
  });

  it("puts the partial-run boundary exactly at half a full run", () => {
    expect(judge({ pagesSwept: 200 }).status).toBe("ok");
    expect(judge({ pagesSwept: 199 }).status).toBe("warn");
  });

  describe("every doubt is `unknown`, and `unknown` is never green", () => {
    it("nothing has ever been checked", () => {
      const v = judge({ newestIso: null });
      expect(v.status).toBe("unknown");
      expect(v.lines[0]).toMatch(/no source check on record/);
    });

    it("the stamp is not a date", () => {
      expect(judge({ newestIso: "never" }).status).toBe("unknown");
      expect(judge({ newestIso: "never" }).lines[0]).toMatch(/not a date/);
    });

    it("the stamp is in the future — a clock problem, not a health signal", () => {
      const v = judge({ newestIso: "2026-11-09T00:00:00Z" });
      expect(v.status).toBe("unknown");
      expect(v.lines[0]).toMatch(/future/);
    });

    it("there is no budget to compare a run against", () => {
      expect(judge({ pagesExpected: 0 }).status).toBe("unknown");
      expect(judge({ pagesExpected: Number.NaN }).status).toBe("unknown");
    });

    it("the pages read could not be counted", () => {
      expect(judge({ pagesSwept: -1 }).status).toBe("unknown");
      expect(judge({ pagesSwept: Number.NaN }).status).toBe("unknown");
    });

    it("is never `ok` for any of them", () => {
      for (const over of [
        { newestIso: null },
        { newestIso: "never" },
        { newestIso: "2026-11-09T00:00:00Z" },
        { pagesExpected: 0 },
        { pagesSwept: -1 },
      ] as Partial<SourceSweepHealth>[]) {
        expect(needsAttention(judge(over).status), JSON.stringify(over)).toBe(true);
      }
    });
  });

  describe("coverage is a FACT, never the verdict", () => {
    it("stays green when most of the calendar has never been checked", () => {
      // THE DESIGN DECISION, pinned. Measured: 59 listings blocked and 348 on
      // readable pages that are not dated indexes, so never-checked cannot
      // reach zero. If it drove the status the alarm would be permanently
      // amber — and an alarm that is always on is one nobody reads.
      const v = judge({ neverChecked: 801, listings: 902 });
      expect(v.status).toBe("ok");
      expect(v.lines[1]).toMatch(/801 of 902 upcoming listings have never been checked/);
    });

    it("reports the coverage line on every verdict, including the dead one", () => {
      for (const over of [{}, { newestIso: null }, { newestIso: mondaysAgo(4) }, { pagesSwept: 1 }]) {
        const v = judge(over as Partial<SourceSweepHealth>);
        expect(v.lines, JSON.stringify(over)).toHaveLength(2);
        expect(v.lines[1], JSON.stringify(over)).toMatch(/never been checked|empty calendar/);
      }
    });

    it("hands an empty calendar to Coverage rather than blaming the sweep", () => {
      const v = judge({ listings: 0, neverChecked: 0, pagesTotal: 0, pagesExpected: 0 });
      expect(v.lines[1]).toMatch(/an empty calendar is Coverage's alarm, not this one/);
      // Still not green: there is genuinely nothing to measure here.
      expect(needsAttention(v.status)).toBe(true);
    });
  });
});

describe("lastDueAt / sweepsMissed — the schedule, not a stopwatch", () => {
  const S = { everyHours: 24 * 7, dueDayUTC: 1, dueHourUTC: 6 };
  const iso = (d: Date) => d.toISOString();

  it("finds the Monday 06:00 slot from any point in the week", () => {
    const expectSlot = (from: string, slot: string) =>
      expect(iso(lastDueAt(new Date(from), S)), from).toBe(slot);
    expectSlot("2026-11-02T06:10:00Z", "2026-11-02T06:00:00.000Z"); // Monday, just after
    expectSlot("2026-11-02T06:00:00Z", "2026-11-02T06:00:00.000Z"); // exactly on it
    expectSlot("2026-11-02T05:59:00Z", "2026-10-26T06:00:00.000Z"); // Monday, just before
    expectSlot("2026-11-05T12:00:00Z", "2026-11-02T06:00:00.000Z"); // Thursday
    expectSlot("2026-11-08T23:59:00Z", "2026-11-02T06:00:00.000Z"); // Sunday night
  });

  it("crosses a month and a year boundary without drifting", () => {
    expect(iso(lastDueAt(new Date("2027-01-01T12:00:00Z"), S))).toBe("2026-12-28T06:00:00.000Z");
    expect(iso(lastDueAt(new Date("2026-12-01T00:00:00Z"), S))).toBe("2026-11-30T06:00:00.000Z");
  });

  it("counts zero missed all week after one healthy run", () => {
    const ran = "2026-11-02T06:12:00Z";
    for (const when of ["2026-11-02T06:13:00Z", "2026-11-05T12:00:00Z", "2026-11-08T23:00:00Z"]) {
      expect(sweepsMissed(ran, new Date(when), S), when).toBe(0);
    }
  });

  it("counts one the moment the next slot passes unstamped", () => {
    expect(sweepsMissed("2026-10-26T06:12:00Z", new Date("2026-11-02T05:59:00Z"), S)).toBe(0);
    expect(sweepsMissed("2026-10-26T06:12:00Z", new Date("2026-11-02T06:10:00Z"), S)).toBe(1);
  });

  it("counts every slot that has gone by", () => {
    const now = new Date("2026-11-02T06:10:00Z");
    expect(sweepsMissed("2026-10-19T06:12:00Z", now, S)).toBe(2);
    expect(sweepsMissed("2026-09-28T13:14:38+00", now, S)).toBe(5);
  });

  it("is null for the three things it cannot read", () => {
    const now = new Date("2026-11-02T06:10:00Z");
    expect(sweepsMissed(null, now, S)).toBeNull();
    expect(sweepsMissed("not a date", now, S)).toBeNull();
    expect(sweepsMissed("2026-11-09T00:00:00Z", now, S)).toBeNull();
  });
});

describe("expectedPages — one run's budget, not the whole calendar", () => {
  it("clamps to the budget once the calendar outgrows it", () => {
    expect(expectedPages(593, 400)).toBe(400);
  });

  it("is the calendar when the budget is not the binding constraint", () => {
    // Today's real numbers: 388 cited pages against a 400-page budget.
    expect(expectedPages(388, 400)).toBe(388);
  });

  it("is zero rather than a guess for nonsense, so the judge reports unknown", () => {
    for (const [total, budget] of [[0, 400], [-1, 400], [593, 0], [Number.NaN, 400], [593, Number.NaN]]) {
      expect(expectedPages(total as number, budget as number), `${total}/${budget}`).toBe(0);
    }
  });
});

describe("the page and the email share one judge — tripwire", () => {
  /**
   * `/admin/ops` and the Monday email reach the source-check verdict by
   * different paths (vendors.ts -> a tile; ops-inputs -> buildSections -> a
   * section). The project's standing contract is that they cannot drift. A
   * second copy of either the judge or the period would let the page say green
   * on the week the email said four weeks dead.
   */
  const vendors = readFileSync(join(__dirname, "..", "vendors.ts"), "utf8");
  const digest = readFileSync(join(__dirname, "..", "ops-digest.ts"), "utf8");

  it("the tile calls judgeSourceSweep with the email's own schedule", () => {
    expect(vendors).toContain("judgeSourceSweep(h, SOURCE_SWEEP_SCHEDULE, now)");
    expect(vendors).toContain('from "./ops-digest"');
  });

  it("the email section calls the same judge with the same schedule", () => {
    expect(digest).toContain("judgeSourceSweep(inputs.sourceSweep, SOURCE_SWEEP_SCHEDULE, now)");
  });

  it("both read the one query, so neither can measure its own numbers", () => {
    expect(vendors).toContain('from "./source-sweep"');
    const inputs = readFileSync(join(__dirname, "..", "ops-inputs.ts"), "utf8");
    expect(inputs).toContain("getSourceSweepHealth()");
  });

  it("the sweep and the alarm share one page budget", () => {
    const script = readFileSync(join(__dirname, "..", "..", "scripts", "check-sources.ts"), "utf8");
    expect(script).toContain("SWEEP_PAGE_BUDGET");
    expect(script).not.toMatch(/\?\?\s*400\b/);
  });
});

describe("the alarm measures the same rows the sweep does — tripwire", () => {
  /**
   * `getSourceSweepHealth` judges coverage of a population. If the sweep ever
   * narrows or widens its own scope and the alarm does not follow, the alarm
   * reports a percentage of the wrong denominator — and would read healthy
   * while a whole class of listing went unchecked. Both predicates are asserted
   * literally, so changing one on purpose means changing this test on purpose.
   */
  const SCOPE = ["status = 'published'", "start_at > now()", "source_url ~* '^https?://'"];

  it("both queries carry the same three scope clauses", () => {
    const sweep = readFileSync(join(__dirname, "..", "..", "scripts", "check-sources.ts"), "utf8");
    const alarm = readFileSync(join(__dirname, "..", "source-sweep.ts"), "utf8");
    for (const clause of SCOPE) {
      // check-sources aliases the table as `e`; compare with the alias stripped.
      expect(sweep.replace(/\be\./g, ""), `sweep: ${clause}`).toContain(clause);
      expect(alarm, `alarm: ${clause}`).toContain(clause);
    }
  });

  it("only check-sources ever STAMPS the column, so nothing else can fake freshness", () => {
    // apply-correction and upsertEvents both set it to NULL and never to a
    // time. If anything else started stamping `now()`, a run that read nothing
    // could look like a sweep.
    const stampers = ["lib/upsert.ts", "lib/corrections.ts", "scripts/apply-correction.ts", "lib/source-sweep.ts"];
    for (const rel of stampers) {
      const src = readFileSync(join(__dirname, "..", "..", rel), "utf8");
      expect(src, rel).not.toMatch(/source_checked_at\s*=\s*now\(\)/);
    }
    const sweep = readFileSync(join(__dirname, "..", "..", "scripts", "check-sources.ts"), "utf8");
    expect(sweep).toMatch(/source_checked_at\s*=\s*now\(\)/);
  });
});

describe("parseStampMs — the alarm read its own column by accident of formatting", () => {
  const INSTANT = Date.UTC(2026, 8, 28, 13, 14, 38, 494); // 28 Sep 2026 13:14:38.494 UTC

  it("reads the exact string the driver returns for this column", () => {
    // Copied from a live read of max(source_checked_at)::text.
    expect(parseStampMs("2026-09-28 13:14:38.494716+00")).toBe(INSTANT);
  });

  it("reads the same instant written the way Date.parse rejects", () => {
    // THE FRAGILITY. A bare +00 offset is not valid ISO-8601, so with a `T`
    // separator Date.parse returns NaN — the alarm would have gone permanently
    // grey on a formatting change it never chose.
    expect(Number.isNaN(Date.parse("2026-09-28T13:14:38.494716+00"))).toBe(true);
    expect(parseStampMs("2026-09-28T13:14:38.494716+00")).toBe(INSTANT);
  });

  it("reads the forms that were already fine", () => {
    expect(parseStampMs("2026-09-28T13:14:38.494Z")).toBe(INSTANT);
    expect(parseStampMs("2026-09-28T13:14:38.494+00:00")).toBe(INSTANT);
    expect(parseStampMs("  2026-09-28 13:14:38.494716+00  ")).toBe(INSTANT);
  });

  it("is NaN for what is not a timestamp, so the judge reports unknown", () => {
    for (const bad of ["", "never", "not a date", "2026-13-45 99:99:99+00"]) {
      expect(Number.isNaN(parseStampMs(bad)), JSON.stringify(bad)).toBe(true);
    }
  });

  it("does not shift the instant by a time zone — the five-hour hazard", () => {
    // 13:14 UTC is 08:14 Chicago. If this ever came back as 18:14 UTC the
    // staleness arithmetic would be five hours out in the dangerous direction.
    expect(new Date(parseStampMs("2026-09-28 13:14:38.494716+00")).toISOString()).toBe(
      "2026-09-28T13:14:38.494Z",
    );
  });
});

describe("the coverage line names its causes instead of guessing", () => {
  const SCHEDULE = { everyHours: 24 * 7, dueDayUTC: 1, dueHourUTC: 6 };
  const MONDAY = new Date("2026-11-02T06:10:00Z");
  const h = (over: Partial<SourceSweepHealth> = {}): SourceSweepHealth => ({
    newestIso: "2026-11-02T06:12:00Z",
    pagesSwept: 372, pagesTotal: 593, pagesExpected: 400,
    neverChecked: 407, listings: 902, runWindowHours: 24,
    unverifiedBy: [
      { category: "unchecked", listings: 348 },
      { category: "blocked", listings: 59 },
    ],
    ...over,
  });

  it("reports the real proportions, which are nothing like the guess it replaced", () => {
    // The line used to read "(some hosts refuse a script)". Measured: blocking
    // accounts for 59 of 407 and the dominant cause is readable pages that are
    // not dated indexes — venue calendars drawn client-side. An operator sent
    // at "blocked hosts" by that parenthetical spends an afternoon on the
    // smallest sixth of the problem.
    const v = judgeSourceSweep(h(), SCHEDULE, MONDAY);
    expect(v.lines[1]).toContain("407 of 902 upcoming listings have never been checked");
    expect(v.lines[1]).toContain("348 unchecked, 59 blocked");
    expect(v.lines[1]).not.toContain("some hosts refuse a script");
  });

  it("names at most three causes, worst first, so the line stays readable", () => {
    const v = judgeSourceSweep(
      h({
        unverifiedBy: [
          { category: "unchecked", listings: 348 },
          { category: "blocked", listings: 59 },
          { category: "dead", listings: 4 },
          { category: "unreachable", listings: 2 },
        ],
      }),
      SCHEDULE,
      MONDAY,
    );
    expect(v.lines[1]).toContain("348 unchecked, 59 blocked, 4 dead");
    expect(v.lines[1]).not.toContain("unreachable");
  });

  it("drops a cause that counts nothing rather than printing a zero", () => {
    const v = judgeSourceSweep(
      h({ unverifiedBy: [{ category: "blocked", listings: 59 }, { category: "dead", listings: 0 }] }),
      SCHEDULE,
      MONDAY,
    );
    expect(v.lines[1]).toContain("59 blocked");
    expect(v.lines[1]).not.toContain("0 dead");
  });

  it("says the next sweep will explain, rather than inventing a cause", () => {
    // Before the first sweep that records notes there is genuinely nothing to
    // report. Honest emptiness: no cause, and no guess at one.
    const v = judgeSourceSweep(h({ unverifiedBy: [] }), SCHEDULE, MONDAY);
    expect(v.lines[1]).toContain("no cause recorded yet");
    expect(v.status).toBe("ok"); // coverage still never drives the verdict
  });

  it("survives a health row with no causes field at all", () => {
    // source-sweep is the only producer, but the judge is public and a stale
    // caller must degrade rather than throw inside the email.
    const bare = { ...h() } as Partial<SourceSweepHealth>;
    delete bare.unverifiedBy;
    expect(() => judgeSourceSweep(bare as SourceSweepHealth, SCHEDULE, MONDAY)).not.toThrow();
  });
});
