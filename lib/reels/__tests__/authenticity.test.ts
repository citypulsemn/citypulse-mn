import { describe, it, expect } from "vitest";
import {
  buildScreenPrompt,
  makeScreenImages,
  parseScreenVerdicts,
  seasonScreenNote,
} from "../authenticity";

describe("seasonScreenNote", () => {
  it("summer rejects snow and winter tells — the owner's 'no snow in summer' rule", () => {
    for (const m of [6, 7, 8]) {
      const note = seasonScreenNote(m);
      expect(note).toContain("SUMMER");
      expect(note).toContain("snow");
      expect(note).toContain("frozen lakes");
      expect(note).toContain("winter coats");
    }
  });

  it("winter rejects lush-summer tells", () => {
    for (const m of [12, 1, 2]) {
      const note = seasonScreenNote(m);
      expect(note).toContain("WINTER");
      expect(note).toContain("lush green");
      expect(note).toContain("kayaking");
    }
  });

  it("spring and fall reject the opposite extremes", () => {
    for (const m of [3, 4, 5]) {
      const note = seasonScreenNote(m);
      expect(note).toContain("SPRING");
      expect(note).toContain("heavy snow cover");
      expect(note).toContain("autumn foliage");
    }
    for (const m of [9, 10, 11]) {
      const note = seasonScreenNote(m);
      expect(note).toContain("FALL");
      expect(note).toContain("heavy snow cover");
      expect(note).toContain("spring blossoms");
    }
  });

  it("covers every month with exactly one season", () => {
    for (let m = 1; m <= 12; m++) {
      const matches = ["WINTER", "SPRING", "SUMMER", "FALL"].filter((s) =>
        seasonScreenNote(m).includes(s),
      );
      expect(matches).toHaveLength(1);
    }
  });
});

describe("buildScreenPrompt", () => {
  it("carries both the geography bans and the season note", () => {
    const p = buildScreenPrompt(seasonScreenNote(7));
    expect(p).toContain("palm trees");
    expect(p).toContain("European architecture");
    expect(p).toContain("SUMMER");
    expect(p).toContain("interiors are always season-neutral");
    expect(p).toContain("JSON array of booleans");
  });
});

describe("parseScreenVerdicts", () => {
  it("parses a plain array and coerces non-boolean entries to false", () => {
    expect(parseScreenVerdicts("[true, false, 1]", 3)).toEqual([true, false, false]);
  });

  it("parses an array embedded in prose", () => {
    expect(parseScreenVerdicts("Here are my verdicts: [true, true] — done", 2)).toEqual([
      true,
      true,
    ]);
  });

  it("throws on a missing array and on a length mismatch", () => {
    expect(() => parseScreenVerdicts("no array here", 2)).toThrow(/no JSON array/);
    expect(() => parseScreenVerdicts("[true]", 2)).toThrow(/1 verdicts for 2 images/);
  });
});

describe("makeScreenImages", () => {
  it("passes the season note through and returns the screen's verdicts", async () => {
    const warnings: string[] = [];
    const seen: string[] = [];
    const screen = makeScreenImages(warnings, "SEASON-NOTE", async (urls, note) => {
      seen.push(note);
      return urls.map((_, i) => i === 0);
    });
    await expect(screen(["a", "b"])).resolves.toEqual([true, false]);
    expect(seen).toEqual(["SEASON-NOTE"]);
    expect(warnings).toEqual([]);
  });

  it("fails open with a warning when the screen errors — never kills the run", async () => {
    const warnings: string[] = [];
    const screen = makeScreenImages(warnings, "note", async () => {
      throw new Error("api down");
    });
    await expect(screen(["a", "b", "c"])).resolves.toEqual([true, true, true]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("api down");
    expect(warnings[0]).toContain("3 candidate(s) unscreened");
  });
});
