import { describe, it, expect } from "vitest";
import { validateReelContent, countWords } from "../validate";
import type { BrollLine, ReelContent, WeekWindow } from "../types";

const SUMMER: WeekWindow = {
  postDay: "monday",
  start: "2026-08-03",
  end: "2026-08-07",
  isoWeek: 34,
  shotTypeKey: 2,
  audioLane: 1,
};

const WINTER: WeekWindow = {
  postDay: "monday",
  start: "2026-01-05",
  end: "2026-01-09",
  isoWeek: 2,
  shotTypeKey: 2,
  audioLane: 2,
};

// shotTypes follow (shotTypeKey + i) % 4 with key 2 → 2,3,0,1,2,3,0.
function goodBroll(): BrollLine[] {
  return [
    { label: "HOOK", terms: ["minneapolis skyline dusk", "stone arch bridge", "downtown minneapolis night"], shotType: 2 },
    { label: "EVENT 1", terms: ["dive bar neon", "bar trivia crowd", "st paul street"], shotType: 3 },
    { label: "EVENT 2", terms: ["baseball stadium lights", "ballpark crowd cheering", "night game field"], shotType: 0 },
    { label: "EVENT 3", terms: ["modern art gallery", "museum interior walking", "sculpture garden path"], shotType: 1 },
    { label: "EVENT 4", terms: ["food truck line", "lakeside picnic crowd", "street food closeup"], shotType: 2 },
    { label: "EVENT 5", terms: ["concert crowd lights", "dance floor motion", "stage lights haze"], shotType: 3 },
    { label: "CTA", terms: ["city lights bokeh", "phone in hand", "minneapolis skyline night"], shotType: 0 },
  ];
}

function goodContent(): ReelContent {
  return {
    day: "monday",
    variant: "regular",
    card: {
      variant: "regular",
      header: "THIS WEEK IN MPLS - AUGUST 3RD-7TH",
      events: [
        { name: "Turf Club Trivia Night", details: "Turf Club, St Paul · Mon · 7 PM · Free" },
        { name: "Twins vs Guardians", details: "Target Field, Minneapolis · Tue · 6:40 PM · From $14" },
        { name: "Walker Free Thursday", details: "Walker Art Center · Thu · 5 PM–9 PM · Free" },
        { name: "Uptown Food Truck Rally", details: "Bde Maka Ska, Minneapolis · Wed · 11 AM · Check site" },
        { name: "First Ave Dance Party", details: "First Avenue, Minneapolis · Fri · 9 PM · $15" },
      ],
      cta: "FULL GUIDE AT CITYPULSEMN.COM",
    },
    caption:
      "Five nights, five plans. Trivia at the Turf, Twins under the lights, and the Walker stays free after five on Thursday. Full rundown on the site.",
    broll: goodBroll(),
  };
}

describe("validateReelContent — known-good fixture", () => {
  it("passes clean with no errors and no warnings", () => {
    expect(validateReelContent(goodContent(), SUMMER)).toEqual({
      errors: [],
      warnings: [],
    });
  });
});

describe("card errors", () => {
  it("flags a card without exactly 5 events", () => {
    const c = goodContent();
    c.card.events = c.card.events.slice(0, 4);
    const { errors } = validateReelContent(c, SUMMER);
    expect(errors).toContainEqual(expect.stringContaining("need exactly 5"));
  });

  it("flags an empty name", () => {
    const c = goodContent();
    c.card.events[0].name = "   ";
    const { errors } = validateReelContent(c, SUMMER);
    expect(errors).toContainEqual(expect.stringContaining("empty name"));
  });

  it("flags a name over 60 chars", () => {
    const c = goodContent();
    c.card.events[1].name = "A".repeat(61);
    const { errors } = validateReelContent(c, SUMMER);
    expect(errors).toContainEqual(expect.stringContaining("over 60 chars"));
  });

  it("flags an over-long name on regular, allows it on weird", () => {
    // 8 words: over the 7-word cap the published reels actually run to
    // ("Kids Earn Market Money at Pop Club" is the live 7-word maximum).
    const tenWords = "one two three four five six seven eight";
    const c = goodContent();
    c.card.events[2].name = tenWords;
    expect(validateReelContent(c, SUMMER).errors).toContainEqual(
      expect.stringContaining("over 7 words"),
    );

    const weird = goodContent();
    weird.variant = "weird";
    weird.card.variant = "weird";
    weird.card.events[2].name = tenWords;
    expect(validateReelContent(weird, SUMMER).errors).toEqual([]);
  });

  it("flags a newline inside details", () => {
    const c = goodContent();
    c.card.events[0].details = "Turf Club, St Paul\n· Mon · 7 PM · Free";
    const { errors } = validateReelContent(c, SUMMER);
    expect(errors).toContainEqual(expect.stringContaining("newline"));
  });

  it("flags details over 72 chars", () => {
    const c = goodContent();
    c.card.events[0].details = `${"X".repeat(60)} · Mon · 7 PM · $25`;
    const { errors } = validateReelContent(c, SUMMER);
    expect(errors).toContainEqual(expect.stringContaining("over 72 chars"));
  });

  it("flags a missing, empty, or bare-$ final price segment", () => {
    for (const bad of [
      "Turf Club, St Paul · Mon · 7 PM · ",
      "Turf Club, St Paul · Mon · 7 PM · $",
      "just one segment no separators",
    ]) {
      const c = goodContent();
      c.card.events[0].details = bad;
      const { errors } = validateReelContent(c, SUMMER);
      expect(errors).toContainEqual(expect.stringContaining("price segment"));
    }
  });

  it("flags emoji anywhere on the card", () => {
    const inName = goodContent();
    inName.card.events[0].name = "Turf Club Trivia 🎉";
    expect(validateReelContent(inName, SUMMER).errors).toContain("card contains emoji");

    const inHeader = goodContent();
    inHeader.card.header = "THIS WEEK IN MPLS ⭐ - AUGUST 3RD-7TH";
    expect(validateReelContent(inHeader, SUMMER).errors).toContain("card contains emoji");
  });
});

describe("caption errors", () => {
  it("flags 100 words, allows 99", () => {
    const c = goodContent();
    c.caption = Array(100).fill("word").join(" ");
    expect(validateReelContent(c, SUMMER).errors).toContainEqual(
      expect.stringContaining("100"),
    );
    c.caption = Array(99).fill("word").join(" ");
    expect(validateReelContent(c, SUMMER).errors).toEqual([]);
  });

  it("flags hashtags", () => {
    const c = goodContent();
    c.caption = "Great week ahead #minneapolis";
    expect(validateReelContent(c, SUMMER).errors).toContainEqual(
      expect.stringContaining("hashtag"),
    );
  });

  it("flags em dash, en dash, and spaced hyphen", () => {
    for (const bad of [
      "Five plans — all good ones",
      "Five plans – all good ones",
      "Five plans - all good ones",
    ]) {
      const c = goodContent();
      c.caption = bad;
      expect(validateReelContent(c, SUMMER).errors).toContainEqual(
        expect.stringContaining("dash"),
      );
    }
  });

  it("allows intra-word hyphens like Kid-Friendly", () => {
    const c = goodContent();
    c.caption = "Kid-Friendly picks all week, sun-up to sun-down.";
    expect(validateReelContent(c, SUMMER).errors).toEqual([]);
  });
});

describe("broll errors", () => {
  it("flags a plan without exactly 7 lines", () => {
    const c = goodContent();
    c.broll = c.broll.slice(0, 6);
    const { errors } = validateReelContent(c, SUMMER);
    expect(errors).toEqual([expect.stringContaining("need exactly 7")]);
  });

  it("flags a line without exactly 3 terms", () => {
    const c = goodContent();
    c.broll[1].terms = ["dive bar neon", "bar trivia crowd"];
    const { errors } = validateReelContent(c, SUMMER);
    expect(errors).toContainEqual(expect.stringContaining("need exactly 3"));
  });

  it("flags 1-word and 6-word terms, allows 2 and 5", () => {
    const one = goodContent();
    one.broll[0].terms[0] = "skyline";
    expect(validateReelContent(one, SUMMER).errors).toContainEqual(
      expect.stringContaining('"skyline"'),
    );

    const six = goodContent();
    six.broll[0].terms[0] = "very long six word search term";
    expect(validateReelContent(six, SUMMER).errors).toContainEqual(
      expect.stringContaining("6 words"),
    );

    const ok = goodContent();
    ok.broll[0].terms[0] = "city skyline"; // 2 words
    ok.broll[0].terms[1] = "slow motion downtown skyline aerial"; // 5 with shot modifier
    expect(validateReelContent(ok, SUMMER).errors).toEqual([]);
  });

  it("flags a shotType off the weekly rotation", () => {
    const c = goodContent();
    c.broll[0].shotType = 3; // key 2 line 0 must be 2
    const { errors } = validateReelContent(c, SUMMER);
    expect(errors).toContainEqual(expect.stringContaining("rotation expects 2"));
  });

  it("flags banned not-Minneapolis terms, case-insensitively", () => {
    const c = goodContent();
    c.broll[0].terms[0] = "palm trees sway";
    c.broll[6].terms[2] = "Tropical Sunset View";
    const { errors } = validateReelContent(c, SUMMER);
    expect(errors).toContainEqual(expect.stringContaining('banned word "palm"'));
    expect(errors).toContainEqual(expect.stringContaining('banned word "tropical"'));
  });
});

describe("seasonal mismatch — warnings, never errors", () => {
  it("warns on snow terms in a summer window", () => {
    const c = goodContent();
    c.broll[0].terms[0] = "fresh snow falling";
    const { errors, warnings } = validateReelContent(c, SUMMER);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([expect.stringContaining("out of season")]);
  });

  it("warns on kayak terms in a winter window, not in summer", () => {
    const c = goodContent();
    c.broll[3].terms[0] = "kayak launch dock";
    expect(validateReelContent(c, WINTER).warnings).toEqual([
      expect.stringContaining('"kayak"'),
    ]);
    expect(validateReelContent(c, SUMMER).warnings).toEqual([]);
  });

  it("a banned term stays an error even when it is also seasonal", () => {
    const c = goodContent();
    c.broll[4].terms[1] = "sunny beach day";
    const winter = validateReelContent(c, WINTER);
    expect(winter.errors).toContainEqual(expect.stringContaining('banned word "beach"'));
    expect(winter.warnings).toContainEqual(expect.stringContaining("out of season"));
  });
});

describe("honest emptiness", () => {
  it("an empty reel reports its gaps instead of crashing or inventing", () => {
    const c = goodContent();
    c.card.events = [];
    c.broll = [];
    c.caption = "";
    const { errors, warnings } = validateReelContent(c, SUMMER);
    expect(errors).toContainEqual(expect.stringContaining("0 events"));
    expect(errors).toContainEqual(expect.stringContaining("0 lines"));
    expect(warnings).toEqual([]);
  });
});

describe("countWords", () => {
  it("counts plainly, hyphenated words as one", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   ")).toBe(0);
    expect(countWords("one")).toBe(1);
    expect(countWords("Kid-Friendly fun")).toBe(2);
    expect(countWords("  spaced   out   words  ")).toBe(3);
  });
});
