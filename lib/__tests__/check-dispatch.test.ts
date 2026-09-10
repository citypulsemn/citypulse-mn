import { describe, it, expect } from "vitest";
import { buildDispatchRequest } from "../check-dispatch";

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
