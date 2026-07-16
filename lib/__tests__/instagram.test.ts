import { describe, it, expect } from "vitest";
import {
  exclusionReason,
  buildCards,
  formatCard,
  renderCaption,
  CARD_SIZE,
  REGULAR_MAX_PER_CATEGORY,
} from "../instagram";
import type { EventRecord } from "../types";

const DAYS = ["2026-07-17", "2026-07-18", "2026-07-19"];

let seq = 0;
function ev(overrides: Partial<EventRecord> = {}): EventRecord {
  seq += 1;
  return {
    id: `e${seq}`,
    title: "Show", category: "music", venue: "First Avenue", address: "",
    city: "Minneapolis", lat: 44.9, lng: -93.2,
    start: "2026-07-17T19:00", end: "", price: "$20", priceTier: "$$",
    ticketUrl: "", description: "", image: "", sourceUrl: "",
    status: "published", multiDayEnd: null, allDay: false,
    ...overrides,
  };
}

describe("exclusionReason — the locked blocklist, with its documented exceptions", () => {
  const CASES: [string, string | null][] = [
    // Drag rule: shows out, motorsports in.
    ["Drag Brunch at LUSH", "drag"],
    ["Drag Queen Story Hour", "drag"],
    ["Drag Racing Night at BIR", null],
    ["Drag Strip Test & Tune", null],
    // Political rule: politics out, homonyms in.
    ["Rally for Housing Justice", "political"],
    ["Rallycross Exhibition", null],
    ["Rally Car Show & Shine", null],
    ["March for Science", "political"],
    ["March Madness Watch Party", null],
    ["City Council Candidate Forum", "political"],
    ["Election Night Watch Party", "political"],
    // Clean events pass untouched.
    ["Trampled by Turtles", null],
    ["Weird Al Yankovic", null], // "weird" is a category, not a blocked word
  ];
  for (const [title, expected] of CASES) {
    it(`"${title}" → ${expected ?? "clean"}`, () => {
      expect(exclusionReason({ title, description: "" })).toBe(expected);
    });
  }

  it("also scans the description", () => {
    expect(
      exclusionReason({ title: "Community Gathering", description: "A protest against the new ordinance" }),
    ).toBe("political");
  });
});

describe("buildCards — the locked structural rules", () => {
  const pool = [
    // 6 family, 6 weird, plenty of regular
    ...Array.from({ length: 6 }, (_, i) => ev({ category: "family", start: `2026-07-17T1${i}:00` })),
    ...Array.from({ length: 6 }, (_, i) => ev({ category: "weird", start: `2026-07-18T1${i}:00` })),
    ...Array.from({ length: 4 }, (_, i) => ev({ category: "music", start: `2026-07-17T2${i % 4}:00` })),
    ...Array.from({ length: 3 }, () => ev({ category: "festival" })),
    ...Array.from({ length: 2 }, () => ev({ category: "food" })),
    ev({ category: "arts" }),
  ];

  it("EXACTLY five per card, three variants, zero overlap", () => {
    const cards = buildCards(pool, DAYS);
    expect(cards.regular).toHaveLength(CARD_SIZE);
    expect(cards.family).toHaveLength(CARD_SIZE);
    expect(cards.weird).toHaveLength(CARD_SIZE);
    const ids = [...cards.regular, ...cards.family, ...cards.weird].map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length); // no overlap between variants
    expect(cards.incomplete).toEqual([]);
  });

  it("variants stay in their lanes: family=family, weird=weird, regular=the rest", () => {
    const cards = buildCards(pool, DAYS);
    expect(cards.family.every((e) => e.category === "family")).toBe(true);
    expect(cards.weird.every((e) => e.category === "weird")).toBe(true);
    expect(cards.regular.every((e) => !["family", "weird"].includes(e.category))).toBe(true);
  });

  it("Regular caps any one category for variety", () => {
    const cards = buildCards(pool, DAYS);
    const perCat = new Map<string, number>();
    for (const e of cards.regular) perCat.set(e.category, (perCat.get(e.category) ?? 0) + 1);
    for (const n of perCat.values()) expect(n).toBeLessThanOrEqual(REGULAR_MAX_PER_CATEGORY);
  });

  it("a thin week yields an INCOMPLETE card, never padding", () => {
    const thin = [ev({ category: "weird" }), ev({ category: "weird" }), ev({ category: "music" })];
    const cards = buildCards(thin, DAYS);
    expect(cards.weird).toHaveLength(2);
    expect(cards.incomplete).toContain("weird");
    expect(cards.incomplete).toContain("family");
  });

  it("excluded events are REPORTED with reasons, not silently dropped", () => {
    const withBanned = [...pool, ev({ title: "Drag Brunch", category: "food" }), ev({ title: "Rally for X", category: "festival" })];
    const cards = buildCards(withBanned, DAYS);
    const reasons = cards.excluded.map((x) => x.reason).sort();
    expect(reasons).toEqual(["drag", "political"]);
    const allIds = [...cards.regular, ...cards.family, ...cards.weird].map((e) => e.id);
    for (const x of cards.excluded) expect(allIds).not.toContain(x.event.id);
  });

  it("events outside the window never appear", () => {
    const cards = buildCards([ev({ start: "2026-08-20T19:00" }), ...pool], DAYS);
    const all = [...cards.regular, ...cards.family, ...cards.weird];
    expect(all.every((e) => e.start.slice(0, 10) <= "2026-07-19")).toBe(true);
  });
});

describe("card copy + captions", () => {
  it("two lines per event, blank line between events", () => {
    const card = formatCard([
      ev({ title: "Trampled by Turtles", venue: "First Avenue", start: "2026-07-17T20:00", price: "$45" }),
      ev({ title: "Como Family Day", venue: "Como Zoo", start: "2026-07-18T00:00", allDay: true, price: "Free" }),
    ]);
    const blocks = card.split("\n\n");
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toBe("FRI 7/17 · Trampled by Turtles\nFirst Avenue · 8 PM · $45");
    expect(blocks[1]).toBe("SAT 7/18 · Como Family Day\nComo Zoo · All day · Free");
  });

  it("captions carry the hook, the /this-weekend bio link, and variant hashtags", () => {
    const c = renderCaption("weird", "July 17–19");
    expect(c).toContain("July 17–19");
    expect(c).toContain("citypulsemn.com/this-weekend");
    expect(c).toContain("#weirdminneapolis");
  });
});
