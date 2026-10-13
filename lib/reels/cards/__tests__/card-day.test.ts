import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  buildCardManifest,
  cardManifestRefusal,
  cardProblems,
  cardWasPosted,
  isCardDay,
  nextCardDays,
  parseCardRecord,
  readCardHistory,
  type CardFolderFs,
} from "../card-day";
import { buildPlacesCard } from "../places-card";
import { CARD_SLOT } from "../types";
import { loadManifest, planPublish, type PublisherFsDeps } from "../../publish/publisher";
import type { DayManifest } from "../../publish/types";

const WED = "2026-10-07";
const SLOTS = { regular: CARD_SLOT, family: CARD_SLOT, weird: CARD_SLOT };
const NO_HOLDS = { global: false, variants: new Set<never>() };

/** Round-trips a manifest through JSON and the publisher's own loader. */
function viaPublisher(manifest: DayManifest): DayManifest | null {
  const deps: PublisherFsDeps = {
    readFile: () => JSON.stringify(manifest),
    writeFile: () => {},
    exists: () => true,
  };
  return loadManifest("any", deps);
}

describe("isCardDay / nextCardDays", () => {
  it("is true only on Wednesdays", () => {
    expect(isCardDay("2026-10-07")).toBe(true);
    expect(isCardDay("2026-10-06")).toBe(false);
    expect(isCardDay("2026-10-08")).toBe(false);
  });

  it("a malformed or impossible date is never a card day", () => {
    for (const bad of ["", "2026-10-7", "10/07/2026", "2026-13-01", "2026-02-31", "tomorrow"]) {
      expect(isCardDay(bad)).toBe(false);
    }
  });

  it("lists the next Wednesdays, including today when today is one", () => {
    expect(nextCardDays("2026-10-05", 3)).toEqual(["2026-10-07", "2026-10-14", "2026-10-21"]);
    expect(nextCardDays("2026-10-07", 1)).toEqual(["2026-10-07"]);
  });

  it("steps cleanly across the fall DST change and the new year", () => {
    expect(nextCardDays("2026-10-28", 2)).toEqual(["2026-10-28", "2026-11-04"]);
    expect(nextCardDays("2026-12-24", 2)).toEqual(["2026-12-30", "2027-01-06"]);
  });

  it("refuses a malformed start date", () => {
    expect(() => nextCardDays("soon", 1)).toThrow(/yyyy-mm-dd/);
  });
});

describe("parseCardRecord — only an attested record is history", () => {
  const good = { type: "places", kind: "orchard", slugs: ["a", "b", "c", "d", "e"], postDate: WED };

  it("accepts a well-formed record", () => {
    expect(parseCardRecord(good, WED)).toEqual(good);
  });

  it("rejects a record whose date disagrees with its folder", () => {
    expect(parseCardRecord({ ...good, postDate: "2026-09-30" }, WED)).toBeNull();
  });

  it("rejects unknown kinds, including inherited property names", () => {
    expect(parseCardRecord({ ...good, kind: "casino" }, WED)).toBeNull();
    expect(parseCardRecord({ ...good, kind: "toString" }, WED)).toBeNull();
  });

  it("rejects everything else that is not a record", () => {
    for (const bad of [null, "x", [], {}, { ...good, type: "events" }, { ...good, slugs: [1, 2] }, { ...good, slugs: "a" }]) {
      expect(parseCardRecord(bad, WED)).toBeNull();
    }
    expect(parseCardRecord({ ...good, postDate: "2026-02-31" }, "2026-02-31")).toBeNull();
  });
});

describe("cardProblems", () => {
  const built = buildPlacesCard(WED, []);

  it("the real card for the first Wednesday is fit to post", () => {
    expect(built.status).toBe("built");
    expect(cardProblems(built)).toEqual([]);
  });

  it("a skipped card has nothing to check", () => {
    expect(cardProblems({ status: "skipped", reason: "x", considered: [] })).toEqual([]);
  });

  it("names every reason a built card must not post", () => {
    const broken = {
      ...built,
      caption: "  ",
      altText: "",
      record: undefined,
      content: { ...built.content!, events: built.content!.events.slice(0, 4) },
    };
    expect(cardProblems(broken)).toEqual([
      "card has 4 rows (need exactly 5)",
      "caption is empty",
      "alt text is empty",
      "card has no record for the rotation memory",
    ]);
  });

  it("six rows are as wrong as four, and a blank name as wrong as a blank city", () => {
    const rows = built.content!.events;
    expect(cardProblems({ ...built, content: { ...built.content!, events: [...rows, rows[0]] } })).toEqual([
      "card has 6 rows (need exactly 5)",
    ]);
    const blankName = rows.map((e, i) => (i === 0 ? { ...e, name: "  " } : e));
    expect(cardProblems({ ...built, content: { ...built.content!, events: blankName } })).toEqual([
      "a row is missing its name or its city",
    ]);
  });

  it("holds the caption to the reel caption policy", () => {
    expect(cardProblems({ ...built, caption: "Five orchards — go #now" })).toEqual([
      "caption contains a hashtag",
      "caption contains a dash (em dash, en dash, or spaced hyphen)",
    ]);
  });

  it("catches a row with a blank city", () => {
    const events = built.content!.events.map((e, i) => (i === 2 ? { ...e, details: " " } : e));
    expect(cardProblems({ ...built, content: { ...built.content!, events } })).toEqual([
      "a row is missing its name or its city",
    ]);
  });
});

describe("buildCardManifest — the generator and the publish gate agree", () => {
  const builtManifest = buildCardManifest(WED, "2026-10-07T11:30:00.000Z", {
    status: "built",
    imageFile: "C:/out/2026-10-07_card/card.jpg",
    captionFile: "C:/out/2026-10-07_card/caption.txt",
  });
  const at = (h: number, m: number) => new Date(2026, 9, 7, h, m);

  it("a built card survives the publisher's own loader unchanged", () => {
    expect(viaPublisher(builtManifest)).toEqual(builtManifest);
    expect(builtManifest.window.start).toBe(WED);
    expect(builtManifest.smoke).toBe(false);
  });

  it("the window is the POST date, even for a card built two days ahead", () => {
    const ahead = buildCardManifest(WED, "2026-10-05T17:17:28.037Z", { status: "skipped", reason: "x" });
    expect(ahead.window).toMatchObject({ start: WED, end: WED, postDay: "monday" });
    expect(ahead.generatedAt).toBe("2026-10-05T17:17:28.037Z");
  });

  it("waits before the slot and publishes at it", () => {
    const m = viaPublisher(builtManifest)!;
    expect(planPublish(m, {}, NO_HOLDS, SLOTS, at(11, 44))).toEqual([
      { variant: "family", action: "wait", reason: "slot 11:45 not reached" },
    ]);
    expect(planPublish(m, {}, NO_HOLDS, SLOTS, at(11, 45))[0].action).toBe("publish");
  });

  it("never posts twice, and a HOLD file or a deleted image is a veto", () => {
    const m = viaPublisher(builtManifest)!;
    const ledger = { family: { containerId: "c", mediaId: "m", publishedAt: "t" } };
    expect(planPublish(m, ledger, NO_HOLDS, SLOTS, at(18, 30))[0].action).toBe("skip");
    expect(planPublish(m, {}, { global: true, variants: new Set() }, SLOTS, at(12, 0))[0].action).toBe("hold");
    expect(planPublish(m, {}, NO_HOLDS, SLOTS, at(12, 0), { fileExists: () => false })[0].action).toBe("skip");
  });

  it("a skipped card loads and plans as a skip carrying its reason", () => {
    const skipped = buildCardManifest(WED, "2026-10-07T11:30:00.000Z", {
      status: "skipped",
      reason: "no kind has 10 card-safe places",
    });
    const m = viaPublisher(skipped)!;
    expect(m).not.toBeNull();
    expect(planPublish(m, {}, NO_HOLDS, SLOTS, at(12, 0))).toEqual([
      { variant: "family", action: "skip", reason: "no kind has 10 card-safe places" },
    ]);
  });

  it("refuses a malformed post date", () => {
    expect(() => buildCardManifest("2026-02-31", "t", { status: "skipped", reason: "x" })).toThrow(/yyyy-mm-dd/);
  });
});

/** An in-memory output root: folder name -> file name -> text. */
function folders(tree: Record<string, Record<string, string>>): CardFolderFs {
  const root = "ROOT";
  return {
    list: (dir) => (dir === root ? Object.keys(tree) : []),
    readFile: (path) => {
      for (const [folder, files] of Object.entries(tree)) {
        for (const [file, text] of Object.entries(files)) if (path === join(root, folder, file)) return text;
      }
      throw new Error(`ENOENT: ${path}`);
    },
  };
}
const recordOf = (kind: string, postDate: string) =>
  JSON.stringify({ type: "places", kind, slugs: ["a", "b", "c", "d", "e"], postDate });
const POSTED = JSON.stringify({ family: { containerId: "c1", mediaId: "m1", publishedAt: "2026-10-07T16:45:02.000Z" } });

describe("readCardHistory — only a card that posted is history", () => {
  it("counts a folder whose ledger shows the post", () => {
    const fs = folders({ "2026-10-07_card": { "card.json": recordOf("orchard", "2026-10-07"), "published.json": POSTED } });
    expect(readCardHistory("ROOT", fs)).toEqual({
      records: [{ type: "places", kind: "orchard", slugs: ["a", "b", "c", "d", "e"], postDate: "2026-10-07" }],
      warnings: [],
    });
    expect(cardWasPosted(join("ROOT", "2026-10-07_card"), fs)).toBe(true);
  });

  it("a card that was built and never went out does not retire its kind", () => {
    // Held, refused by Meta, the PC off at both slots, or a rehearsal: card.json, no ledger.
    const fs = folders({
      "2026-09-30_card": { "card.json": recordOf("orchard", "2026-09-30"), HOLD: "" },
      "2026-10-07_card": { "card.json": recordOf("museum", "2026-10-07"), "published.json": "{}" },
      "2026-10-14_card": { "card.json": recordOf("park", "2026-10-14"), "published.json": "not json" },
      // a reel-shaped ledger entry is not a card post
      "2026-10-21_card": {
        "card.json": recordOf("rink", "2026-10-21"),
        "published.json": JSON.stringify({ regular: { containerId: "c", mediaId: "m", publishedAt: "t" } }),
      },
    });
    expect(readCardHistory("ROOT", fs)).toEqual({ records: [], warnings: [] });
    expect(cardWasPosted(join("ROOT", "2026-09-30_card"), fs)).toBe(false);
  });

  it("so a held orchard card does not end orchards for the year", () => {
    const held = folders({ "2026-09-30_card": { "card.json": recordOf("orchard", "2026-09-30"), HOLD: "" } });
    expect(buildPlacesCard(WED, readCardHistory("ROOT", held).records).kind).toBe("orchard");
    const posted = folders({ "2026-09-30_card": { "card.json": recordOf("orchard", "2026-09-30"), "published.json": POSTED } });
    expect(buildPlacesCard(WED, readCardHistory("ROOT", posted).records).kind).not.toBe("orchard");
  });

  it("a posted card with an unreadable record is a warning, not a silent gap", () => {
    const fs = folders({
      "2026-10-07_card": { "card.json": "{ nope", "published.json": POSTED },
      "2026-10-14_card": { "published.json": POSTED },
      "2026-10-21_card": { "card.json": recordOf("orchard", "2026-10-07"), "published.json": POSTED }, // wrong date inside
    });
    const { records, warnings } = readCardHistory("ROOT", fs);
    expect(records).toEqual([]);
    expect(warnings).toEqual([
      "2026-10-07_card posted, but its card.json is unreadable — that week is missing from the 8-week memory",
      "2026-10-14_card posted, but its card.json is unreadable — that week is missing from the 8-week memory",
      "2026-10-21_card posted, but its card.json is unreadable — that week is missing from the 8-week memory",
    ]);
  });

  it("reads card folders only: never a reel day, the previews, or a look-alike", () => {
    const fs = folders({
      "2026-10-05_monday": { "card.json": recordOf("orchard", "2026-10-05"), "published.json": POSTED },
      "_card-previews": { "card.json": recordOf("orchard", "2026-10-07"), "published.json": POSTED },
      "2026-10-07_card_old": { "card.json": recordOf("orchard", "2026-10-07"), "published.json": POSTED },
      "x2026-10-07_card": { "card.json": recordOf("orchard", "2026-10-07"), "published.json": POSTED },
    });
    expect(readCardHistory("ROOT", fs)).toEqual({ records: [], warnings: [] });
  });

  it("a missing output root is an empty history", () => {
    expect(readCardHistory("C:/no/such/folder/anywhere")).toEqual({ records: [], warnings: [] });
  });
});

describe("cardManifestRefusal — the card for today, built today", () => {
  // 11:30 UTC on Oct 7 is 6:30 AM Central: the morning run.
  const morning = buildCardManifest(WED, "2026-10-07T11:30:00.000Z", { status: "skipped", reason: "x" });

  it("lets through the card generated this morning", () => {
    expect(cardManifestRefusal(morning, WED)).toBeNull();
  });

  it("refuses a manifest for another day, rehearsal or not", () => {
    expect(cardManifestRefusal(morning, "2026-10-14")).toBe("the manifest is for 2026-10-07, not 2026-10-14");
    expect(cardManifestRefusal(morning, "2026-10-14", true)).toBe("the manifest is for 2026-10-07, not 2026-10-14");
  });

  it("refuses a card built ahead with --date when its own morning run never happened", () => {
    const ahead = buildCardManifest(WED, "2026-10-05T17:17:28.037Z", { status: "skipped", reason: "x" });
    expect(cardManifestRefusal(ahead, WED)).toBe(
      "the card was generated on 2026-10-05, not today — today's 6:30 generation did not run, and a card built ahead may be out of date",
    );
    // A rehearsal posts nothing, so it may rehearse a card built ahead.
    expect(cardManifestRefusal(ahead, WED, true)).toBeNull();
  });

  it("judges the day on the Minneapolis calendar, not the UTC one", () => {
    // 03:30 UTC on Oct 8 is still 10:30 PM on Wednesday Oct 7 in Minneapolis.
    const lateEvening = buildCardManifest(WED, "2026-10-08T03:30:00.000Z", { status: "skipped", reason: "x" });
    expect(cardManifestRefusal(lateEvening, WED)).toBeNull();
    // 04:30 UTC on Oct 7 is 11:30 PM on Tuesday Oct 6 there.
    const nightBefore = buildCardManifest(WED, "2026-10-07T04:30:00.000Z", { status: "skipped", reason: "x" });
    expect(cardManifestRefusal(nightBefore, WED)).toMatch(/generated on 2026-10-06, not today/);
  });

  it("an unreadable generation time is a refusal, not a pass", () => {
    expect(cardManifestRefusal({ ...morning, generatedAt: "this morning" }, WED)).toMatch(/generated on an unreadable date/);
  });
});
