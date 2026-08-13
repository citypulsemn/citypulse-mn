import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * G1.1 — the /this-week landing (the weekly-email shop window). The page is a
 * thin composition of already-tested pure functions (digestEvents,
 * digestWeekLabel, groupEventsByDay), so these tripwires pin the load-bearing
 * wiring the node env can't render: it shows the SAME set the email leads with,
 * frames the Thursday subscribe ask, is canonical + in the sitemap, and degrades
 * honestly when the week is thin.
 */
const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("/this-week page wiring", () => {
  const page = read("app/this-week/page.tsx");

  it("shows the SAME curated set as the email (digestEvents), by week", () => {
    expect(page).toContain("digestEvents");
    expect(page).toContain("digestWeekLabel");
    // reuses the email's selection, not a bespoke query — the whole point
    expect(page).toContain('from "@/lib/digest"');
  });

  it("day-groups the picks for week context (cards show time, not weekday)", () => {
    expect(page).toContain("groupEventsByDay");
    expect(page).toContain("longDate");
  });

  it("is canonical at /this-week", () => {
    expect(page).toContain('canonical: "/this-week"');
  });

  it("carries exactly one subscribe ask, tagged for placement analytics", () => {
    // Source has the band in BOTH the empty and non-empty branches (mutually
    // exclusive at runtime → one band per page, per the no-dark-patterns rule).
    expect(page).toContain('source="this-week"');
    expect(page).toContain("Get this shortlist every Thursday");
  });

  it("frames the page as the Thursday email (conversion intent)", () => {
    expect(page).toContain("every Thursday");
    expect(page).toMatch(/subscribe/i);
  });

  it("degrades honestly when the week is thin (no fake content)", () => {
    expect(page).toContain("day-empty");
    expect(page).toContain("Browse the full calendar");
    // the subscribe ask still stands even with an empty list
    expect(page).toMatch(/picks\.length === 0/);
  });

  it("emits ItemList structured data only when there are picks", () => {
    expect(page).toContain("ItemList");
    expect(page).toContain("picks.length > 0");
  });
});

describe("/this-week OG image + sitemap", () => {
  it("OG card is branded and dated by the week label", () => {
    const og = read("app/this-week/opengraph-image.tsx");
    expect(og).toContain("digestWeekLabel");
    expect(og).toContain("OgCard");
    expect(og).toContain('title: "This Week"');
  });

  it("the page is listed in the sitemap", () => {
    const sitemap = read("app/sitemap.ts");
    expect(sitemap).toContain("/this-week`");
  });
});
