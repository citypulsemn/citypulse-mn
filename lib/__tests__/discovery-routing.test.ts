import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Source tripwires for the "amplify what ranks" discovery-routing pass (v6).
 * These changes are presentational (JSX + metadata), so they're guarded by
 * asserting the wiring is present rather than by rendering — same convention as
 * the UX10 perf pass and the P1.3 wire-in. The GSC read is the why: day + event
 * pages rank (day pages for "events in minneapolis [date]", events for 88% of
 * impressions) while /this-week(end) rank for nothing, so we route the ranking
 * pages to the conversion shop-windows for both humans and internal-link equity.
 */
const read = (p: string) => readFileSync(join(__dirname, "..", "..", p), "utf8");

describe("day pages route discovery traffic to conversion", () => {
  const src = read("app/day/[date]/page.tsx");

  it("carry a subscribe band (the ranking surface had no ask before)", () => {
    expect(src).toContain("SubscribeBand");
    expect(src).toContain('source="day"');
  });

  it("link onward to the curated shop-windows (link equity + routing)", () => {
    expect(src).toContain('href="/this-week"');
    expect(src).toContain('href="/this-weekend"');
  });

  it('title matches the winning query term ("Minneapolis"), not only "Twin Cities"', () => {
    expect(src).toContain("Things to Do in Minneapolis–St. Paul,");
  });
});

describe("event pages (88% of impressions) route onward to the shop-windows", () => {
  const src = read("app/event/[id]/page.tsx");

  it("link to /this-week and /this-weekend", () => {
    expect(src).toContain('href="/this-week"');
    expect(src).toContain('href="/this-weekend"');
  });

  it("still carry exactly one subscribe band (no dark-pattern stacking)", () => {
    const bands = src.match(/<SubscribeBand/g) ?? [];
    expect(bands.length).toBe(1);
  });
});
