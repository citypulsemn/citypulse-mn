import { describe, it, expect } from "vitest";
import type { WeekWindow } from "../types";
import { buildTopUpPrompt } from "../prompts";
import { parseTopUpEvents, topUpVariant, type TopUpDeps } from "../research-topup";

const friday: WeekWindow = {
  postDay: "friday",
  start: "2026-08-29",
  end: "2026-08-30",
  isoWeek: 35,
  shotTypeKey: 3,
  audioLane: 2,
};

const goodRow = {
  title: "Corn Maze Opening",
  category: "family",
  venue: "Sever's Fall Festival",
  city: "Shakopee",
  startAt: "2026-08-29T10:00:00-05:00",
  endAt: "2026-08-29T18:00:00-05:00",
  price: "$18",
  priceTier: "$$",
  sourceUrl: "https://seversfestivals.com",
  description: "Opening weekend of the corn maze.",
};

const fence = (o: unknown) => "```json\n" + JSON.stringify(o, null, 2) + "\n```";

describe("buildTopUpPrompt", () => {
  const p = buildTopUpPrompt("weird", friday, 2, ["Corgi Races", "Silent Disco"]);

  it("states the need, the window, and the have-list", () => {
    expect(p).toContain("Find 2 MORE real events");
    expect(p).toContain("2026-08-29");
    expect(p).toContain("2026-08-30");
    expect(p).toContain("- Corgi Races");
    expect(p).toContain("- Silent Disco");
  });

  it("locks the brand exclusions in", () => {
    expect(p).toContain("political");
    expect(p).toContain("drag");
  });

  it("describes the variant fit", () => {
    expect(p).toContain("genuinely strange");
    const fam = buildTopUpPrompt("family", friday, 1, []);
    expect(fam).toContain("past 7pm");
    expect(fam).toContain("free events preferred");
    expect(buildTopUpPrompt("regular", friday, 1, [])).toContain("general-interest");
  });

  it("demands verified sources, the -05:00 offset, and honest emptiness", () => {
    expect(p).toContain("-05:00");
    expect(p).toContain("sourceUrl");
    expect(p).toContain("never invent one");
    expect(p).toContain("[] if you found nothing verifiable");
  });

  it("says so when nothing is on the card yet", () => {
    expect(buildTopUpPrompt("weird", friday, 5, [])).toContain("Nothing is on the card yet.");
  });
});

describe("parseTopUpEvents", () => {
  it("coerces a full valid row, forcing id null", () => {
    const { events, warnings } = parseTopUpEvents(fence([goodRow]), "weird");
    expect(warnings).toEqual([]);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ id: null, ...goodRow });
  });

  it("skips rows missing title, startAt, or sourceUrl — one warning each", () => {
    const rows = [
      goodRow,
      { ...goodRow, title: "No Source", sourceUrl: undefined },
      { ...goodRow, title: undefined },
      { ...goodRow, title: "No Start", startAt: undefined },
      { ...goodRow, title: "Bad Start", startAt: "next Friday" },
    ];
    const { events, warnings } = parseTopUpEvents(fence(rows), "weird");
    expect(events.map((e) => e.title)).toEqual(["Corn Maze Opening"]);
    expect(warnings).toHaveLength(4);
    expect(warnings[0]).toMatch(/"No Source": missing sourceUrl/);
    expect(warnings[1]).toMatch(/row 3: missing title/);
    expect(warnings[2]).toMatch(/"No Start": missing or unparseable startAt/);
    expect(warnings[3]).toMatch(/"Bad Start": missing or unparseable startAt/);
  });

  it("falls back on an invalid category, with a warning", () => {
    const { events, warnings } = parseTopUpEvents(
      fence([{ ...goodRow, category: "circus" }]),
      "weird",
    );
    expect(events[0].category).toBe("weird");
    expect(warnings[0]).toMatch(/category "circus" is not valid/);
  });

  it("coerces a bad priceTier from the price text, never guessing Free", () => {
    const rows = [
      { ...goodRow, priceTier: "cheap", price: "Free admission" },
      { ...goodRow, title: "Paid Thing", priceTier: undefined, price: "$10" },
    ];
    const { events } = parseTopUpEvents(fence(rows), "weird");
    expect(events[0].priceTier).toBe("Free");
    expect(events[1].priceTier).toBe("$$");
  });

  it("defaults endAt to null when absent", () => {
    const { events } = parseTopUpEvents(fence([{ ...goodRow, endAt: undefined }]), "weird");
    expect(events[0].endAt).toBeNull();
  });

  it("returns honest empty with a warning on garbage", () => {
    expect(parseTopUpEvents("I found nothing, sorry.", "weird")).toEqual({
      events: [],
      warnings: ["top-up reply was not valid JSON; no events used"],
    });
  });

  it("returns honest empty with a warning on a non-array", () => {
    expect(parseTopUpEvents(fence({ events: [] }), "weird")).toEqual({
      events: [],
      warnings: ["top-up reply was not a JSON array; no events used"],
    });
  });

  it("an empty fenced array is clean emptiness — no warnings", () => {
    expect(parseTopUpEvents(fence([]), "weird")).toEqual({ events: [], warnings: [] });
  });
});

function fakeSearch(reply: string) {
  const prompts: string[] = [];
  const deps: TopUpDeps = {
    completeWithSearch: async (p: string) => {
      prompts.push(p);
      return reply;
    },
  };
  return { prompts, deps };
}

describe("topUpVariant", () => {
  it("returns immediately without a model call when nothing is needed", async () => {
    const { prompts, deps } = fakeSearch(fence([goodRow]));
    expect(await topUpVariant("family", friday, 0, [], deps)).toEqual({ events: [], warnings: [] });
    expect(prompts).toHaveLength(0);
  });

  it("keeps verified in-window rows and passes need/haveTitles to the prompt", async () => {
    const second = { ...goodRow, title: "Kite Festival", startAt: "2026-08-30T11:00:00-05:00" };
    const { prompts, deps } = fakeSearch(fence([goodRow, second]));
    const { events, warnings } = await topUpVariant("family", friday, 2, ["Zoo Day"], deps);

    expect(events.map((e) => e.title)).toEqual(["Corn Maze Opening", "Kite Festival"]);
    expect(events.every((e) => e.id === null)).toBe(true);
    expect(warnings).toEqual([]);
    expect(prompts[0]).toContain("Find 2 MORE real events");
    expect(prompts[0]).toContain("- Zoo Day");
  });

  it("drops out-of-window rows with a warning — clamp by dropping, never shifting", async () => {
    const late = { ...goodRow, title: "September Thing", startAt: "2026-09-05T10:00:00-05:00" };
    const { deps } = fakeSearch(fence([goodRow, late]));
    const { events, warnings } = await topUpVariant("weird", friday, 2, [], deps);

    expect(events.map((e) => e.title)).toEqual(["Corn Maze Opening"]);
    expect(warnings).toEqual([
      '"September Thing" starts 2026-09-05, outside 2026-08-29..2026-08-30 — dropped',
    ]);
  });

  it("drops case-insensitive duplicates of events already on the card", async () => {
    const dupe = { ...goodRow, title: "CORN MAZE OPENING" };
    const { deps } = fakeSearch(fence([dupe]));
    const { events, warnings } = await topUpVariant("weird", friday, 1, ["Corn Maze Opening"], deps);

    expect(events).toEqual([]);
    expect(warnings[0]).toMatch(/duplicates an event already on the card/);
  });
});
