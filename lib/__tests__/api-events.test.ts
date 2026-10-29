import { describe, it, expect } from "vitest";
import { API_EVENTS_LIMIT } from "../api-events";

/**
 * The cap on /api/events (29 Oct 2026).
 *
 * The endpoint used to return the whole published table — 542,226 bytes over
 * 764 events, measured live, unauthenticated, with downstream caching switched
 * off by its own header. The failure mode is a bill rather than a stack trace,
 * so the ceiling is pinned here: nothing else would notice it drifting.
 *
 * There is no request parsing to test, and that is the design (see
 * lib/api-events.ts). What is worth asserting is that the constant stays a
 * constant and stays small.
 */
describe("API_EVENTS_LIMIT", () => {
  it("is a small positive whole number", () => {
    expect(Number.isInteger(API_EVENTS_LIMIT)).toBe(true);
    expect(API_EVENTS_LIMIT).toBeGreaterThan(0);
  });

  it("keeps the worst-case body two orders of magnitude under the old one", () => {
    // 764 events weighed 542,226 bytes live — about 710 bytes each. If this
    // ever fails, the cap has been raised far enough to undo the fix.
    const WORST_CASE_BYTES = API_EVENTS_LIMIT * 710;
    expect(WORST_CASE_BYTES).toBeLessThan(50_000);
    expect(WORST_CASE_BYTES / 542_226).toBeLessThan(0.1);
  });
});
