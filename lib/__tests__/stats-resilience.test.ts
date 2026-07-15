import { describe, it, expect, vi } from "vitest";

/**
 * THE LIVE FAILURE, ENCODED (roadmap 5.1 hotfix). /admin/stats 500'd in
 * production when the engagement queries failed (table not yet created).
 * The read path carries the same contract as the writes: analytics must
 * never break the page that displays it — any query failure returns the
 * empty state instead of throwing.
 */
describe("getEngagement resilience", () => {
  it("returns the empty state instead of throwing when queries fail", async () => {
    // Simulate a live DB whose query throws (e.g. relation does not exist).
    const throwingSql = Object.assign(
      () => Promise.reject(new Error('relation "event_stats" does not exist')),
      { end: async () => {}, json: (v: unknown) => v },
    );
    vi.doMock("../db", () => ({ sql: throwingSql }));
    vi.resetModules();
    const { getEngagement } = await import("../stats");

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const out = await getEngagement(7);
    expect(out).toEqual({
      totals: { view: 0, ticket_click: 0, save: 0, calendar: 0 },
      daily: [],
      top: [],
    });
    expect(spy).toHaveBeenCalled(); // failure is logged, not swallowed silently
    spy.mockRestore();
    vi.doUnmock("../db");
    vi.resetModules();
  });
});
