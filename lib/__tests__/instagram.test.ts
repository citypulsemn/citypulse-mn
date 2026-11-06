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

describe("buildCards — rule 5, the sixth break (5 Nov 2026)", () => {
  // This filtered with daysSpanned, the CAPPED expansion, which returns the
  // start day alone for a run over 14 days — so a long exhibition running right
  // through the window could never be carded. daysSpanned' own docstring says it
  // answers the calendar grid's question, not this one.
  it("a run longer than the grid cap is carded when it covers a window day", () => {
    const longRun = ev({
      category: "arts",
      title: "Two-month exhibition",
      start: "2026-05-01T10:00",
      end: "",
      multiDayEnd: "2026-09-30T17:00",
    });
    const cards = buildCards([longRun], DAYS);
    const all = [...cards.regular, ...cards.family, ...cards.weird];
    expect(all.map((e) => e.title)).toContain("Two-month exhibition");
  });

  it("…and one that closed before the window is not", () => {
    const over = ev({
      category: "arts",
      title: "Closed exhibition",
      start: "2026-05-01T10:00",
      end: "",
      multiDayEnd: "2026-06-30T17:00",
    });
    const all = [
      ...buildCards([over], DAYS).regular,
      ...buildCards([over], DAYS).family,
      ...buildCards([over], DAYS).weird,
    ];
    expect(all.map((e) => e.title)).not.toContain("Closed exhibition");
  });
});

describe("buildCards + formatCard — ordering and labelling runs (6 Nov 2026)", () => {
  // DAYS is 2026-07-17..19, so the window opens on the 17th.
  // "arts", never "music": PER_NIGHT = {sports, music} and staleSpanIds
  // deletes a music row carrying a multiDayEnd.
  const run = (title: string, start: string, end: string) =>
    ev({ title, category: "arts", start, end: "", multiDayEnd: end });

  it("a run that opened before the window sorts BEHIND what starts inside it", () => {
    // The live shape on 6 Nov 2026: the Regular card led with two rows dated
    // 2026-05-23 because the sort was start-ascending and a run that opened
    // months ago sorts first. "Started longest ago" decided the card.
    const cards = buildCards(
      [
        run("Beach Monster Exhibit", "2026-05-23T10:00", "2027-01-10T17:00"),
        run("Monsters on Vacation", "2026-05-23T10:00", "2027-01-10T17:00"),
        ev({ title: "Food Truck", category: "food", start: "2026-07-17T16:00" }),
        ev({ title: "Static Dress", category: "music", start: "2026-07-17T18:00" }),
        ev({ title: "Volleyball", category: "sports", start: "2026-07-17T18:30" }),
      ],
      DAYS,
    );
    expect(cards.regular.map((e) => e.title).slice(0, 3)).toEqual([
      "Food Truck",
      "Static Dress",
      "Volleyball",
    ]);
  });

  it("but a thin lane still takes the run rather than running short (rule 6)", () => {
    // The live Weird card was 1 of 5, and its only candidate was a run.
    // Pushing runs behind dated events must not empty it.
    const cards = buildCards(
      [run("Haunted Basement", "2026-06-24T19:00", "2026-07-18T23:00")],
      DAYS,
    );
    expect(cards.weird).toHaveLength(0); // it is arts, not weird
    expect(cards.regular.map((e) => e.title)).toEqual(["Haunted Basement"]);
    expect(cards.incomplete).toContain("regular");
  });

  it("a run's card line shows its TRUE SPAN, never a date outside the window", () => {
    const cards = buildCards(
      [run("Fall Flower Show", "2026-06-23T10:00", "2026-07-29T17:00")],
      DAYS,
    );
    const copy = formatCard(cards.regular);
    expect(copy).toContain("JUN 23 – JUL 29 · Fall Flower Show");
    expect(copy).not.toContain("JUN 23 ·"); // not the bare start day
  });

  it("a single-day event keeps the locked DAY M/D tag", () => {
    const cards = buildCards([ev({ title: "Static Dress", start: "2026-07-17T19:00" })], DAYS);
    expect(formatCard(cards.regular)).toContain("FRI 7/17 · Static Dress");
  });

  it("no card line carries a day-tag dated before the window opens", () => {
    const cards = buildCards(
      [
        run("Long run", "2026-05-23T10:00", "2027-01-10T17:00"),
        ev({ title: "Friday show", start: "2026-07-17T19:00" }),
      ],
      DAYS,
    );
    const copy = formatCard(cards.regular);
    // The old tag was daysSpanned(e)[0] — the run's START day — so this line
    // read "SAT 5/23" on a card for 17–19 July. The dated event is untouched;
    // the run now states its real span.
    expect(copy).not.toContain("SAT 5/23");
    expect(copy).toContain("MAY 23 – JAN 10 · Long run");
    expect(copy).toContain("FRI 7/17 · Friday show");
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
