import { describe, it, expect } from "vitest";
import type { CandidateEvent, VariantSelection, WeekWindow } from "../types";
import { buildCopywriterPrompt } from "../prompts";
import { parseCopyJson, writeReelContent, type CopywriterDeps } from "../copywriter";
import { CTA_LINE, detailsLine } from "../format";

/*
 * Golden fixtures. 2026-08-24 is a Monday (see keys.test.ts derivation), so
 * the friday window is Sat 29th–Sun 30th, isoWeek 35 => shotTypeKey 3.
 */
const friday: WeekWindow = {
  postDay: "friday",
  start: "2026-08-29",
  end: "2026-08-30",
  isoWeek: 35,
  shotTypeKey: 3,
  audioLane: 2,
};
const monday: WeekWindow = {
  postDay: "monday",
  start: "2026-08-24",
  end: "2026-08-28",
  isoWeek: 35,
  shotTypeKey: 3,
  audioLane: 2,
};

const ev = (over: Partial<CandidateEvent> = {}): CandidateEvent => ({
  id: "db-1",
  title: "Twins vs Yankees",
  category: "sports",
  venue: "Target Field",
  city: "Minneapolis",
  startAt: "2026-08-29T18:10:00-05:00",
  endAt: null,
  price: "$25",
  priceTier: "$$",
  sourceUrl: "https://www.mlb.com/twins",
  description: "Home series against New York.",
  ...over,
});

const fiveEvents: CandidateEvent[] = [
  ev(),
  ev({ id: "db-2", title: "Jazz Night", venue: "The Dakota", startAt: "2026-08-29T19:00:00-05:00" }),
  ev({ id: "db-3", title: "Uptown Art Fair", venue: "Hennepin Ave", startAt: "2026-08-29T10:00:00-05:00", priceTier: "Free", price: "Free" }),
  ev({ id: "db-4", title: "Saints Fireworks", venue: "CHS Field", city: "St Paul", startAt: "2026-08-29T19:05:00-05:00" }),
  ev({ id: "db-5", title: "Brunch Crawl", venue: "Mill City Market", startAt: "2026-08-30T10:00:00-05:00" }),
];

const selection: VariantSelection = {
  variant: "regular",
  events: fiveEvents,
  shortfall: 0,
  excluded: [],
};

const detailsFor = (w: WeekWindow) => fiveEvents.map((e) => detailsLine(e, w));

describe("buildCopywriterPrompt voice goldens", () => {
  it("regular friday carries the high-energy marker and the name feel", () => {
    const p = buildCopywriterPrompt("friday", "regular", friday, fiveEvents, detailsFor(friday));
    expect(p).toContain("Weekend is here, Minneapolis");
    expect(p).toContain("Twins vs. LA Dodgers");
  });

  it("regular monday swaps high energy for calm-upbeat", () => {
    const p = buildCopywriterPrompt("monday", "regular", monday, fiveEvents, detailsFor(monday));
    expect(p).not.toContain("Weekend is here, Minneapolis");
    expect(p).toContain("calm and upbeat");
  });

  it("family carries the tired-parent markers, with the toolkit's day wording", () => {
    const mon = buildCopywriterPrompt("monday", "family", monday, fiveEvents, detailsFor(monday));
    expect(mon).toContain("Here's your week, parents");
    expect(mon).toContain("tag another parent");
    const fri = buildCopywriterPrompt("friday", "family", friday, fiveEvents, detailsFor(friday));
    expect(fri).toContain("your weekend is sorted");
  });

  it("weird carries the absurdity markers", () => {
    const p = buildCopywriterPrompt("friday", "weird", friday, fiveEvents, detailsFor(friday));
    expect(p).toContain("Minneapolis, what are you doing?");
    expect(p).toContain("72 Corgis. One Racetrack. A Professional Announcer.");
    expect(p).toContain("60 characters or fewer");
  });
});

describe("buildCopywriterPrompt structure goldens", () => {
  const p = buildCopywriterPrompt("friday", "regular", friday, fiveEvents, detailsFor(friday));

  it("names the window dates and the season month", () => {
    expect(p).toContain("2026-08-29 to 2026-08-30");
    expect(p).toContain("August in Minnesota");
  });

  it("numbers the events with their locked details lines", () => {
    expect(p).toContain("1. Twins vs Yankees — Target Field, Minneapolis.");
    expect(p).toContain(`"${detailsLine(fiveEvents[0], friday)}"`);
    expect(p).toContain("5. Brunch Crawl — Mill City Market, Minneapolis.");
  });

  it("assigns the rotated shot type to every line for the week's key", () => {
    // shotTypeKey 2: line i gets SHOT_TYPES[(2 + i) % 4].
    const w2: WeekWindow = { ...monday, isoWeek: 34, shotTypeKey: 2, audioLane: 1 };
    const p2 = buildCopywriterPrompt("monday", "regular", w2, fiveEvents, detailsFor(w2));
    expect(p2).toContain("- Line 1 (HOOK): slow motion close up");
    expect(p2).toContain("- Line 2 (event 1): timelapse cinematic");
    expect(p2).toContain("- Line 3 (event 2): aerial drone");
    expect(p2).toContain("- Line 5 (event 4): slow motion close up");
    expect(p2).toContain("- Line 6 (event 5): timelapse cinematic");
    expect(p2).toContain("- Line 7 (CTA): aerial drone");
  });

  it("carries the banned-term list and the caption bans", () => {
    for (const banned of ["palm", "beach", "ocean", "tropical", "mountain", "europe", "cobblestone", "desert"]) {
      expect(p).toContain(banned);
    }
    expect(p).toContain("No hashtags");
    expect(p).toContain("No emojis");
    expect(p).toContain("under 100 words");
  });

  it("demands fenced JSON in the contract shape", () => {
    expect(p).toContain("```json");
    expect(p).toContain('"names"');
    expect(p).toContain('"broll"');
    expect(p).toContain("exactly 7 lines");
  });
});

/* ------------------------------------------------------------------ */

const validNames = [
  "Twins vs. Yankees at Target Field",
  "Live Jazz at the Dakota",
  "Uptown Art Fair",
  "Saints Fireworks Night",
  "Mill City Brunch Crawl",
];

const validCopy = {
  names: validNames,
  caption:
    "Weekend is here, Minneapolis. Twins take on the Yankees, jazz at the Dakota, art in Uptown, fireworks in St Paul, and a brunch crawl to round it out. Which one are you going to?",
  broll: [
    { label: "HOOK", terms: ["Minneapolis skyline timelapse", "Stone Arch Bridge timelapse", "Mississippi river Minneapolis"] },
    { label: validNames[0], terms: ["Target Field aerial drone", "Minneapolis stadium aerial", "Minnesota baseball crowd"] },
    { label: validNames[1], terms: ["Minneapolis jazz club handheld", "Nicollet Mall street level", "Minnesota live music bar"] },
    { label: validNames[2], terms: ["Uptown Minneapolis slow motion", "Minneapolis art fair closeup", "Lake Bde Maka Ska"] },
    { label: validNames[3], terms: ["St Paul fireworks timelapse", "CHS Field timelapse", "Minnesota summer night sky"] },
    { label: validNames[4], terms: ["Minneapolis farmers market aerial", "Mill City Market drone", "Minnesota fresh produce stall"] },
    { label: "CTA", terms: ["Grain Belt sign street", "Minneapolis riverfront handheld", "Mississippi river bridge"] },
  ],
};

const fence = (o: unknown) => "```json\n" + JSON.stringify(o, null, 2) + "\n```";

describe("parseCopyJson", () => {
  it("extracts fenced JSON surrounded by prose", () => {
    const parsed = parseCopyJson(`Here's the reel.\n${fence(validCopy)}\nEnjoy!`);
    expect(parsed.names).toEqual(validNames);
    expect(parsed.broll).toHaveLength(7);
  });

  it("tolerates unfenced raw JSON", () => {
    const parsed = parseCopyJson(JSON.stringify(validCopy));
    expect(parsed.caption).toBe(validCopy.caption);
  });

  it("coerces a broll line with missing terms to an empty terms array", () => {
    const parsed = parseCopyJson(fence({ ...validCopy, broll: [{ label: "HOOK" }] }));
    expect(parsed.broll).toEqual([{ label: "HOOK", terms: [] }]);
  });

  it("throws descriptively on garbage", () => {
    expect(() => parseCopyJson("I couldn't come up with anything.")).toThrow(/not valid JSON/);
  });

  it("throws when the JSON is not an object", () => {
    expect(() => parseCopyJson(fence([1, 2, 3]))).toThrow(/not a JSON object/);
  });

  it("throws naming the missing keys", () => {
    expect(() => parseCopyJson(fence({ names: [] }))).toThrow(/caption, broll/);
  });
});

/* ------------------------------------------------------------------ */

function fakeComplete(replies: string[]) {
  const prompts: string[] = [];
  const deps: CopywriterDeps = {
    complete: async (p: string) => {
      prompts.push(p);
      return replies[Math.min(prompts.length - 1, replies.length - 1)];
    },
  };
  return { prompts, deps };
}

describe("writeReelContent", () => {
  it("assembles a full ReelContent from one valid reply", async () => {
    const { prompts, deps } = fakeComplete([fence(validCopy)]);
    const content = await writeReelContent("friday", "regular", friday, selection, deps);

    expect(prompts).toHaveLength(1);
    expect(content.day).toBe("friday");
    expect(content.variant).toBe("regular");
    expect(content.card.header).toBe("THIS WEEKEND IN MPLS - AUGUST 29TH-30TH");
    expect(content.card.cta).toBe(CTA_LINE);
    expect(content.card.events.map((e) => e.name)).toEqual(validNames);
    // Details are deterministic — the model never touches them.
    expect(content.card.events.map((e) => e.details)).toEqual(detailsFor(friday));
    expect(content.caption).toBe(validCopy.caption);
    // shotTypeKey 3 => rotation 3,0,1,2,3,0,1.
    expect(content.broll.map((b) => b.shotType)).toEqual([3, 0, 1, 2, 3, 0, 1]);
    expect(content.broll[0].label).toBe("HOOK");
    expect(content.broll[6].label).toBe("CTA");
  });

  it("retries once with the validation errors appended, then succeeds", async () => {
    const fourNames = { ...validCopy, names: validNames.slice(0, 4) };
    const { prompts, deps } = fakeComplete([fence(fourNames), fence(validCopy)]);
    const content = await writeReelContent("friday", "regular", friday, selection, deps);

    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain("Your previous output failed validation");
    expect(prompts[1]).toContain("empty name");
    expect(prompts[1]).toContain("Return corrected JSON only");
    expect(content.card.events.map((e) => e.name)).toEqual(validNames);
  });

  it("throws listing the errors when the retry also fails — never ships invalid", async () => {
    const fourNames = { ...validCopy, names: validNames.slice(0, 4) };
    const { prompts, deps } = fakeComplete([fence(fourNames), fence(fourNames)]);
    await expect(
      writeReelContent("friday", "regular", friday, selection, deps),
    ).rejects.toThrow(/failed validation after retry.*empty name/);
    expect(prompts).toHaveLength(2);
  });

  it("refuses an empty selection up front, before spending a model call", async () => {
    const empty: VariantSelection = { variant: "regular", events: [], shortfall: 5, excluded: [] };
    const { prompts, deps } = fakeComplete([fence(validCopy)]);
    await expect(
      writeReelContent("friday", "regular", friday, empty, deps),
    ).rejects.toThrow(/has 0 events/);
    expect(prompts.length).toBe(0);
  });
});
