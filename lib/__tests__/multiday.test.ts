import { describe, it, expect } from "vitest";
import {
  normalizeRunTitle,
  runKey,
  groupRuns,
  collapsibleClusters,
  isMultiDay,
  multiDayLabel,
  runLength,
  spansDay,
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

  it("caps runaway spans (a bad multi_day_end can't balloon the calendar)", () => {
    const days = daysSpanned(ev({ start: "2026-01-01T10:00", multiDayEnd: "2030-01-01T00:00" }));
    expect(days.length).toBeLessThanOrEqual(60);
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
