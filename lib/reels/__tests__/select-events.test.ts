import { describe, it, expect } from "vitest";
import { screenEvent, partitionEvents, selectFive } from "../select-events";
import type { CandidateEvent, WeekWindow } from "../types";

// Week of Mon Aug 24 – Fri Aug 28, 2026 (CDT, so -05:00 offsets read literally).
const MON: WeekWindow = {
  postDay: "monday",
  start: "2026-08-24",
  end: "2026-08-28",
  isoWeek: 35,
  shotTypeKey: 3,
  audioLane: 2,
};

function ev(over: Partial<CandidateEvent> & { title: string; startAt: string }): CandidateEvent {
  return {
    id: `id-${over.title}`,
    category: "music",
    venue: "First Avenue",
    city: "Minneapolis",
    endAt: null,
    price: "$20",
    priceTier: "$$",
    sourceUrl: "https://example.com/e",
    description: "",
    ...over,
  };
}

describe("screenEvent — locked brand rules", () => {
  it("excludes political events by title", () => {
    for (const title of [
      "Get Out the Vote Rally",
      "Climate Protest at the Capitol",
      "March for Our Lives MN",
      "Campaign Kickoff with the Mayor",
      "Partisan Trivia Night",
    ]) {
      const reason = screenEvent(ev({ title, startAt: "2026-08-25T18:00:00-05:00" }));
      expect(reason, title).toMatch(/^brand rule: political/);
    }
  });

  it("excludes political events found only in the description", () => {
    const e = ev({
      title: "Evening on the Patio",
      startAt: "2026-08-25T18:00:00-05:00",
      description: "A fundraiser for a candidate for city council.",
    });
    expect(screenEvent(e)).toBe('brand rule: political ("fundraiser for a candidate")');
  });

  it("does NOT flag the false-positive guards", () => {
    for (const title of [
      "Marching Band Spectacular",
      "U of M Marching Band Preview",
      "Campaign for Kindness Gala",
      "March Madness Watch Party",
    ]) {
      expect(screenEvent(ev({ title, startAt: "2026-08-25T18:00:00-05:00" })), title).toBeNull();
    }
  });

  it("does NOT flag the month of March or 'bipartisan' in descriptions", () => {
    expect(
      screenEvent(
        ev({
          title: "Nordeast Farmers Market",
          startAt: "2026-08-25T09:00:00-05:00",
          description: "Runs Saturdays through March at the pavilion.",
        }),
      ),
    ).toBeNull();
    expect(
      screenEvent(
        ev({
          title: "State Fair Kickoff",
          startAt: "2026-08-25T09:00:00-05:00",
          description: "A bipartisan crowd shows up for the cheese curds.",
        }),
      ),
    ).toBeNull();
  });

  it("excludes all drag events", () => {
    for (const title of [
      "Drag Brunch at the Union",
      "Drag Bingo Night",
      "Drag Story Hour",
      "Neon Drag Show Extravaganza",
      "Drag Queen Trivia",
    ]) {
      const reason = screenEvent(ev({ title, startAt: "2026-08-25T18:00:00-05:00" }));
      expect(reason, title).toMatch(/^brand rule: drag event/);
    }
  });

  it("does NOT flag drag racing or dragon boats", () => {
    expect(
      screenEvent(ev({ title: "Drag Racing Nationals", startAt: "2026-08-25T18:00:00-05:00" })),
    ).toBeNull();
    expect(
      screenEvent(ev({ title: "Dragon Boat Festival", startAt: "2026-08-25T18:00:00-05:00" })),
    ).toBeNull();
  });

  it("passes an ordinary event", () => {
    expect(
      screenEvent(ev({ title: "Cloud Cult at First Avenue", startAt: "2026-08-25T20:00:00-05:00" })),
    ).toBeNull();
  });
});

describe("partitionEvents — screen, window, and variant routing", () => {
  it("routes weird to weird, daytime family to family, everything else to regular", () => {
    const events = [
      ev({ title: "Show", category: "music", startAt: "2026-08-25T20:00:00-05:00" }),
      ev({ title: "Game", category: "sports", startAt: "2026-08-25T18:40:00-05:00" }),
      ev({ title: "Opening", category: "arts", startAt: "2026-08-26T17:00:00-05:00" }),
      ev({ title: "Tasting", category: "food", startAt: "2026-08-26T18:00:00-05:00" }),
      ev({ title: "Fest", category: "festival", startAt: "2026-08-27T12:00:00-05:00" }),
      ev({ title: "Odd Thing", category: "weird", startAt: "2026-08-27T21:00:00-05:00" }),
      ev({ title: "Storytime", category: "family", startAt: "2026-08-28T10:00:00-05:00" }),
    ];
    const { pools, excluded } = partitionEvents(events, MON);
    expect(pools.regular.map((e) => e.title)).toEqual(["Show", "Game", "Opening", "Tasting", "Fest"]);
    expect(pools.weird.map((e) => e.title)).toEqual(["Odd Thing"]);
    expect(pools.family.map((e) => e.title)).toEqual(["Storytime"]);
    expect(excluded).toEqual([]);
  });

  it("family gate: 18:59 local is kept, exactly 19:00 is excluded", () => {
    const kept = ev({ title: "Early", category: "family", startAt: "2026-08-25T18:59:00-05:00" });
    const cut = ev({ title: "Late", category: "family", startAt: "2026-08-25T19:00:00-05:00" });
    const { pools, excluded } = partitionEvents([kept, cut], MON);
    expect(pools.family.map((e) => e.title)).toEqual(["Early"]);
    expect(excluded).toEqual([
      { title: "Late", reason: "family gate: starts 19:00 local (7 PM or later)" },
    ]);
  });

  it("family gate: the local hour comes from the offset, not the raw string", () => {
    // 00:30 UTC on Aug 26 is 19:30 the evening BEFORE in Minneapolis.
    const e = ev({ title: "Zulu Time", category: "family", startAt: "2026-08-26T00:30:00Z" });
    const { pools, excluded } = partitionEvents([e], MON);
    expect(pools.family).toEqual([]);
    expect(excluded[0].reason).toBe("family gate: starts 19:30 local (7 PM or later)");
  });

  it("family gate: 21+ events are excluded even in the daytime", () => {
    const e = ev({
      title: "Bingo Afternoon",
      category: "family",
      startAt: "2026-08-25T14:00:00-05:00",
      description: "21+ only, valid ID required.",
    });
    const { pools, excluded } = partitionEvents([e], MON);
    expect(pools.family).toEqual([]);
    expect(excluded).toEqual([{ title: "Bingo Afternoon", reason: "family gate: 21+ event" }]);
  });

  it("window test uses the LOCAL date, inclusive on both ends", () => {
    const events = [
      // 02:00 UTC Sat Aug 29 = 21:00 Fri Aug 28 local — inside
      ev({ title: "Friday Late", startAt: "2026-08-29T02:00:00Z" }),
      // 05:00 UTC = midnight Sat Aug 29 local — outside
      ev({ title: "Saturday Midnight", startAt: "2026-08-29T05:00:00Z" }),
      ev({ title: "Sunday Before", startAt: "2026-08-23T20:00:00-05:00" }),
      ev({ title: "Monday Morning", startAt: "2026-08-24T09:00:00-05:00" }),
    ];
    const { pools, excluded } = partitionEvents(events, MON);
    expect(pools.regular.map((e) => e.title)).toEqual(["Friday Late", "Monday Morning"]);
    expect(excluded).toEqual([
      {
        title: "Saturday Midnight",
        reason: "outside window 2026-08-24..2026-08-28 (local start 2026-08-29)",
      },
      {
        title: "Sunday Before",
        reason: "outside window 2026-08-24..2026-08-28 (local start 2026-08-23)",
      },
    ]);
  });

  it("brand screen runs first — a political event outside the window gets the brand reason", () => {
    const e = ev({ title: "Capitol Rally", startAt: "2026-09-10T12:00:00-05:00" });
    const { excluded } = partitionEvents([e], MON);
    expect(excluded).toEqual([{ title: "Capitol Rally", reason: 'brand rule: political ("rally")' }]);
  });

  it("reports an unparseable startAt instead of guessing", () => {
    const e = ev({ title: "Broken Clock", startAt: "sometime next week" });
    const { pools, excluded } = partitionEvents([e], MON);
    expect(pools.regular).toEqual([]);
    expect(excluded).toEqual([
      { title: "Broken Clock", reason: 'unparseable startAt "sometime next week"' },
    ]);
  });

  it("honest emptiness: no events in, nothing invented out", () => {
    expect(partitionEvents([], MON)).toEqual({
      pools: { regular: [], family: [], weird: [] },
      excluded: [],
    });
  });
});

describe("selectFive — deterministic greedy selection", () => {
  it("spreads picks across weekdays before doubling up a day", () => {
    const pool = [
      ev({ title: "Mon A", category: "music", startAt: "2026-08-24T10:00:00-05:00" }),
      ev({ title: "Mon B", category: "arts", startAt: "2026-08-24T11:00:00-05:00" }),
      ev({ title: "Mon C", category: "food", startAt: "2026-08-24T12:00:00-05:00" }),
      ev({ title: "Tue", category: "arts", startAt: "2026-08-25T20:00:00-05:00" }),
      ev({ title: "Wed", category: "food", startAt: "2026-08-26T20:00:00-05:00" }),
      ev({ title: "Thu", category: "sports", startAt: "2026-08-27T20:00:00-05:00" }),
      ev({ title: "Fri", category: "festival", startAt: "2026-08-28T20:00:00-05:00" }),
    ];
    const sel = selectFive(pool, "regular");
    expect(sel.events.map((e) => e.title)).toEqual(["Mon A", "Tue", "Wed", "Thu", "Fri"]);
    expect(sel.shortfall).toBe(0);
    expect(new Set(sel.events.map((e) => e.startAt.slice(0, 10))).size).toBe(5);
    expect(sel.excluded).toEqual([
      { title: "Mon B", reason: "not selected — 5 picks made" },
      { title: "Mon C", reason: "not selected — 5 picks made" },
    ]);
  });

  it("regular: caps a category at 2 when alternatives exist, and says why", () => {
    const pool = [
      ev({ title: "Music Mon", category: "music", startAt: "2026-08-24T20:00:00-05:00" }),
      ev({ title: "Music Tue", category: "music", startAt: "2026-08-25T20:00:00-05:00" }),
      ev({ title: "Music Wed", category: "music", startAt: "2026-08-26T20:00:00-05:00" }),
      ev({ title: "Music Thu", category: "music", startAt: "2026-08-27T20:00:00-05:00" }),
      ev({ title: "Arts Fri", category: "arts", startAt: "2026-08-28T10:00:00-05:00" }),
      ev({ title: "Food Sat", category: "food", startAt: "2026-08-29T10:00:00-05:00" }),
      ev({ title: "Sports Sun", category: "sports", startAt: "2026-08-30T10:00:00-05:00" }),
    ];
    const sel = selectFive(pool, "regular");
    expect(sel.events.map((e) => e.title)).toEqual([
      "Music Mon",
      "Music Tue",
      "Arts Fri",
      "Food Sat",
      "Sports Sun",
    ]);
    expect(sel.excluded).toEqual([
      { title: "Music Wed", reason: "category cap: already picked 2 music events" },
      { title: "Music Thu", reason: "category cap: already picked 2 music events" },
    ]);
  });

  it("the cap is a penalty, not a bar — a thin pool still fills honestly", () => {
    const pool = [
      ev({ title: "M1", category: "music", startAt: "2026-08-24T20:00:00-05:00" }),
      ev({ title: "M2", category: "music", startAt: "2026-08-25T20:00:00-05:00" }),
      ev({ title: "M3", category: "music", startAt: "2026-08-26T20:00:00-05:00" }),
    ];
    const sel = selectFive(pool, "regular");
    expect(sel.events.map((e) => e.title)).toEqual(["M1", "M2", "M3"]);
    expect(sel.shortfall).toBe(2);
    expect(sel.excluded).toEqual([]);
  });

  it("family prefers Free strongly; regular does not", () => {
    const build = () => [
      ev({ title: "Mon Cheap", category: "family", priceTier: "$" as const, startAt: "2026-08-24T09:00:00-05:00" }),
      ev({ title: "Mon Free", category: "family", priceTier: "Free" as const, startAt: "2026-08-24T12:00:00-05:00" }),
      ev({ title: "Tue", category: "arts", startAt: "2026-08-25T18:00:00-05:00" }),
      ev({ title: "Wed", category: "food", startAt: "2026-08-26T18:00:00-05:00" }),
      ev({ title: "Thu", category: "sports", startAt: "2026-08-27T18:00:00-05:00" }),
      ev({ title: "Fri", category: "festival", startAt: "2026-08-28T18:00:00-05:00" }),
      ev({ title: "Sat", category: "music", startAt: "2026-08-29T18:00:00-05:00" }),
    ];

    const fam = selectFive(build(), "family");
    expect(fam.events.map((e) => e.title)).toEqual(["Mon Free", "Tue", "Wed", "Thu", "Fri"]);
    expect(fam.excluded.map((x) => x.title)).toEqual(["Mon Cheap", "Sat"]);

    const reg = selectFive(build(), "regular");
    expect(reg.events.map((e) => e.title)).toEqual(["Mon Cheap", "Tue", "Wed", "Thu", "Fri"]);
    expect(reg.excluded.map((x) => x.title)).toEqual(["Mon Free", "Sat"]);
  });

  it("dedupes title+venue to the earliest row — one game picked, days never merged", () => {
    const pool = [
      ev({
        title: "Twins vs Yankees",
        category: "sports",
        venue: "Target Field",
        startAt: "2026-08-25T18:40:00-05:00",
      }),
      ev({
        title: "TWINS VS YANKEES",
        category: "sports",
        venue: " Target  Field ",
        startAt: "2026-08-26T18:40:00-05:00",
      }),
      ev({ title: "Art Crawl", category: "arts", startAt: "2026-08-26T17:00:00-05:00" }),
      ev({ title: "Food Truck Rodeo", category: "food", startAt: "2026-08-27T11:00:00-05:00" }),
    ];
    const sel = selectFive(pool, "regular");
    const twins = sel.events.filter((e) => e.title.toLowerCase() === "twins vs yankees");
    expect(twins).toHaveLength(1);
    expect(twins[0].startAt).toBe("2026-08-25T18:40:00-05:00"); // the earliest row, untouched
    expect(sel.excluded).toEqual([
      { title: "TWINS VS YANKEES", reason: "duplicate title+venue — kept the 2026-08-25 row" },
    ]);
    expect(sel.shortfall).toBe(2);
  });

  it("ties break by start time, then title", () => {
    const pool = [
      ev({ title: "Beta Show", startAt: "2026-08-25T20:00:00-05:00" }),
      ev({ title: "Alpha Show", startAt: "2026-08-25T20:00:00-05:00" }),
    ];
    const sel = selectFive(pool, "regular");
    expect(sel.events.map((e) => e.title)).toEqual(["Alpha Show", "Beta Show"]);
    expect(sel.shortfall).toBe(3);
  });

  it("honest emptiness: an empty pool reports shortfall 5 and invents nothing", () => {
    for (const variant of ["regular", "family", "weird"] as const) {
      expect(selectFive([], variant)).toEqual({
        variant,
        events: [],
        shortfall: 5,
        excluded: [],
      });
    }
  });

  it("a pool of exactly 5 is taken whole", () => {
    const pool = [
      ev({ title: "A", category: "music", startAt: "2026-08-24T19:00:00-05:00" }),
      ev({ title: "B", category: "arts", startAt: "2026-08-25T19:00:00-05:00" }),
      ev({ title: "C", category: "food", startAt: "2026-08-26T19:00:00-05:00" }),
      ev({ title: "D", category: "sports", startAt: "2026-08-27T19:00:00-05:00" }),
      ev({ title: "E", category: "festival", startAt: "2026-08-28T19:00:00-05:00" }),
    ];
    const sel = selectFive(pool, "regular");
    expect(sel.events.map((e) => e.title)).toEqual(["A", "B", "C", "D", "E"]);
    expect(sel.shortfall).toBe(0);
    expect(sel.excluded).toEqual([]);
  });

  it("reports an unparseable startAt instead of guessing", () => {
    const pool = [
      ev({ title: "Fine", startAt: "2026-08-25T20:00:00-05:00" }),
      ev({ title: "Broken", startAt: "TBD" }),
    ];
    const sel = selectFive(pool, "regular");
    expect(sel.events.map((e) => e.title)).toEqual(["Fine"]);
    expect(sel.excluded).toEqual([{ title: "Broken", reason: 'unparseable startAt "TBD"' }]);
  });

  it("is deterministic: the same input always yields the same output", () => {
    const build = () => [
      ev({ title: "Music Mon", category: "music", startAt: "2026-08-24T20:00:00-05:00" }),
      ev({ title: "Music Tue", category: "music", startAt: "2026-08-25T20:00:00-05:00" }),
      ev({ title: "Free Tue", category: "family", priceTier: "Free" as const, startAt: "2026-08-25T10:00:00-05:00" }),
      ev({ title: "Arts Wed", category: "arts", startAt: "2026-08-26T19:30:00-05:00" }),
      ev({ title: "Food Thu", category: "food", startAt: "2026-08-27T17:00:00-05:00" }),
      ev({ title: "Music Fri", category: "music", startAt: "2026-08-28T21:00:00-05:00" }),
      ev({ title: "Sports Fri", category: "sports", startAt: "2026-08-28T19:00:00-05:00" }),
    ];
    for (const variant of ["regular", "family", "weird"] as const) {
      expect(selectFive(build(), variant)).toEqual(selectFive(build(), variant));
    }
  });
});
