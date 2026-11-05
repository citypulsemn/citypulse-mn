import { describe, it, expect } from "vitest";
import {
  normalizeRunTitle,
  runKey,
  groupRuns,
  collapsibleClusters,
  planCollapse,
  staleSpanIds,
  planRunFolds,
  type RunFoldRow,
  isMultiDay,
  multiDayLabel,
  runLength,
  spansDay,
  type CollapseRow,
} from "../multiday";
import { daysSpanned, eventsByDay } from "../dates";
import type { EventRecord, CategoryKey } from "../types";

function ev(overrides: Partial<EventRecord> = {}): EventRecord {
  return {
    id: Math.random().toString(36).slice(2),
    title: "Event",
    category: "festival",
    venue: "Venue",
    address: "1 Main St",
    city: "Woodbury",
    lat: 44.9,
    lng: -93.2,
    start: "2026-08-14T10:00",
    end: "",
    price: "Free",
    priceTier: "Free",
    ticketUrl: "",
    description: "",
    image: "",
    sourceUrl: "",
    status: "published",
    multiDayEnd: null,
    ...overrides,
  };
}

describe("normalizeRunTitle", () => {
  it("strips the noise agents add when they find the same event twice", () => {
    expect(normalizeRunTitle("Chaska River City Days 2026")).toBe("chaska river city days");
    expect(normalizeRunTitle("Sever's Fall Festival – Weekend 1")).toBe("severs fall festival");
    expect(normalizeRunTitle("Sever's Fall Festival – Weekend 2")).toBe("severs fall festival");
    expect(normalizeRunTitle("Uptown Porchfest (Second Edition)")).toBe("uptown porchfest");
    expect(normalizeRunTitle("Minnesota State Fair — Labor Day Weekend")).toBe(
      "minnesota state fair labor day weekend",
    );
  });

  it("does NOT merge genuinely different events", () => {
    expect(normalizeRunTitle("Bloomington Farmers Market")).not.toBe(
      normalizeRunTitle("Burnsville Farmers Market"),
    );
  });

  it("strips run-phrase retitles from the Jul 20 pipeline wave", () => {
    expect(normalizeRunTitle("Minnesota Renaissance Festival – Final Weekends")).toBe(
      "minnesota renaissance festival",
    );
    expect(normalizeRunTitle("Minnesota Renaissance Festival (Weekend VI — Final Weekend)")).toBe(
      "minnesota renaissance festival",
    );
    expect(normalizeRunTitle("Renaissance Festival Weekend V")).toBe("renaissance festival");
    expect(normalizeRunTitle("Sever's Fall Festival & Corn Maze — Opening Weekend")).toBe(
      "severs fall festival corn maze",
    );
    expect(normalizeRunTitle("Sever's Fall Festival (Shakopee) – continued weekends")).toBe(
      "severs fall festival",
    );
  });

  it("whitelist only: attraction suffixes keep their words (folding decides those, not the key)", () => {
    expect(normalizeRunTitle("Minnesota State Fair — Butter Sculptures & Crop Art")).toBe(
      "minnesota state fair butter sculptures crop art",
    );
  });
});

describe("planCollapse — span-aware clustering", () => {
  function row(o: Partial<CollapseRow> & { id: string }): CollapseRow {
    return {
      title: "Event",
      city: "Minneapolis",
      category: "festival",
      start: "2026-08-14T10:00",
      endDay: null,
      ...o,
    };
  }

  it("regression (Jul 20 wave): retitled single-day rows inside an existing run card's span join it", () => {
    const actions = planCollapse([
      row({ id: "card", title: "Minnesota Renaissance Festival", start: "2026-08-22T09:00", endDay: "2026-10-04", city: "Shakopee" }),
      row({ id: "w5", title: "Minnesota Renaissance Festival (Weekend V)", start: "2026-09-12T09:00", city: "Shakopee" }),
      row({ id: "fw", title: "Minnesota Renaissance Festival – Final Weekends", start: "2026-09-26T09:00", city: "Shakopee" }),
    ]);
    expect(actions).toHaveLength(1);
    expect(actions[0].keepId).toBe("card");
    expect(actions[0].archiveIds.sort()).toEqual(["fw", "w5"]);
    expect(actions[0].setEnd).toBeNull(); // span already reaches Oct 4 — never rewritten needlessly
  });

  it("parent-child fold: prefix-titled sub-event inside the parent's span is absorbed", () => {
    const actions = planCollapse([
      row({ id: "fair", title: "Minnesota State Fair 2026", start: "2026-08-27T08:00", endDay: "2026-09-07", city: "St Paul" }),
      row({ id: "llama", title: "Minnesota State Fair — Llama & Alpaca Costume Contest", start: "2026-09-03T13:00", city: "St Paul" }),
    ]);
    expect(actions).toHaveLength(1);
    expect(actions[0].kind).toBe("fold");
    expect(actions[0].keepId).toBe("fair");
    expect(actions[0].archiveIds).toEqual(["llama"]);
  });

  it("fold works when the SPANNED card has the longer title (Sever's & Corn Maze case)", () => {
    const actions = planCollapse([
      row({ id: "card", title: "Sever's Fall Festival & Corn Maze", start: "2026-09-04T10:00", endDay: "2026-10-04", city: "Shakopee" }),
      row({ id: "w3", title: "Sever's Fall Festival (Weekend III)", start: "2026-09-19T10:00", city: "Shakopee" }),
    ]);
    expect(actions).toHaveLength(1);
    expect(actions[0].keepId).toBe("card");
    expect(actions[0].archiveIds).toEqual(["w3"]);
  });

  it("genuinely distinct titles at the same festival are NOT folded", () => {
    const actions = planCollapse([
      row({ id: "card", title: "Minnesota Renaissance Festival", start: "2026-08-22T09:00", endDay: "2026-10-04", city: "Shakopee" }),
      row({ id: "feast", title: "Phantom's Feast Ghost Dinner & Hunt at Renaissance Festival", start: "2026-09-13T18:00", city: "Shakopee" }),
    ]);
    expect(actions).toEqual([]);
  });

  it("conservative floor: a sub-event dated OUTSIDE the parent's span stays live", () => {
    const actions = planCollapse([
      row({ id: "fair", title: "Minnesota State Fair 2026", start: "2026-08-27T08:00", endDay: "2026-09-07", city: "St Paul" }),
      row({ id: "preview", title: "Minnesota State Fair — Preview Night", start: "2026-08-20T18:00", city: "St Paul" }),
    ]);
    expect(actions).toEqual([]);
  });

  it("weekly series never merge (7-day gaps split clusters)", () => {
    const actions = planCollapse(
      ["2026-08-06", "2026-08-13", "2026-08-20", "2026-08-27"].map((d, i) =>
        row({ id: `n${i}`, title: "Day Block Brewing Date Night", start: `${d}T18:00` }),
      ),
    );
    expect(actions).toEqual([]);
  });

  it("sports: consecutive-day games never merge; same-day copies do; folding never touches sports", () => {
    expect(
      planCollapse([
        row({ id: "g1", title: "Minnesota Twins vs. Yankees", start: "2026-09-14T18:00", category: "sports", city: "Minneapolis" }),
        row({ id: "g2", title: "Minnesota Twins vs. Yankees", start: "2026-09-15T18:00", category: "sports", city: "Minneapolis" }),
      ]),
    ).toEqual([]);

    const sameDay = planCollapse([
      row({ id: "a", title: "Minnesota Twins vs. Yankees", start: "2026-09-14T18:00", category: "sports", city: "Minneapolis" }),
      row({ id: "b", title: "Minnesota Twins vs. Yankees", start: "2026-09-14T18:00", category: "sports", city: "Minneapolis" }),
    ]);
    expect(sameDay).toHaveLength(1);
    expect(sameDay[0].kind).toBe("duplicate");

    expect(
      planCollapse([
        row({ id: "team", title: "Minnesota Twins", start: "2026-09-14T12:00", category: "sports", city: "Minneapolis" }),
        row({ id: "game", title: "Minnesota Twins vs. Yankees", start: "2026-09-14T18:00", category: "sports", city: "Minneapolis" }),
      ]),
    ).toEqual([]);
  });

  it("a corrupted sports span can NOT absorb real games inside its window (Jul 20 legacy-span guard)", () => {
    // Legacy data bug: sports rows carrying multi_day_end from the
    // pre-reclassify collapse era. Interval clustering must ignore the span —
    // otherwise every per-game row the pipeline inserts inside the window
    // would be archived as part of the "run".
    const actions = planCollapse([
      row({ id: "bad-span", title: "St. Paul Saints vs. Louisville Bats", start: "2026-08-04T19:05", endDay: "2026-08-10", category: "sports", city: "St Paul" }),
      row({ id: "game2", title: "St. Paul Saints vs. Louisville Bats", start: "2026-08-05T19:05", category: "sports", city: "St Paul" }),
      row({ id: "game3", title: "St. Paul Saints vs. Louisville Bats", start: "2026-08-06T19:05", category: "sports", city: "St Paul" }),
    ]);
    expect(actions).toEqual([]);
  });

  it("deduping a same-day sports pair never writes a span onto the survivor", () => {
    const actions = planCollapse([
      row({ id: "spanned", title: "Minnesota Twins vs. Kansas City Royals", start: "2026-07-28T18:40", endDay: "2026-07-31", category: "sports" }),
      row({ id: "clean", title: "Minnesota Twins vs. Kansas City Royals", start: "2026-07-28T18:40", category: "sports" }),
    ]);
    expect(actions).toHaveLength(1);
    expect(actions[0].kind).toBe("duplicate");
    expect(actions[0].setEnd).toBeNull();
  });

  it("true spans: a row attesting a day just past the span end EXTENDS it", () => {
    const actions = planCollapse([
      row({ id: "card", title: "Uptown Art Fair", start: "2026-08-22T10:00", endDay: "2026-08-30" }),
      row({ id: "extra", title: "Uptown Art Fair", start: "2026-08-31T10:00" }),
    ]);
    expect(actions).toHaveLength(1);
    expect(actions[0].keepId).toBe("card");
    expect(actions[0].setEnd).toBe("2026-08-31");
  });

  it("plain consecutive-day rows still collapse into a run (old behavior preserved)", () => {
    const actions = planCollapse(
      ["2026-08-14", "2026-08-15", "2026-08-16"].map((d, i) =>
        row({ id: `d${i}`, title: "Irish Fair of Minnesota", start: `${d}T10:00`, city: "St Paul" }),
      ),
    );
    expect(actions).toHaveLength(1);
    expect(actions[0].kind).toBe("run");
    expect(actions[0].keepId).toBe("d0");
    expect(actions[0].setEnd).toBe("2026-08-16");
    expect(actions[0].archiveIds).toEqual(["d1", "d2"]);
  });

  it("survivor tie on start day prefers the row already carrying the curated span", () => {
    const actions = planCollapse([
      row({ id: "plain", title: "Minnesota Renaissance Festival", start: "2026-08-22T08:00", city: "Shakopee" }),
      row({ id: "card", title: "Minnesota Renaissance Festival", start: "2026-08-22T09:00", endDay: "2026-10-04", city: "Shakopee" }),
    ]);
    expect(actions).toHaveLength(1);
    expect(actions[0].keepId).toBe("card");
  });

  it("honest emptiness: nothing to do → no actions", () => {
    expect(planCollapse([])).toEqual([]);
    expect(
      planCollapse([
        row({ id: "a", title: "First Avenue Show", start: "2026-08-14T20:00" }),
        row({ id: "b", title: "Cedar Cultural Center Show", start: "2026-08-14T20:00" }),
      ]),
    ).toEqual([]);
  });
});

describe("runKey", () => {
  it("groups by event AND town, so same-named events in different cities stay apart", () => {
    const a = runKey({ title: "Farmers Market", city: "Bloomington" });
    const b = runKey({ title: "Farmers Market", city: "Burnsville" });
    expect(a).not.toBe(b);
  });

  it("folds Saint/St", () => {
    expect(runKey({ title: "X", city: "Saint Paul" })).toBe(runKey({ title: "X", city: "St Paul" }));
  });
});

describe("groupRuns — the three cases that look identical but aren't", () => {
  it("MULTI-DAY RUN: consecutive days collapse into one cluster", () => {
    // "Woodbury Days" stored once per day
    const events = [
      ev({ id: "d1", title: "Woodbury Days", start: "2026-08-14T10:00" }),
      ev({ id: "d2", title: "Woodbury Days", start: "2026-08-15T10:00" }),
      ev({ id: "d3", title: "Woodbury Days", start: "2026-08-16T10:00" }),
    ];
    const clusters = collapsibleClusters(events);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].events).toHaveLength(3);
    expect(clusters[0].multiDay).toBe(true);
    expect(clusters[0].startDay).toBe("2026-08-14");
    expect(clusters[0].endDay).toBe("2026-08-16");
  });

  it("TRUE DUPLICATE: same day, different venue guesses, one cluster and NOT multi-day", () => {
    // "Slavic Experience Festival" found 3× with 3 different venue guesses.
    const events = [
      ev({ id: "a", title: "Slavic Experience Festival", city: "St Louis Park", venue: "Lenox Community Center", start: "2026-08-14T11:00" }),
      ev({ id: "b", title: "Slavic Experience Festival", city: "St Louis Park", venue: "Westwood Hills Nature Center Area", start: "2026-08-14T11:00" }),
      ev({ id: "c", title: "Slavic Experience Festival", city: "St Louis Park", venue: "St. Louis Park (venue TBA)", start: "2026-08-14T12:00" }),
    ];
    const clusters = collapsibleClusters(events);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].events).toHaveLength(3);
    expect(clusters[0].multiDay).toBe(false); // same day → a merge, not a run
  });

  /**
   * THE GUARD THAT MATTERS MOST. "Day Block Brewing Date Night" appears 4× —
   * but those are four real, separate weekly nights. Collapsing them would
   * DELETE three legitimate events. Only consecutive days may form a run.
   */
  it("LEGITIMATE RECURRENCE: a weekly series is never collapsed", () => {
    const events = [
      ev({ id: "w1", title: "Day Block Brewing Date Night", city: "Minneapolis", start: "2026-08-06T18:00" }),
      ev({ id: "w2", title: "Day Block Brewing Date Night", city: "Minneapolis", start: "2026-08-13T18:00" }),
      ev({ id: "w3", title: "Day Block Brewing Date Night", city: "Minneapolis", start: "2026-08-20T18:00" }),
      ev({ id: "w4", title: "Day Block Brewing Date Night", city: "Minneapolis", start: "2026-08-27T18:00" }),
    ];
    expect(collapsibleClusters(events)).toEqual([]); // nothing to collapse
    expect(groupRuns(events)).toHaveLength(4); // four separate events, untouched
  });


  /**
   * THE BUG THE SECOND LIVE-SITE AUDIT CAUGHT — before the collapse was ever
   * run in production. "St. Paul Saints vs. Columbus Clippers" appears SEVEN
   * consecutive days on the live calendar (Jul 21–27). Same title, same city,
   * consecutive days — the exact shape of a multi-day run — but each is a real,
   * separate game. Sports must NEVER form consecutive-day runs.
   */
  it("SPORTS HOMESTAND: seven consecutive Saints games are never collapsed", () => {
    const games = Array.from({ length: 7 }, (_, i) =>
      ev({
        id: `g${i}`,
        title: "St. Paul Saints vs. Columbus Clippers",
        category: "sports",
        city: "St Paul",
        start: `2026-07-${21 + i}T19:00`,
      }),
    );
    expect(collapsibleClusters(games)).toEqual([]);
    expect(groupRuns(games)).toHaveLength(7);
  });

  it("sports on consecutive days with a vague repeated title also survive", () => {
    const games = [
      ev({ id: "l1", title: "Minnesota Lynx Home Game", category: "sports", city: "Minneapolis", start: "2026-07-26T19:00" }),
      ev({ id: "l2", title: "Minnesota Lynx Home Game", category: "sports", city: "Minneapolis", start: "2026-07-27T19:00" }),
    ];
    expect(collapsibleClusters(games)).toEqual([]);
  });

  it("a SAME-DAY sports duplicate still merges (two rows for one game)", () => {
    const rows = [
      ev({ id: "s1", title: "Minnesota Twins vs. Kansas City Royals", category: "sports", city: "Minneapolis", start: "2026-07-28T19:10" }),
      ev({ id: "s2", title: "Minnesota Twins vs. Kansas City Royals", category: "sports", city: "Minneapolis", start: "2026-07-28T19:10" }),
    ];
    const clusters = collapsibleClusters(rows);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].multiDay).toBe(false); // a merge, never a run
  });

  it("a two-day gap is NOT a run (a Fri + Mon series stays separate)", () => {
    const events = [
      ev({ title: "Series", start: "2026-08-14T10:00" }),
      ev({ title: "Series", start: "2026-08-17T10:00" }),
    ];
    expect(collapsibleClusters(events)).toEqual([]);
  });

  it("splits a title that has both a run AND a later separate run", () => {
    const events = [
      ev({ title: "Sever's Fall Festival – Weekend 1", start: "2026-09-05T10:00" }),
      ev({ title: "Sever's Fall Festival – Weekend 1", start: "2026-09-06T10:00" }),
      ev({ title: "Sever's Fall Festival – Weekend 2", start: "2026-09-12T10:00" }),
      ev({ title: "Sever's Fall Festival – Weekend 2", start: "2026-09-13T10:00" }),
    ];
    const clusters = collapsibleClusters(events);
    expect(clusters).toHaveLength(2); // two weekends, each its own run
    expect(clusters[0].endDay).toBe("2026-09-06");
    expect(clusters[1].startDay).toBe("2026-09-12");
  });
});

describe("display helpers", () => {
  const fair = ev({ start: "2026-08-20T10:00", multiDayEnd: "2026-08-28T23:59" });

  it("isMultiDay / runLength", () => {
    expect(isMultiDay(fair)).toBe(true);
    expect(runLength(fair)).toBe(9);
    expect(isMultiDay(ev())).toBe(false);
    expect(runLength(ev())).toBe(1);
  });

  it("labels the span, crossing months when needed", () => {
    expect(multiDayLabel(fair)).toBe("Aug 20 – 28");
    expect(multiDayLabel(ev({ start: "2026-07-30T10:00", multiDayEnd: "2026-08-02T23:59" }))).toBe(
      "Jul 30 – Aug 2",
    );
  });

  it("spansDay: a festival is on every day it runs, not just opening day", () => {
    expect(spansDay(fair, "2026-08-20")).toBe(true); // first
    expect(spansDay(fair, "2026-08-24")).toBe(true); // middle — the important one
    expect(spansDay(fair, "2026-08-28")).toBe(true); // last
    expect(spansDay(fair, "2026-08-29")).toBe(false);
    expect(spansDay(fair, "2026-08-19")).toBe(false);
  });
});

describe("calendar expansion", () => {
  it("daysSpanned lists every day of the run", () => {
    const days = daysSpanned(ev({ start: "2026-08-20T10:00", multiDayEnd: "2026-08-23T23:59" }));
    expect(days).toEqual(["2026-08-20", "2026-08-21", "2026-08-22", "2026-08-23"]);
  });

  it("daysSpanned is a single day for ordinary events", () => {
    expect(daysSpanned(ev({ start: "2026-08-20T10:00" }))).toEqual(["2026-08-20"]);
  });

  it("ONGOING RULE: spans longer than 14 days show on their start day only", () => {
    // A three-month exhibition repeated on every calendar cell buried the rest
    // of the calendar (live regression, caught by the user). Long spans are
    // ongoing attractions, not daily events.
    const exhibition = ev({ start: "2026-06-01T10:00", end: "2026-09-07T17:00" });
    expect(daysSpanned(exhibition)).toEqual(["2026-06-01"]);

    const fair = ev({ start: "2026-08-20T09:00", multiDayEnd: "2026-08-31T23:59" }); // 12 days
    expect(daysSpanned(fair)).toHaveLength(12);

    const runaway = ev({ start: "2026-01-01T10:00", multiDayEnd: "2030-01-01T00:00" });
    expect(daysSpanned(runaway)).toEqual(["2026-01-01"]);
  });

  it("eventsByDay puts a festival on every day it spans", () => {
    const fair = ev({ id: "fair", title: "State Fair", start: "2026-08-20T10:00", multiDayEnd: "2026-08-22T23:59" });
    const active = new Set<CategoryKey>(["festival"]);
    const byDay = eventsByDay([fair], active);
    expect(Object.keys(byDay).sort()).toEqual(["2026-08-20", "2026-08-21", "2026-08-22"]);
    expect(byDay["2026-08-21"][0].id).toBe("fair");
  });
});

describe("spanEnd from the event's own end_at (second live-site audit)", () => {
  it("a one-row fair with a 13-day end renders as a run, not '7 PM – 6 PM'", () => {
    // Ramsey County Fair on the live site: start Jul 15 7 PM, end Jul 29.
    const fair = ev({ start: "2026-07-15T19:00", end: "2026-07-29T18:00", multiDayEnd: null });
    expect(isMultiDay(fair)).toBe(true);
    expect(multiDayLabel(fair)).toBe("Jul 15 – 29");
    expect(runLength(fair)).toBe(15);
    expect(spansDay(fair, "2026-07-22")).toBe(true);
  });

  it("a normal evening event (end later the same day) is NOT multi-day", () => {
    const show = ev({ start: "2026-07-15T19:00", end: "2026-07-15T23:00" });
    expect(isMultiDay(show)).toBe(false);
  });

  it("a late show ending at 1 AM is NOT a two-day span (late-night rule)", () => {
    const late = ev({ start: "2026-07-15T21:00", end: "2026-07-16T01:00" });
    expect(isMultiDay(late)).toBe(false);
    expect(runLength(late)).toBe(1);
  });

  it("a genuine Sat–Sun weekend event (ending Sunday evening) IS a span", () => {
    const weekend = ev({ start: "2026-07-18T10:00", end: "2026-07-19T18:00" });
    expect(isMultiDay(weekend)).toBe(true);
    expect(runLength(weekend)).toBe(2);
  });

  it("multiDayEnd wins when both are present", () => {
    const both = ev({ start: "2026-07-15T10:00", end: "2026-07-16T18:00", multiDayEnd: "2026-07-20T23:59" });
    expect(multiDayLabel(both)).toBe("Jul 15 – 20");
  });
});

describe("two-night stands are not runs", () => {
  const night = (id: string, title: string, start: string, category: string) =>
    ({ id, title, city: "Minneapolis", category, start, endDay: null });

  it("refuses to fold a Friday and Saturday concert into one span", () => {
    // Real: jeremy messersmith and Sylvan Esso were both about to be folded
    // Oct 23 -> Oct 24, and each pair carried two distinct ticket_urls.
    const actions = planCollapse([
      night("a", "Sylvan Esso (18+)", "2026-10-23T20:00", "music"),
      night("b", "Sylvan Esso (18+)", "2026-10-24T20:00", "music"),
    ]);
    expect(actions.filter((x) => x.kind === "run")).toEqual([]);
  });

  it("still folds a genuine multi-day family run", () => {
    // Bell Museum's Beavers and Botanicals: five consecutive days, one programme.
    const rows = ["14", "15", "16", "17", "18"].map((d, i) =>
      night(`b${i}`, "Beavers and Botanicals", `2026-10-${d}T10:00`, "family"),
    );
    const runs = planCollapse(rows).filter((x) => x.kind === "run");
    expect(runs).toHaveLength(1);
    expect(runs[0].archiveIds).toHaveLength(4);
  });

  it("still collapses same-day duplicates of a concert", () => {
    // Per-night must not mean per-row: two copies of ONE night are still a dup.
    const actions = planCollapse([
      night("a", "The Suburbs", "2026-11-13T20:00", "music"),
      night("b", "The Suburbs", "2026-11-13T20:00", "music"),
    ]);
    expect(actions.some((x) => x.kind === "duplicate")).toBe(true);
  });

  it("leaves a multi-day festival alone even when it is music-adjacent", () => {
    const rows = ["05", "06"].map((d, i) =>
      night(`f${i}`, "Nicollet Island Winter Market", `2026-12-${d}T10:00`, "family"),
    );
    expect(planCollapse(rows).filter((x) => x.kind === "run")).toHaveLength(1);
  });
});

describe("staleSpanIds — the spans the rules refuse but nothing removed", () => {
  const row = (o: Partial<CollapseRow> & { id: string }): CollapseRow => ({
    title: "Event",
    city: "Minneapolis",
    category: "festival",
    start: "2026-11-13T20:00",
    endDay: null,
    ...o,
  });

  it("finds the six that were live on 28 Oct 2026", () => {
    // All six upcoming ones were music rows whose span predates music joining
    // PER_NIGHT on 29 Sep 2026. Each rendered a two-night stand as one
    // two-day event, and on FIVE of the six the span's last day already had
    // its own published card, so day two showed the same show twice.
    expect(
      staleSpanIds([
        row({ id: "suburbs", title: "The Suburbs", category: "music", start: "2026-11-13T20:00", endDay: "2026-11-14" }),
        row({ id: "angine", title: "Angine de Poitrine", category: "music", start: "2026-12-01T20:00", endDay: "2026-12-02" }),
      ]),
    ).toEqual(["suburbs", "angine"]);
  });

  it("clears the July sports class too, not just music", () => {
    // 14 sports rows carried spans from the pre-reclassify collapse era. The
    // guard inside planCollapse stopped them absorbing real games; the spans
    // themselves were removed by hand, because there was no lever.
    expect(
      staleSpanIds([
        row({ id: "saints", title: "St. Paul Saints vs. Louisville Bats", category: "sports", start: "2026-08-04T19:05", endDay: "2026-08-10" }),
      ]),
    ).toEqual(["saints"]);
  });

  it("leaves a genuine multi-day run alone — the whole point of the category split", () => {
    expect(
      staleSpanIds([
        row({ id: "renfest", title: "Minnesota Renaissance Festival", category: "festival", start: "2026-08-22T09:00", endDay: "2026-10-04" }),
        row({ id: "beavers", title: "Beavers and Botanicals", category: "family", start: "2026-10-14T10:00", endDay: "2026-10-18" }),
      ]),
    ).toEqual([]);
  });

  it("is silent on rows with nothing to clear, including the same-day boundary", () => {
    expect(staleSpanIds([])).toEqual([]);
    expect(staleSpanIds([row({ id: "a", category: "music" })])).toEqual([]);
    // endDay ON the start day is not a span: spanEnd() returns null for it, so
    // the site renders nothing wrong and there is nothing to undo.
    expect(staleSpanIds([row({ id: "b", category: "music", endDay: "2026-11-13" })])).toEqual([]);
    // An endDay BEFORE the start is corrupt, but spanEnd() ignores it too, so
    // it is not this function's business — clearing it would be a silent edit
    // to a row no reader sees wrongly.
    expect(staleSpanIds([row({ id: "c", category: "music", endDay: "2026-11-01" })])).toEqual([]);
    expect(staleSpanIds([row({ id: "d", category: undefined, endDay: "2026-11-14" })])).toEqual([]);
  });

  // THE INVARIANT, and the reason this function exists at all: the set of
  // categories that REFUSE to write a span must be exactly the set whose
  // stored spans get cleared. They were not the same for 29 days, and the
  // difference was visible on the live calendar. Driven through the public API
  // so adding a category to PER_NIGHT cannot move one half without the other.
  it("clears a span for exactly those categories that refuse to make one", () => {
    for (const category of ["music", "sports", "festival", "family", "arts", "food"]) {
      const consecutive = planCollapse([
        row({ id: "d1", category, start: "2026-11-13T20:00" }),
        row({ id: "d2", category, start: "2026-11-14T20:00" }),
      ]);
      const wouldWriteASpan = consecutive.some((a) => a.setEnd !== null);
      const clearsASpan =
        staleSpanIds([row({ id: "x", category, endDay: "2026-11-14" })]).length > 0;
      expect(clearsASpan, `category "${category}"`).toBe(!wouldWriteASpan);
    }
  });
});

describe("planRunFolds — a weekly re-find folds onto the run it belongs to", () => {
  function r(o: Partial<RunFoldRow> & { id: string }): RunFoldRow {
    return {
      title: "Twelve Kinds of Ice",
      city: "Minneapolis",
      category: "arts",
      start: "2026-10-19T00:00",
      end: null,
      multiDayEnd: null,
      ...o,
    };
  }

  it("THE DEFECT: +7 re-finds of one run fold onto the earliest and extend its span", () => {
    // Como Park Daily General Admission, as measured 4 Nov 2026: a 31-day
    // window re-minted every Monday because the start day moves with the find.
    const live = [
      r({ id: "wk1", title: "Como Park Zoo – Daily General Admission", city: "St Paul", start: "2026-10-10T10:00", end: "2026-11-10T17:00" }),
    ];
    const incoming = [
      r({ id: "wk2", title: "Como Park Zoo – Daily General Admission", city: "St Paul", start: "2026-10-17T10:00", end: "2026-11-17T17:00" }),
    ];
    expect(planRunFolds(live, incoming)).toEqual([
      { incomingId: "wk2", keepId: "wk1", extendTo: "2026-11-17", drift: false },
    ]);
  });

  it("a re-find that ends no later leaves the span alone", () => {
    // Kunene and the King: Oct 10, Oct 15 and Oct 29 all ended Nov 8.
    const live = [r({ id: "run", title: "Kunene and the King", start: "2026-10-10T19:30", end: "2026-11-08T21:30" })];
    const incoming = [r({ id: "again", title: "Kunene and the King", start: "2026-10-29T19:30", end: "2026-11-08T21:30" })];
    const folds = planRunFolds(live, incoming);
    expect(folds).toHaveLength(1);
    expect(folds[0].extendTo).toBeNull();
  });

  it("COVERAGE: a single dated performance inside a run is never folded", () => {
    // The whole reason this is run-to-run only. A run past EXPAND_MAX_DAYS shows
    // on its start day alone, so the ASL performance is the only card Nov 14
    // gets. Archiving it would cost more coverage than the duplicate removes.
    const live = [r({ id: "run", start: "2026-10-19T00:00", end: "2026-11-22T17:00" })];
    const incoming = [
      r({ id: "asl", title: "Twelve Kinds of Ice – ASL-Interpreted Performance", start: "2026-11-14T11:00", end: "2026-11-14T12:30" }),
      r({ id: "matinee", title: "Twelve Kinds of Ice – Saturday Matinee", start: "2026-11-07T11:00" }),
    ];
    expect(planRunFolds(live, incoming)).toEqual([]);
  });

  it("refuses PER_NIGHT: consecutive nights of music are separately ticketed", () => {
    for (const category of ["music", "sports"]) {
      const live = [r({ id: "n1", category, title: "Sylvan Esso", start: "2026-11-20T20:00", end: "2026-11-21T23:00" })];
      const incoming = [r({ id: "n2", category, title: "Sylvan Esso", start: "2026-11-21T20:00", end: "2026-11-22T23:00" })];
      expect(planRunFolds(live, incoming), category).toEqual([]);
    }
  });

  it("a genuinely separate later run of the same show does not fold", () => {
    const live = [r({ id: "autumn", start: "2026-10-19T00:00", end: "2026-11-22T17:00" })];
    const incoming = [r({ id: "spring", start: "2027-03-01T00:00", end: "2027-04-04T17:00" })];
    expect(planRunFolds(live, incoming)).toEqual([]);
  });

  it("boundary: opening on the run's closing day folds; the day after does not", () => {
    const live = [r({ id: "run", start: "2026-10-19T00:00", end: "2026-11-22T17:00" })];
    expect(planRunFolds(live, [r({ id: "onLastDay", start: "2026-11-22T10:00", end: "2026-12-20T17:00" })])).toHaveLength(1);
    expect(planRunFolds(live, [r({ id: "dayAfter", start: "2026-11-23T10:00", end: "2026-12-20T17:00" })])).toEqual([]);
  });

  it("reads a span from EITHER source, and respects the late-night rule", () => {
    // A 9 PM show ending at 1 AM is not a two-day run, so it is not a run at
    // all and cannot fold or be folded onto.
    const live = [r({ id: "viaSpan", start: "2026-10-19T00:00", multiDayEnd: "2026-11-22T23:59" })];
    expect(planRunFolds(live, [r({ id: "viaEnd", start: "2026-11-02T00:00", end: "2026-11-22T17:00" })])).toHaveLength(1);
    const lateNight = [r({ id: "late", start: "2026-10-19T21:00", end: "2026-10-20T01:00" })];
    expect(planRunFolds(lateNight, [r({ id: "other", start: "2026-10-19T21:00", end: "2026-10-20T01:00" })])).toEqual([]);
  });

  it("a different production at the same place does not fold", () => {
    const live = [r({ id: "ice", start: "2026-10-19T00:00", end: "2026-11-22T17:00" })];
    const incoming = [r({ id: "grinch", title: "How the Grinch Stole Christmas", start: "2026-11-02T00:00", end: "2026-11-22T17:00" })];
    expect(planRunFolds(live, incoming)).toEqual([]);
  });

  it("several matching runs: the earliest keeps the slot, as planCollapse would pick", () => {
    const live = [
      r({ id: "later", start: "2026-10-26T00:00", end: "2026-11-22T17:00" }),
      r({ id: "earliest", start: "2026-10-19T00:00", end: "2026-11-22T17:00" }),
    ];
    const folds = planRunFolds(live, [r({ id: "new", start: "2026-11-02T00:00", end: "2026-11-22T17:00" })]);
    expect(folds).toHaveLength(1);
    expect(folds[0].keepId).toBe("earliest");
  });

  it("same show, different town: a tour stop is not a re-find", () => {
    // runKey is title|city for exactly this reason. A Christmas Carol plays the
    // Guthrie and Lakeville Area Arts Center in the same weeks.
    const live = [r({ id: "mpls", title: "A Christmas Carol", city: "Minneapolis", start: "2026-11-11T19:30", end: "2026-12-27T21:30" })];
    const incoming = [r({ id: "lakeville", title: "A Christmas Carol", city: "Lakeville", start: "2026-12-18T19:00", end: "2026-12-20T21:00" })];
    expect(planRunFolds(live, incoming)).toEqual([]);
  });

  it("honest emptiness: nothing in, nothing out", () => {
    expect(planRunFolds([], [])).toEqual([]);
    expect(planRunFolds([], [r({ id: "a", end: "2026-11-22T17:00" })])).toEqual([]);
    expect(planRunFolds([r({ id: "a", end: "2026-11-22T17:00" })], [])).toEqual([]);
  });

  it("a row never folds onto itself", () => {
    // THIS TEST CANNOT CATCH THE REAL BUG, and that is worth saying here. It
    // passes one object as both sides, which production cannot produce: the
    // caller gives live rows their uuid and incoming rows their event_key, so
    // the id check below compares two namespaces and never fires. 107 of 149
    // live runs folded onto themselves on 4 Nov 2026 with this test green.
    // The caller is pinned instead, in lib/__tests__/upsert-queries.test.ts
    // ("excludes a live row whose event_key is in the incoming batch").
    const row = r({ id: "same", start: "2026-10-19T00:00", end: "2026-11-22T17:00" });
    expect(planRunFolds([row], [row])).toEqual([]);
  });

  // ── The alias key: the same words, differently wrapped ───────────────────
  //
  // Measured 4 Nov 2026 — five live rows for one exhibit, which the exact key
  // cannot see because normalizeRunTitle DELETES parenthetical contents. These
  // are not similarity tests: the pair that folds is the same words in another
  // wrapper, and every pair that does not fold differs by a real word. The
  // venue-suffix alias measured alongside it was DECLINED, and has a test of
  // its own here so the decision cannot be undone by accident.
  describe("the alias key repairs a normaliser artefact, not a similarity guess", () => {
    const mcm = (o: Partial<RunFoldRow> & { id: string }) =>
      r({ city: "St Paul", category: "arts", ...o });

    it("THE ARTEFACT: a parenthesised descriptor folds onto the same words after a dash", () => {
      const live = [mcm({ id: "aug", title: "Monsters on Vacation (Special Exhibit)", start: "2026-08-17T09:00", end: "2027-01-10T17:00" })];
      const incoming = [mcm({ id: "nov", title: "Monsters on Vacation – Special Exhibit", start: "2026-11-02T09:00", end: "2027-01-10T17:00" })];
      expect(planRunFolds(live, incoming)).toEqual([
        { incomingId: "nov", keepId: "aug", extendTo: null, drift: false },
      ]);
    });

    it("DECLINED: a title ending in its own venue does NOT fold", () => {
      // Stripping a trailing " at <the row's own venue>" would fold this pair.
      // Measured and declined: BOTH rows strip their own venue, so they meet on
      // the bare remainder and two DIFFERENT venues in one city get equated —
      // "Festival of Trees at Mall of America" absorbing "Festival of Trees at
      // Bloomington Center for the Arts", both in Bloomington. A word-count
      // floor does not close it; the three-word holiday names are the colliding
      // ones. The price of declining it is this fold, and the Monsters cluster
      // folding to two rows rather than one.
      const live = [mcm({ id: "aug", title: "Monsters on Vacation (Special Exhibit)", start: "2026-08-17T09:00", end: "2027-01-10T17:00" })];
      const incoming = [
        mcm({ id: "verbose", title: "Monsters on Vacation – Special Exhibit at Minnesota Children's Museum", start: "2026-11-12T09:00", end: "2026-12-11T17:00" }),
      ];
      expect(planRunFolds(live, incoming)).toEqual([]);
    });

    it("REFUSED: a differently-named thing inside a run is not a re-find of it", () => {
      // The case the isWordPrefix widening got wrong. "Annual Harvest Supper"
      // is a real word, not a wrapper, so no alias equates these.
      const live = [
        r({ id: "bar", title: "Travail Haunted Basement Bar", city: "Robbinsdale", category: "weird", start: "2026-10-19T00:00", end: "2026-11-07T23:00" }),
      ];
      const incoming = [
        r({ id: "supper", title: "Travail Haunted Basement Bar – Annual Harvest Supper", city: "Robbinsdale", category: "food", start: "2026-11-04T17:45", end: "2026-11-07T23:00" }),
      ];
      expect(planRunFolds(live, incoming)).toEqual([]);
    });

    it("REFUSED: an umbrella listing does not absorb a named attraction inside it", () => {
      const live = [
        r({ id: "light", title: "Nickelodeon Universe Winter Break – Universe of Light Holiday Light Show", city: "Bloomington", category: "family", start: "2026-11-12T19:00", end: "2026-12-31T21:00" }),
      ];
      const incoming = [
        r({ id: "break", title: "Nickelodeon Universe Winter Break", city: "Bloomington", category: "family", start: "2026-11-26T10:00", end: "2026-12-25T21:00" }),
      ];
      expect(planRunFolds(live, incoming)).toEqual([]);
    });

    it("every alias still carries the city, so a tour stop is not a re-find", () => {
      const live = [mcm({ id: "stpaul", title: "Monsters on Vacation (Special Exhibit)", start: "2026-08-17T09:00", end: "2027-01-10T17:00" })];
      const incoming = [
        mcm({ id: "duluth", city: "Duluth", title: "Monsters on Vacation – Special Exhibit", start: "2026-11-02T09:00", end: "2027-01-10T17:00" }),
      ];
      expect(planRunFolds(live, incoming)).toEqual([]);
    });

    it("an alias never COSTS a match: two different parentheticals still fold", () => {
      // These two agree only on the parens-DELETED key that runKey already
      // produced, so this is the test that dies if the alias ever replaces
      // runKey instead of joining it. Both rows are the same exhibit; one
      // aggregator called it travelling, the other special.
      const live = [mcm({ id: "aug", title: "Monsters on Vacation (Special Exhibit)", start: "2026-08-17T09:00", end: "2027-01-10T17:00" })];
      const incoming = [mcm({ id: "trav", title: "Monsters on Vacation (Traveling Exhibit)", start: "2026-10-03T09:00", end: "2026-11-03T17:00" })];
      expect(planRunFolds(live, incoming)).toEqual([
        { incomingId: "trav", keepId: "aug", extendTo: null, drift: false },
      ]);
    });
  });

  // ── MID-STRING DRIFT ───────────────────────────────────────────────────
  //
  // A key is exact and an alias repairs one punctuation artefact. Neither sees
  // a word changed in the MIDDLE of a title, which is how the same production
  // arrives twice. These tests pin the threshold from both sides: what it must
  // fold, and the two real pairs just underneath it that it must not.
  //
  // Every title here is a row that was live on 4 Nov 2026, and the three
  // productions were verified against the venues' own pages that day.
  describe("mid-string title drift folds, and stops where the evidence stops", () => {
    const span = (o: Partial<RunFoldRow> & { id: string }) => r({ category: "family", ...o });

    it("THE NAMED CASE: a word DELETED mid-string folds, and is reported as drift", () => {
      // {monsters,on,summer,vacation} against {monsters,on,vacation}: 3 shared
      // of 4, exactly 0.75. Verified at mcm.org the same day: the museum's
      // exhibit page is headed "Monsters on Vacation", the press release uses
      // that name throughout, and "Monsters on Summer Vacation" is a DIFFERENT
      // exhibit the museum ran in summer 2024. So these two rows are one
      // production — but the keeper, being the row already live, carries a
      // title the museum does not publish. The fold is right and the surviving
      // name is wrong, which is precisely why a drift fold is named in the
      // Monday ops email instead of being silent.
      const live = [span({ id: "summer", title: "Monsters on Summer Vacation (Special Exhibit)", city: "St Paul", start: "2026-05-23T09:00", end: "2027-01-10T17:00" })];
      const incoming = [span({ id: "aug", title: "Monsters on Vacation (Special Exhibit)", city: "St Paul", start: "2026-08-17T09:00", end: "2027-01-10T17:00" })];
      expect(planRunFolds(live, incoming)).toEqual([
        { incomingId: "aug", keepId: "summer", extendTo: null, drift: true },
      ]);
    });

    it("THE NAMED CASE: one word SWAPPED, carried by a long shared prefix", () => {
      // A substitution costs two tokens, so it only clears 0.75 when six or
      // more survive it: 6 shared of 8 here. Verified at Como the same day —
      // and the finding was bigger than the fold. Como is FREE and open all
      // year ("Free." on its Hours & Admission page), publishes no product
      // under any of these names, and a site search for "Open Admission"
      // returns nothing. Both rows are dated 31-day windows invented around a
      // standing policy. Folding them is still correct; archiving all of them
      // is the real answer, and it is not this function's call.
      const live = [span({ id: "general", title: "Como Park Zoo & Conservatory – Daily General Admission", city: "St Paul", start: "2026-10-10T10:00", end: "2026-11-10T17:00" })];
      const incoming = [span({ id: "open", title: "Como Park Zoo & Conservatory – Daily Open Admission", city: "St Paul", start: "2026-10-24T10:00", end: "2026-11-24T17:00" })];
      expect(planRunFolds(live, incoming)).toEqual([
        { incomingId: "open", keepId: "general", extendTo: "2026-11-24", drift: true },
      ]);
    });

    it("REFUSED although it IS one show: a trailing word is parent/child, not drift", () => {
      // The honest version of a test that has now been wrong in both
      // directions, so both facts are recorded here.
      //
      // These two rows ARE one show. Verified 4 Nov 2026 on
      // comozooconservatory.org: the 2026 Fall Flower Show runs Sep 18 – Oct 18
      // and Oct 23 – Nov 29 as two halves its own page labels "Part 1" and
      // "Part 2", and Como publishes NO opening, preview or members' night —
      // its event sitemap carries fall opening-day pages for 2023 only, and
      // Como Friends' calendar jumps from a December shopping evening to
      // February. So the refusal below is NOT a claim that they differ, and
      // the comment this test shipped with this morning (that a run phase is
      // its own event) was my assumption, not Como's.
      //
      // The gate declines them regardless, at 0.833, because "Opening" is a
      // word APPENDED and that is indistinguishable from a real sub-event —
      // a ticketed preview reads exactly the same way. Reason 3 of the
      // isWordPrefix declination was paid for here: a multi-day sub-event IS a
      // run, so folding a prefix relation re-opens the class the coverage rule
      // protects. One correct fold is the price of that, and on this project a
      // wrong fold costs an event that silently never appears.
      const live = [span({ id: "opening", title: "Fall Flower Show – Part 2 Opening", city: "St Paul", start: "2026-10-23T10:00", end: "2026-11-18T16:00" })];
      const incoming = [span({ id: "part2", title: "Fall Flower Show – Part 2", city: "St Paul", start: "2026-10-26T10:00", end: "2026-11-25T16:00" })];
      expect(planRunFolds(live, incoming)).toEqual([]);
    });

    it("REFUSED: a MULTI-DAY sub-event does not fold onto its parent, however similar", () => {
      // The archetype the guard above exists for, and the one the run-to-run
      // rule alone cannot stop: a single dated performance has no span and is
      // excluded for that reason, but a sub-event that runs for days IS a run.
      // 5 shared of 6, 0.833 — comfortably over the floor, and refused on shape.
      const live = [span({ id: "parent", title: "Winter Lights at the Arboretum", city: "Chanhassen", start: "2026-11-20T17:00", end: "2027-01-02T21:00" })];
      const incoming = [span({ id: "child", title: "Winter Lights at the Arboretum Opening", city: "Chanhassen", start: "2026-11-20T17:00", end: "2026-11-29T21:00" })];
      expect(planRunFolds(live, incoming)).toEqual([]);
    });

    it("a DELETED word is still drift, even though its tokens are a subset", () => {
      // Why the guard is isWordPrefix and not a strict token superset. The
      // Monsters pair IS a subset relation — {monsters,on,vacation} sits inside
      // {monsters,on,summer,vacation} — so a superset guard would refuse the
      // deletion this rule was built for. The distinction that matters is
      // WHERE the extra word sits: appended is parent/child, inserted is drift.
      const live = [span({ id: "summer", title: "Monsters on Summer Vacation (Special Exhibit)", city: "St Paul", start: "2026-05-23T09:00", end: "2027-01-10T17:00" })];
      const incoming = [span({ id: "aug", title: "Monsters on Vacation (Special Exhibit)", city: "St Paul", start: "2026-08-17T09:00", end: "2027-01-10T17:00" })];
      expect(planRunFolds(live, incoming)[0]?.drift).toBe(true);
    });

    it("a title whose words are REORDERED folds — no prefix or alias rule can see that", () => {
      // Token SETS, so order is free: both normalise to the same five words.
      // This is the shape that cannot be caught by any amount of prefix
      // matching, and the reason similarity was worth building at all.
      const live = [span({ id: "a", title: "Sever's Fall Festival & Corn Maze", city: "Shakopee", start: "2026-09-26T10:00", end: "2026-10-31T18:00" })];
      const incoming = [span({ id: "b", title: "Sever's Corn Maze & Fall Festival", city: "Shakopee", start: "2026-10-03T10:00", end: "2026-10-31T18:00" })];
      expect(planRunFolds(live, incoming)).toEqual([
        { incomingId: "b", keepId: "a", extendTo: null, drift: true },
      ]);
    });

    it("the threshold is a boundary, not a direction: 3-of-4 folds, 3-of-5 does not", () => {
      // The arithmetic the docblock claims, asserted rather than described.
      // One word inserted into a three-word title is 0.75 and folds; two words
      // inserted is 0.6 and does not. Both are INSERTIONS rather than appended
      // words, because an appended word is refused on shape whatever it scores
      // — which is what this test originally got wrong.
      const live = [span({ id: "run", title: "Holidazzle Village Market", city: "Minneapolis", start: "2026-11-27T11:00", end: "2026-12-23T19:00" })];
      const one = [span({ id: "one", title: "Holidazzle Village Night Market", city: "Minneapolis", start: "2026-12-04T11:00", end: "2026-12-23T19:00" })];
      const two = [span({ id: "two", title: "Holidazzle Village Night Craft Market", city: "Minneapolis", start: "2026-12-04T11:00", end: "2026-12-23T19:00" })];
      expect(planRunFolds(live, one)).toEqual([
        { incomingId: "one", keepId: "run", extendTo: null, drift: true },
      ]);
      expect(planRunFolds(live, two)).toEqual([]);
    });

    it("REFUSED: the first pair no reader would call one event, 0.444", () => {
      // Two real Mall of America listings sharing nothing but "at mall of
      // america" — the nearest thing to a false positive in the whole band,
      // and it sits 0.3 below the gate. If this ever folds, the threshold has
      // been lowered past the evidence.
      const live = [span({ id: "santa", title: "The Santa Experience at Mall of America", city: "Bloomington", start: "2026-11-07T10:00", end: "2026-12-24T20:00" })];
      const incoming = [span({ id: "trees", title: "Festival of Trees at Mall of America", city: "Bloomington", start: "2026-11-20T10:00", end: "2026-12-26T20:00" })];
      expect(planRunFolds(live, incoming)).toEqual([]);
    });

    it("REFUSED: the same swap in a SHORT title is not enough, 0.500", () => {
      // The pair above folds only because six venue words survive the swap.
      // Strip the prefix and the identical substitution scores 0.5 and is
      // refused — the gate is measuring shared evidence, not word distance.
      const live = [span({ id: "g", title: "Daily General Admission", city: "St Paul", start: "2026-10-10T10:00", end: "2026-11-10T17:00" })];
      const incoming = [span({ id: "o", title: "Daily Open Admission", city: "St Paul", start: "2026-10-24T10:00", end: "2026-11-24T17:00" })];
      expect(planRunFolds(live, incoming)).toEqual([]);
    });

    it("RUN → RUN still holds: a dated performance scoring 0.800 does NOT fold", () => {
      // The protection the coverage rule exists for, and the reason the
      // isWordPrefix widening was declined. A single-day sub-event has no span,
      // so it is not a run and cannot be a re-find of one — even though these
      // titles share 4 of 5 words and clear the threshold easily. An over-cap
      // run shows on its start day only, so this matinee is the one card a
      // reader gets on its own day.
      const live = [span({ id: "run", title: "Kunene and the King", city: "Minneapolis", category: "arts", start: "2026-10-10T19:30", end: "2026-11-08T21:30" })];
      const incoming = [span({ id: "mat", title: "Kunene and the King Matinee", city: "Minneapolis", category: "arts", start: "2026-10-24T13:00", end: "2026-10-24T15:30" })];
      expect(planRunFolds(live, incoming)).toEqual([]);
    });

    it("the sports rule is untouched: near-identical game titles never fold", () => {
      // PER_NIGHT is filtered before any similarity is computed, so a swap of
      // one word in a long game title cannot merge two real games.
      for (const category of ["sports", "music"]) {
        const live = [span({ id: "g1", category, title: "Minnesota Wild vs. Chicago Blackhawks Home Opener", city: "St Paul", start: "2026-11-10T19:00", end: "2026-11-12T21:30" })];
        const incoming = [span({ id: "g2", category, title: "Minnesota Wild vs. Chicago Blackhawks Home Game", city: "St Paul", start: "2026-11-11T19:00", end: "2026-11-13T21:30" })];
        expect(planRunFolds(live, incoming), category).toEqual([]);
      }
    });

    it("the city still has to match, however similar the words", () => {
      const live = [span({ id: "stp", title: "Monsters on Summer Vacation (Special Exhibit)", city: "St Paul", start: "2026-05-23T09:00", end: "2027-01-10T17:00" })];
      const incoming = [span({ id: "dul", title: "Monsters on Vacation (Special Exhibit)", city: "Duluth", start: "2026-08-17T09:00", end: "2027-01-10T17:00" })];
      expect(planRunFolds(live, incoming)).toEqual([]);
    });

    it("drift is asked of the KEEPER, so a row matching BOTH ways is not drift", () => {
      // Identical titles score 1.0, so this pair arrives down both paths at
      // once. The flag is derived from the keeper's keys rather than carried
      // from whichever list found it, so the two cannot disagree: this must
      // report a key match, not a similarity one. The ops email draws a
      // different line for each, and an ordinary weekly re-find is not a
      // judgement call.
      const live = [span({ id: "wk1", title: "Twelve Kinds of Ice", start: "2026-10-19T19:30", end: "2026-11-22T21:00" })];
      const incoming = [span({ id: "wk2", title: "Twelve Kinds of Ice", start: "2026-10-26T19:30", end: "2026-11-22T21:00" })];
      expect(planRunFolds(live, incoming)).toEqual([
        { incomingId: "wk2", keepId: "wk1", extendTo: null, drift: false },
      ]);
    });

    it("a drift candidate that starts EARLIER takes the keeper slot from a key match", () => {
      // The widening's second-order effect, and the reason key folds dropped
      // 16 → 14 on the live calendar while total folds rose 16 → 22: a drift
      // candidate now enters a pool the exact key used to have to itself, so
      // an existing fold can get a different keeper. Measured: 2 of 123
      // incoming rows are redirected this way, both in the Monsters cluster,
      // and both move the keeper to the May 23 row — which mcm.org attests as
      // the exhibit's opening date. The redirect is MORE correct on the date
      // axis, onto the row whose title is wrong.
      const live = [
        span({ id: "aug24", title: "Monsters on Vacation (Special Exhibit)", city: "St Paul", start: "2026-08-24T09:00", end: "2027-01-10T17:00" }),
        span({ id: "may23", title: "Monsters on Summer Vacation (Special Exhibit)", city: "St Paul", start: "2026-05-23T09:00", end: "2027-01-10T17:00" }),
      ];
      const incoming = [span({ id: "aug17", title: "Monsters on Vacation (Special Exhibit)", city: "St Paul", start: "2026-08-17T09:00", end: "2027-01-10T17:00" })];
      expect(planRunFolds(live, incoming)).toEqual([
        { incomingId: "aug17", keepId: "may23", extendTo: null, drift: true },
      ]);
    });

    it("a title that normalises to nothing folds onto nothing by similarity", () => {
      // Shared-of-union is 0 when one side has no tokens, so emptiness can
      // never reach the threshold. (An all-punctuation title still collides on
      // the exact key — a pre-existing hole, and no live row normalises empty.)
      const live = [span({ id: "real", title: "Fall Flower Show", city: "St Paul", start: "2026-10-23T10:00", end: "2026-11-29T16:00" })];
      const incoming = [span({ id: "empty", title: "— — —", city: "St Paul", start: "2026-10-26T10:00", end: "2026-11-25T16:00" })];
      expect(planRunFolds(live, incoming)).toEqual([]);
    });
  });
});
