import { describe, it, expect } from "vitest";
import { buildResearchPrompt, buildVenueSweepPrompt } from "../agents/prompts";

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

/**
 * Cadence extrapolation (10 Sep 2026). A reader phoned the City of Woodbury:
 * the September Starlight Cinema screening we had published did not exist. The
 * source was a SUMMER movie roundup whose Woodbury dates ended 6 Aug, and the
 * agent had turned "one movie each month this summer" into a 12 Sep listing —
 * writing the cadence into the description in place of the date it never had.
 * Both research prompts must carry the rule; a silent edit that drops it
 * re-opens the same hole.
 */
describe("a cadence is not a schedule", () => {
  it("the category research prompt forbids projecting a series past its named dates", () => {
    const p = buildResearchPrompt("family", "2026-09-01", "2026-09-30");
    expect(p).toContain("A CADENCE IS NOT A SCHEDULE");
    expect(p).toContain("past the last date it names");
    expect(p).toContain("Woodbury");
  });

  it("the venue sweep prompt carries it too", () => {
    const p = buildVenueSweepPrompt(
      "music",
      [{ name: "Turf Club", city: "Saint Paul" }],
      "2026-09-01",
      "2026-09-30",
    );
    expect(p).toContain("A CADENCE IS NOT A SCHEDULE");
    expect(p).toContain("only the dates the calendar itself names");
  });
});

describe("buildResearchPrompt — the venue rule (Sep 2026)", () => {
  const p = buildResearchPrompt("festival", "2026-09-01", "2026-09-30");

  it("forbids hedging an unknown venue, the way it already forbids a hollow title", () => {
    // One index page (festivalguidesandreviews.com/minnesota-festivals/) gave a
    // name, a city and dates but no venue, and the agent filled the gap with a
    // parenthetical instead of skipping. 43 of the site's 53 placeholder venues
    // came from that single URL.
    expect(p).toContain("IF YOU CANNOT SAY WHERE IT IS, OMIT THE EVENT");
    expect(p).toMatch(/A city is not a venue/i);
  });

  it("names the actual strings it produced, so the rule is concrete", () => {
    expect(p).toContain("TBD – Saint Paul");
    expect(p).toContain("Various Locations, City of Eagan");
  });

  it("still forbids the hollow TITLE — the rule it mirrors", () => {
    expect(p).toContain("IF YOU CANNOT NAME WHAT IS HAPPENING, OMIT THE EVENT");
  });
});
