import { describe, it, expect } from "vitest";
import { buildDispatchRequest, dispatchLagWarning } from "../check-dispatch";

/**
 * The report checker's cron is the guarantee; this dispatch is the accelerator
 * (see lib/check-dispatch.ts for the 10 Sep 2026 run-history finding). What is
 * worth pinning here is the API contract and the "unconfigured is not broken"
 * boundary — the two things that would fail silently in production.
 */
describe("buildDispatchRequest", () => {
  const req = buildDispatchRequest("ghp_example")!;

  it("targets the check-reports workflow's dispatch endpoint on this repo", () => {
    expect(req.url).toBe(
      "https://api.github.com/repos/citypulsemn/citypulse-mn/actions/workflows/check-reports.yml/dispatches",
    );
  });

  it("sends the ref GitHub requires, and no inputs — omitted dry_run means a real run", () => {
    const body = JSON.parse(req.body);
    expect(body).toEqual({ ref: "main" });
    expect(body.inputs).toBeUndefined();
  });

  it("carries the token and pins the API version", () => {
    expect(req.headers.Authorization).toBe("Bearer ghp_example");
    expect(req.headers.Accept).toBe("application/vnd.github+json");
    expect(req.headers["X-GitHub-Api-Version"]).toBe("2022-11-28");
  });

  // Honest emptiness at the boundary: no token is the state this ships in, and
  // it must read as "not configured", never as a malformed call to GitHub.
  it("returns undefined for a missing token", () => {
    expect(buildDispatchRequest(undefined)).toBeUndefined();
  });

  // An unset GitHub Actions secret and a fat-fingered Vercel value both arrive
  // as whitespace, not undefined — the lesson lib/env.ts was written for.
  it("treats blank and whitespace-only tokens as absent", () => {
    expect(buildDispatchRequest("")).toBeUndefined();
    expect(buildDispatchRequest("   ")).toBeUndefined();
  });

  it("trims a token that picked up whitespace on the way in", () => {
    expect(buildDispatchRequest("  ghp_x\n")!.headers.Authorization).toBe("Bearer ghp_x");
  });
});

/**
 * Detecting a broken dispatch from waiting time alone (13 Oct 2026).
 *
 * The dispatch runs in Vercel where the token is; the only operator email runs
 * in Actions where it is not. Rather than keep a second copy of the secret or
 * persist an expiry date — neither of which would catch a revoked token, a
 * read-only one, or a Vercel variable lost in a redeploy — the lag does the
 * telling. A dispatched run checks in ~1 minute; the cron is capped near five
 * runs a day with a measured 10h05m worst gap. Nothing lands in between.
 */
describe("dispatchLagWarning", () => {
  it("says nothing when the check was prompt — a working day must be silent", () => {
    expect(dispatchLagWarning(0)).toBeUndefined();
    expect(dispatchLagWarning(1)).toBeUndefined();
    expect(dispatchLagWarning(19)).toBeUndefined();
  });

  it("is silent exactly AT the threshold and speaks past it", () => {
    expect(dispatchLagWarning(20)).toBeUndefined();
    expect(dispatchLagWarning(21)).toBeDefined();
  });

  // Rule 6: no pending reports means no measurement, which must not render as a
  // reassuring zero — and must never render as "waited NaN minutes".
  it("says nothing when there is nothing to measure", () => {
    expect(dispatchLagWarning(undefined)).toBeUndefined();
    expect(dispatchLagWarning(NaN)).toBeUndefined();
    expect(dispatchLagWarning(Infinity)).toBeUndefined();
  });

  it("names the wait in minutes under two hours and hours beyond", () => {
    expect(dispatchLagWarning(45)).toContain("45 minutes");
    expect(dispatchLagWarning(119)).toContain("119 minutes");
    expect(dispatchLagWarning(120)).toContain("2 hours");
    expect(dispatchLagWarning(605)).toContain("10 hours");
  });

  it("names the variable and the two failures that look different in a log", () => {
    const w = dispatchLagWarning(300)!;
    expect(w).toContain("GH_DISPATCH_TOKEN");
    expect(w).toContain("401");
    expect(w).toContain("403");
  });

  it("takes a custom threshold, so the policy is not baked into the prose", () => {
    expect(dispatchLagWarning(30, 60)).toBeUndefined();
    expect(dispatchLagWarning(90, 60)).toBeDefined();
  });
});
