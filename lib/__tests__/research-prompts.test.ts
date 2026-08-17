import { describe, it, expect } from "vitest";
import { buildResearchPrompt } from "../agents/prompts";

/**
 * Guards for the pipeline's category research prompts. These are the lever that
 * decides what the weekly agent actually looks for, so the demand-validated
 * coverage the GSC read surfaced (food-truck festivals, cultural/ethnic
 * festivals, night markets) must stay named in the source hints — a silent edit
 * that drops them would quietly re-open the coverage gap. Real proof is Monday's
 * pipeline run; this pins the intent.
 */
describe("buildResearchPrompt — structure", () => {
  const p = buildResearchPrompt("food", "2026-08-01", "2026-08-31");

  it("names the category, window, metro scope, and the JSON-array contract", () => {
    expect(p).toContain("FOOD research agent");
    expect(p).toContain("2026-08-01");
    expect(p).toContain("2026-08-31");
    expect(p).toContain("Minneapolis–St. Paul metro");
    expect(p).toContain("```json");
    // classification honesty — don't force the seeding category
    expect(p).toContain("what the event genuinely IS");
  });
});

describe("demand-validated coverage hints (GSC Aug 2026)", () => {
  it("the food prompt seeks food-truck festivals/rallies and night/street markets", () => {
    const p = buildResearchPrompt("food", "2026-08-01", "2026-08-31").toLowerCase();
    expect(p).toContain("food-truck festivals");
    expect(p).toContain("food truck rally");
    expect(p).toContain("night");
    expect(p).toContain("market");
  });

  it("the festival prompt seeks cultural/ethnic/heritage festivals with concrete examples", () => {
    const p = buildResearchPrompt("festival", "2026-08-01", "2026-08-31");
    expect(p.toLowerCase()).toContain("cultural, ethnic & heritage festivals");
    // a few of the named anchors the metro actually has (and one GSC-demanded one)
    expect(p).toContain("Festival of Nations");
    expect(p).toContain("Hmong");
    expect(p).toContain("St Maron"); // the Lebanese festival that ranked in GSC
    expect(p).toContain("Juneteenth");
  });
});
