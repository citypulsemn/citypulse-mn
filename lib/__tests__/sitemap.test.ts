import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Source tripwires for the sitemap freshness fix (Aug 16). GSC URL Inspection
 * found /places + /this-week "URL is unknown to Google" despite being listed,
 * linked, and robots-allowed — the sitemap carried NO <lastmod> at all, so Google
 * had no freshness signal to (re)crawl the new pages. The sitemap route reads the
 * DB (can't unit-render here), so we guard the wiring by source, per convention.
 */
const src = readFileSync(join(__dirname, "..", "..", "app", "sitemap.ts"), "utf8");

describe("sitemap carries a day-stable lastModified (freshness signal)", () => {
  it("derives a day-granular `today` from the Chicago day key (not a per-request instant)", () => {
    expect(src).toContain("chiDayKey");
    expect(src).toMatch(/const today = new Date\(chiDayKey\(new Date\(\)\)\)/);
  });

  it("stamps the evergreen browse surfaces that were going undiscovered", () => {
    // The previously-unknown pages + their siblings must now carry lastModified.
    expect(src).toContain("/places`, lastModified: today");
    expect(src).toContain("/this-week`, lastModified: today");
    expect(src).toContain("/this-weekend`, lastModified: today");
    // the per-kind and collection maps too
    expect(src).toMatch(/places\/\$\{k\.meta\.kind\}`,\s*lastModified: today/);
    expect(src).toMatch(/collections\/\$\{c\.slug\}`,\s*lastModified: today/);
  });

  it("stamps the homepage and day pages", () => {
    expect(src).toMatch(/url: SITE_URL, lastModified: today/);
    expect(src).toMatch(/day\/\$\{d\}`,\s*lastModified: today/);
  });
});
