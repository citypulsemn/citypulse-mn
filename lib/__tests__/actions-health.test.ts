import { describe, it, expect } from "vitest";
import {
  parseWorkflowRuns,
  judgeActions,
  actionsConfigured,
  getActionsHealth,
  BAD_CONCLUSIONS,
  WATCHED_WORKFLOWS,
  ACTIONS_RUNS_PER_WORKFLOW,
  type WorkflowHealth,
} from "../actions-health";

/**
 * The real response from
 * GET /repos/citypulsemn/citypulse-mn/actions/workflows/weekly-research.yml/runs
 * read on 3 Nov 2026 — the four October failures that took the source check
 * down for three weeks, with the Nov 2 recovery on top. Trimmed to the fields
 * the parser reads. Using the production rows rather than invented ones is the
 * rule this project paid for: a duplicate-detection test once passed on a title
 * shortened by hand while the real string failed.
 */
const REAL_RESPONSE = {
  total_count: 25,
  workflow_runs: [
    { conclusion: "success", status: "completed", created_at: "2026-11-02T14:34:25Z", html_url: "https://github.com/citypulsemn/citypulse-mn/actions/runs/41463232904" },
    { conclusion: "failure", status: "completed", created_at: "2026-10-26T12:06:59Z", html_url: "https://github.com/citypulsemn/citypulse-mn/actions/runs/40320064353" },
    { conclusion: "failure", status: "completed", created_at: "2026-10-19T11:54:06Z", html_url: "https://github.com/citypulsemn/citypulse-mn/actions/runs/39247986971" },
    { conclusion: "failure", status: "completed", created_at: "2026-10-12T14:13:00Z", html_url: "https://github.com/citypulsemn/citypulse-mn/actions/runs/38261285078" },
    { conclusion: "failure", status: "completed", created_at: "2026-10-05T13:23:24Z", html_url: "https://github.com/citypulsemn/citypulse-mn/actions/runs/37316411223" },
  ],
};

const health = (over: Partial<WorkflowHealth> = {}): WorkflowHealth => ({
  label: "weekly research",
  file: "weekly-research.yml",
  recent: [{ conclusion: "success", at: "2026-11-02T14:34:25Z", url: "https://x/1" }],
  ...over,
});

describe("parseWorkflowRuns — the real API shape", () => {
  it("reads the production response, newest first, keeping the link", () => {
    const runs = parseWorkflowRuns(REAL_RESPONSE);
    expect(runs).toHaveLength(5);
    expect(runs[0]).toEqual({
      conclusion: "success",
      at: "2026-11-02T14:34:25Z",
      url: "https://github.com/citypulsemn/citypulse-mn/actions/runs/41463232904",
    });
    expect(runs.slice(1).map((r) => r.conclusion)).toEqual(["failure", "failure", "failure", "failure"]);
  });

  it("honest emptiness on anything it cannot read", () => {
    expect(parseWorkflowRuns(null)).toEqual([]);
    expect(parseWorkflowRuns(undefined)).toEqual([]);
    expect(parseWorkflowRuns("nope")).toEqual([]);
    expect(parseWorkflowRuns({})).toEqual([]);
    expect(parseWorkflowRuns({ workflow_runs: "nope" })).toEqual([]);
    expect(parseWorkflowRuns({ workflow_runs: [] })).toEqual([]);
  });

  it("drops a run it cannot date, because an undated run cannot be reported", () => {
    const runs = parseWorkflowRuns({
      workflow_runs: [{ conclusion: "failure" }, null, 7, { conclusion: "success", created_at: "2026-11-02T14:34:25Z" }],
    });
    expect(runs).toHaveLength(1);
    expect(runs[0].conclusion).toBe("success");
    expect(runs[0].url).toBe(""); // missing html_url is empty, not "undefined"
  });

  it("keeps a null conclusion as null — a run in progress is not a failure", () => {
    const runs = parseWorkflowRuns({
      workflow_runs: [{ conclusion: null, status: "in_progress", created_at: "2026-11-03T06:00:00Z" }],
    });
    expect(runs[0].conclusion).toBeNull();
  });
});

describe("judgeActions — when a red job should shout", () => {
  it("THE REAL CASE: four October failures under a green latest run", () => {
    const v = judgeActions([health({ recent: parseWorkflowRuns(REAL_RESPONSE) })]);
    expect(v.lines).toEqual(["weekly research — last run ok, but 4 of the last 5 failed"]);
    // Latest IS green, so this is information, not an alarm — the fix landed.
    expect(v.alert).toBe(false);
  });

  it("a failed latest run alerts, names the day and links the run", () => {
    const v = judgeActions([
      health({ recent: [{ conclusion: "failure", at: "2026-10-26T12:06:59Z", url: "https://x/40320064353" }] }),
    ]);
    expect(v.alert).toBe(true);
    expect(v.lines[0]).toContain("weekly research — LAST RUN FAILURE");
    expect(v.lines[0]).toContain("Oct 26");
    expect(v.lines[0]).toContain("https://x/40320064353");
  });

  it("a cancelled or timed-out latest run alerts too", () => {
    // The 14 Jul pipeline was cancelled by GitHub's own timeout mid-flight and
    // recorded ok=false with nothing upserted — exactly worth a Monday line.
    for (const c of ["cancelled", "timed_out", "startup_failure"]) {
      const v = judgeActions([health({ recent: [{ conclusion: c, at: "2026-07-14T06:00:00Z", url: "" }] })]);
      expect(v.alert, c).toBe(true);
      expect(v.lines[0], c).toContain(c.toUpperCase());
    }
    expect(BAD_CONCLUSIONS).toContain("cancelled");
  });

  it("a run still in progress is not a failure", () => {
    const v = judgeActions([health({ recent: [{ conclusion: null, at: "2026-11-03T06:00:00Z", url: "" }] })]);
    expect(v.alert).toBe(false);
  });

  it("no runs at all alerts — nothing to read is never a pass", () => {
    // A weekly cron that stopped firing (GitHub disables schedules on a quiet
    // repo) leaves exactly this, and it must not read as green.
    const v = judgeActions([health({ recent: [] })]);
    expect(v.alert).toBe(true);
    expect(v.lines[0]).toContain("NO RUNS RECORDED");
  });

  it("all green collapses to one line, because four green lines is scenery", () => {
    const v = judgeActions([health(), health({ label: "verify pass" }), health({ label: "subscriber email" })]);
    expect(v.lines).toEqual(["3 scheduled workflow(s), last run green"]);
    expect(v.alert).toBe(false);
  });

  it("not configured is quiet and does NOT alert — /admin/ops has no token", () => {
    const v = judgeActions(null);
    expect(v.alert).toBe(false);
    expect(v.lines[0]).toContain("no GitHub token in this environment");
    // Distinct from a failed read, which never reaches here: the gather catches
    // that and the section renders "unavailable" with an alert.
  });

  it("an empty watch list is quiet, not an alarm", () => {
    expect(judgeActions([])).toEqual({ lines: ["no workflows watched"], alert: false });
  });

  it("names only what is wrong, even in a mixed set", () => {
    const v = judgeActions([
      health(),
      health({ label: "verify pass", recent: [{ conclusion: "failure", at: "2026-11-02T12:00:00Z", url: "" }] }),
      health({ label: "report checker", recent: [] }),
    ]);
    expect(v.alert).toBe(true);
    expect(v.lines.join(" ")).not.toContain("weekly research");
    expect(v.lines.join(" ")).toContain("verify pass — LAST RUN FAILURE");
    expect(v.lines.join(" ")).toContain("report checker — NO RUNS RECORDED");
  });
});

describe("the watch list and the live read", () => {
  it("watches the scheduled workflows and not the manual or self ones", () => {
    const files = WATCHED_WORKFLOWS.map((w) => w.file);
    expect(files).toContain("weekly-research.yml"); // the one that failed 4x
    expect(files).toContain("weekly-digest.yml");
    expect(files).toContain("verify-events.yml");
    expect(files).toContain("check-reports.yml");
    // manual-only: a dispatch someone ran once is not news
    expect(files).not.toContain("gsc-report.yml");
    expect(files).not.toContain("purge-cache.yml");
    // itself: mid-run while it reports, so its conclusion is always null
    expect(files).not.toContain("ops-digest.yml");
  });

  it("every watched workflow file actually exists", () => {
    const { existsSync } = require("node:fs") as typeof import("node:fs");
    const { join } = require("node:path") as typeof import("node:path");
    for (const w of WATCHED_WORKFLOWS) {
      expect(existsSync(join(__dirname, "..", "..", ".github", "workflows", w.file)), w.file).toBe(true);
    }
  });

  it("reads enough runs to spot a flapping job", () => {
    expect(ACTIONS_RUNS_PER_WORKFLOW).toBeGreaterThanOrEqual(5);
  });

  it("configured is just 'is there a token', and no token means no read", async () => {
    expect(actionsConfigured("ghp_x")).toBe(true);
    expect(actionsConfigured(undefined)).toBe(false);
    expect(actionsConfigured("")).toBe(false);
    // The live read short-circuits rather than calling GitHub unauthenticated.
    // Note `repo` carries a default, so passing undefined RESOLVES to that
    // default and would really hit the network — "" is the reachable no-repo
    // case, and this assertion is only honest because neither call fetches.
    await expect(getActionsHealth(undefined, "o/r")).resolves.toBeNull();
    await expect(getActionsHealth("tok", "")).resolves.toBeNull();
  });
});
