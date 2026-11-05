import { describe, it, expect } from "vitest";
import { selectFeedEvents, type FeedSpec } from "../feeds";
import {
  selectCollection,
  collectionWindow,
  getCollection,
  COLLECTIONS,
  type CollectionSpec,
} from "../collections";
import type { EventRecord } from "../types";

const NOW = new Date("2026-07-13T09:00:00-05:00"); // Monday

function ev(overrides: Partial<EventRecord> = {}): EventRecord {
  return {
    id: Math.random().toString(36).slice(2),
    title: "Event",
    category: "music",
    venue: "Venue",
    address: "1 Main St",
    city: "Minneapolis",
    lat: 44.9,
    lng: -93.2,
    start: "2026-07-15T20:00", // Wed (in week window)
    end: "",
    price: "$25",
    priceTier: "$$",
    ticketUrl: "",
    description: "",
    image: "",
    sourceUrl: "",
    status: "published",
    ...overrides,
  };
}

describe("selectCollection — RULE 5, the fifth break (5 Nov 2026)", () => {
  // 3:30 PM Chicago on Monday 13 Jul 2026, the same instant the R1.2 regressions
  // above use, so the two sets of rules are tested against one clock.
  const afternoon = new Date("2026-07-13T20:30:00Z");
  // arts-and-culture, NOT live-music: PER_NIGHT = {sports, music}, so a music
  // row carrying a multiDayEnd is exactly what staleSpanIds deletes — a shape
  // production cannot produce, and therefore a fixture that proves nothing.
  // A review caught it. Window is "month", which the dates below sit inside.
  const spec = getCollection("arts-and-culture")!;

  it("a run that opened BEFORE the window and is open now is in its collection", () => {
    const run = ev({
      id: "run",
      category: "arts",
      start: "2026-06-01T19:00",
      end: "",
      multiDayEnd: "2026-07-30T22:00",
    });
    expect(selectCollection([run], spec, afternoon).map((e) => e.id)).toEqual(["run"]);
  });

  it("…including a SHORT run, which is why this is not just the over-cap bug", () => {
    const threeDay = ev({
      id: "short",
      category: "arts",
      start: "2026-07-12T19:00",
      end: "",
      multiDayEnd: "2026-07-14T22:00",
    });
    expect(selectCollection([threeDay], spec, afternoon).map((e) => e.id)).toEqual(["short"]);
  });

  it("a run that CLOSED before today is not — the fix is not 'everything matches'", () => {
    const over = ev({
      id: "over",
      category: "arts",
      start: "2026-06-01T19:00",
      end: "",
      multiDayEnd: "2026-07-12T22:00",
    });
    expect(selectCollection([over], spec, afternoon)).toEqual([]);
  });

  it("the weekend window asks spansDay, so a run covering the weekend counts", () => {
    // 13 Jul 2026 is a Monday; the weekend window is Fri 17 - Sun 19.
    const weekendSpec = getCollection("date-night")!;
    const overTheWeekend = ev({
      id: "wknd",
      category: "arts",
      start: "2026-07-15T19:00",
      end: "",
      multiDayEnd: "2026-07-21T22:00",
    });
    const ids = selectCollection([overTheWeekend], weekendSpec, afternoon).map((e) => e.id);
    expect(ids).toEqual(["wknd"]);
  });

  it("R1.2's floor survives for SINGLE-DAY events, and only for them", () => {
    // This is the one axis on which the page still differs from its own feed,
    // deliberately: a collection is what is coming up, so this morning's concert
    // is gone by the afternoon. A RUN that began this morning is still on.
    const pastToday = ev({ id: "past", category: "arts", start: "2026-07-13T09:00" });
    const runFromThisMorning = ev({
      id: "running",
      category: "arts",
      start: "2026-07-13T09:00",
      end: "",
      multiDayEnd: "2026-07-20T22:00",
    });
    const ids = selectCollection([pastToday, runFromThisMorning], spec, afternoon).map((e) => e.id);
    expect(ids).toEqual(["running"]);
  });

  it("the feed honours queryScope, which it used to drop", () => {
    // food-truck-festivals sets queryScope "title" on purpose. The feed called
    // matchesQuery without it, so a body mention got into the ICS and not the
    // page — the same spec answering twice, the non-span half of S4.
    const ftf = getCollection("food-truck-festivals")!;
    expect(ftf.queryScope).toBe("title");
    const titled = ev({ id: "titled", category: "food", title: "Food Truck Rally", start: "2026-07-20T12:00" });
    const bodyOnly = ev({
      id: "body",
      category: "food",
      title: "Summer Block Party",
      description: "with a food truck on site",
      start: "2026-07-20T12:00",
    });
    const feed: FeedSpec = { kind: "collection", key: ftf.slug, name: ftf.title, slug: ftf.slug };
    const page = selectCollection([titled, bodyOnly], ftf, afternoon).map((e) => e.id);
    const ics = selectFeedEvents([titled, bodyOnly], feed, afternoon).map((e) => e.id);
    expect(page).toEqual(ics);
    expect(ics).not.toContain("body");
  });

  // ── THE TEST THAT WOULD HAVE CAUGHT THIS ─────────────────────────────────
  // /collections/<slug> and /feeds/<slug>.ics are built from the SAME
  // CollectionSpec, and before today they answered differently: the feed used
  // true-span intersection, the page used the start day. Both now call
  // multiday's spansWindow. Pin the agreement, not just each side.
  it("the page and its own ICS feed agree about every run", () => {
    const rows = [
      ev({ id: "opened-before", category: "arts", start: "2026-06-01T19:00", end: "", multiDayEnd: "2026-07-30T22:00" }),
      ev({ id: "short-run", category: "arts", start: "2026-07-12T19:00", end: "", multiDayEnd: "2026-07-14T22:00" }),
      ev({ id: "starts-later", category: "arts", start: "2026-07-20T19:00" }),
      ev({ id: "closed", category: "arts", start: "2026-06-01T19:00", end: "", multiDayEnd: "2026-07-12T22:00" }),
      ev({ id: "span-by-end", category: "arts", start: "2026-07-01T19:00", end: "2026-07-25T22:00" }),
    ];
    const feed: FeedSpec = { kind: "collection", key: spec.slug, name: spec.title, slug: spec.slug };
    const page = selectCollection(rows, spec, afternoon).map((e) => e.id).sort();
    const ics = selectFeedEvents(rows, feed, afternoon).map((e) => e.id).sort();
    expect(page).toEqual(ics);
    expect(page).toContain("opened-before");
    expect(page).toContain("short-run");
    expect(page).not.toContain("closed");
  });
});

describe("selectCollection — the all-day floor (caught by review, 5 Nov 2026)", () => {
  const afternoon = new Date("2026-07-13T20:30:00Z"); // 3:30 PM Chicago
  const spec = getCollection("arts-and-culture")!;

  it("an ALL-DAY event today is not dropped at 00:01 — the day is the unit", () => {
    // all-day is stored at midnight (lib/time-integrity.ts), so a wall-time
    // floor binned a TBD game or a no-listed-time show from the first minute of
    // the day it happens. isEnded and isUpcoming have always used the day.
    const allDayToday = ev({
      category: "arts",
      start: "2026-07-13T00:00",
      end: "",
      allDay: true,
      title: "All-day today",
    });
    expect(selectCollection([allDayToday], spec, afternoon).map((e) => e.title)).toEqual([
      "All-day today",
    ]);
  });

  it("…but an all-day event YESTERDAY still is", () => {
    const yesterday = ev({ category: "arts", start: "2026-07-12T00:00", end: "", allDay: true });
    expect(selectCollection([yesterday], spec, afternoon)).toEqual([]);
  });

  it("a timed single-day event earlier today is still dropped — R1.2 intact", () => {
    const thisMorning = ev({ category: "arts", start: "2026-07-13T09:00", end: "" });
    expect(selectCollection([thisMorning], spec, afternoon)).toEqual([]);
  });
});

describe("collectionWindow — Chicago wall frame (R1.2)", () => {
  it("week runs from the wall-clock now through the 7th Chicago day", () => {
    const w = collectionWindow("week", NOW);
    expect(w.fromWall).toBe("2026-07-13T09:00");
    expect(w.endKey).toBe("2026-07-20");
    expect(w.days).toBeNull();
  });
  it("weekend covers the coming Fri–Sun as Chicago day keys", () => {
    // From Monday 7/13, the coming weekend is Fri 7/17 – Sun 7/19.
    const w = collectionWindow("weekend", NOW);
    expect([...w.days!].sort()).toEqual(["2026-07-17", "2026-07-18", "2026-07-19"]);
    expect(w.endKey).toBe("2026-07-19");
  });
  it("regression (R1.2): Sunday EVENING stays this weekend — no jump to next week", () => {
    // Sunday Jul 19, 8:00 PM CDT = Monday 01:00Z: the old server-frame getDay()
    // math saw Monday and produced NEXT weekend's window.
    const sundayEvening = new Date("2026-07-20T01:00:00Z");
    const w = collectionWindow("weekend", sundayEvening);
    expect([...w.days!]).toEqual(["2026-07-19"]);
  });
});

describe("food-truck-festivals collection (demand-validated, GSC Aug 2026)", () => {
  it("is registered, evergreen (no year in the title), all-window, title-scoped", () => {
    const c = getCollection("food-truck-festivals");
    expect(c).toBeDefined();
    expect(c!.window).toBe("all");
    expect(c!.query).toBe("food truck");
    expect(c!.queryScope).toBe("title"); // precision: the topic must be in the title
    expect(c!.seoTitle).toContain("Food Truck Festivals");
    // Evergreen like /this-week — never hardcode a year (would go stale + need edits).
    expect(c!.seoTitle).not.toMatch(/20\d\d/);
    expect(c!.title).not.toMatch(/20\d\d/);
  });

  it("matches food-truck events by TITLE; a body-only mention is a false positive, excluded", () => {
    const c = getCollection("food-truck-festivals")!;
    const events = [
      ev({ id: "ftf", title: "Anoka Food Truck Festival", category: "festival", start: "2026-08-01T11:00" }),
      ev({ id: "rally", title: "Rosemount Food Truck Rally", category: "food", start: "2026-09-01T16:00" }),
      // the real-world false positives: only MENTION food trucks in the body.
      ev({ id: "jazz", title: "Art and All That Jazz Festival", description: "with food trucks on site", start: "2026-08-05T18:00" }),
      ev({ id: "music", title: "Twin Cities Music and Movement Festival", description: "food trucks all weekend", start: "2026-08-06T12:00" }),
      ev({ id: "foodonly", title: "Trampled by Turtles", start: "2026-08-07T20:00" }),
    ];
    const picked = selectCollection(events, c, NOW).map((e) => e.id);
    expect(picked).toEqual(expect.arrayContaining(["ftf", "rally"]));
    expect(picked).not.toContain("jazz"); // title-scoped: body mention doesn't qualify
    expect(picked).not.toContain("music");
    expect(picked).not.toContain("foodonly");
  });
});

describe("selectCollection", () => {
  const list = [
    ev({ id: "wedMusic", category: "music", start: "2026-07-15T20:00" }),
    ev({ id: "friFamilyFree", category: "family", priceTier: "Free", start: "2026-07-17T10:00" }),
    ev({ id: "satArts", category: "arts", start: "2026-07-18T19:00" }),
    ev({ id: "farMusic", category: "music", start: "2026-08-30T20:00" }), // outside week
    ev({ id: "draft", category: "music", start: "2026-07-15T21:00", status: "draft" }),
  ];

  it("live-music picks music within the week, excludes drafts and far events", () => {
    const out = selectCollection(list, getCollection("live-music")!, NOW);
    const ids = out.map((e) => e.id);
    expect(ids).toContain("wedMusic");
    expect(ids).not.toContain("farMusic");
    expect(ids).not.toContain("draft");
    expect(ids).not.toContain("friFamilyFree");
  });

  it("free-this-week filters to Free tier", () => {
    const out = selectCollection(list, getCollection("free-this-week")!, NOW);
    expect(out.map((e) => e.id)).toEqual(["friFamilyFree"]);
  });

  it("date-night matches any of music/arts/food on the weekend", () => {
    const out = selectCollection(list, getCollection("date-night")!, NOW);
    // satArts is on the weekend; wedMusic is Wednesday (not weekend)
    expect(out.map((e) => e.id)).toContain("satArts");
    expect(out.map((e) => e.id)).not.toContain("wedMusic");
  });

  it("regression (R1.2): tonight's show is IN this afternoon — walls compared to walls", () => {
    // 3:30 PM CDT = 20:30Z. The old code parsed the 7 PM wall as 7 PM UTC
    // (= 2 PM CT) and dropped it from every collection after ~2 PM.
    const afternoon = new Date("2026-07-13T20:30:00Z");
    const tonight = ev({ id: "tonight", category: "music", start: "2026-07-13T19:00" });
    const earlier = ev({ id: "thisMorning", category: "music", start: "2026-07-13T09:00" });
    const ids = selectCollection([tonight, earlier], getCollection("live-music")!, afternoon).map((e) => e.id);
    expect(ids).toContain("tonight");
    expect(ids).not.toContain("thisMorning"); // already past — floor intact
  });

  it("regression (R1.2): Sunday-evening date-night shows tonight, not next weekend", () => {
    const sundayEvening = new Date("2026-07-20T01:00:00Z"); // Sun 7/19 8 PM CDT
    const tonight = ev({ id: "sunShow", category: "music", start: "2026-07-19T21:00" });
    const nextSat = ev({ id: "nextSat", category: "arts", start: "2026-07-25T19:00" });
    const ids = selectCollection([tonight, nextSat], getCollection("date-night")!, sundayEvening).map((e) => e.id);
    expect(ids).toEqual(["sunShow"]);
  });

  it("results are sorted chronologically", () => {
    const spec: CollectionSpec = { slug: "x", title: "X", tagline: "", window: "month" };
    const out = selectCollection(list, spec, NOW);
    for (let i = 1; i < out.length; i++) {
      expect(new Date(out[i].start).getTime()).toBeGreaterThanOrEqual(
        new Date(out[i - 1].start).getTime(),
      );
    }
  });
});

describe("COLLECTIONS registry", () => {
  it("every collection has a unique slug and required fields", () => {
    const slugs = new Set<string>();
    for (const c of COLLECTIONS) {
      expect(c.slug).toMatch(/^[a-z0-9-]+$/);
      expect(c.title.length).toBeGreaterThan(0);
      expect(c.tagline.length).toBeGreaterThan(0);
      expect(slugs.has(c.slug)).toBe(false);
      slugs.add(c.slug);
    }
  });
  it("getCollection resolves by slug", () => {
    expect(getCollection("free-this-week")?.title).toContain("Free");
    expect(getCollection("nonsense")).toBeUndefined();
    // 6.3 — this-weekend GRADUATED from a collection to the evergreen root
    // URL (/this-weekend, with a 301 from the old path). It must stay out of
    // the registry, or two pages would compete for the same query.
    expect(getCollection("this-weekend")).toBeUndefined();
  });
});
