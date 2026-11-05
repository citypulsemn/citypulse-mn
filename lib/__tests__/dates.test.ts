import { describe, it, expect } from "vitest";
import {
  rangeWindow,
  eventsInWindow,
  matchesAfterWindow,
  classifyDay,
  isFocus,
  dkey,
} from "../dates";
import { sampleEvents } from "../sample-events";
import { CATEGORY_KEYS } from "../categories";
import type { CategoryKey, EventRecord, ViewState } from "../types";
import { isUpcoming, daysSpanned, spanEndISO, EXPAND_MAX_DAYS } from "../dates";
import { spanEnd } from "../multiday";
import { planListView, LIST_ONGOING_CAP } from "../list-view";

// Deterministic "now": Sunday, June 14, 2026, noon.
const NOW = new Date("2026-06-14T12:00:00");
const ALL = new Set<CategoryKey>(CATEGORY_KEYS);
const view = (range: ViewState["range"]): ViewState => ({
  range,
  year: 2026,
  month: 5, // June
});

const idsFor = (range: ViewState["range"]) =>
  eventsInWindow(sampleEvents, ALL, rangeWindow(NOW, view(range)))
    .map((e) => Number(e.id))
    .sort((a, b) => a - b);

describe("rangeWindow", () => {
  it("NOW is a Sunday", () => {
    expect(NOW.getDay()).toBe(0);
  });

  it("today = just June 14", () => {
    const w = rangeWindow(NOW, view("today"));
    expect(dkey(w.start)).toBe("2026-06-14");
    expect(dkey(w.end)).toBe("2026-06-14");
  });

  it("weekend on a Sunday is STILL this weekend (today only) — aligned with /this-weekend (R1.7)", () => {
    // Taren's call, Jul 20: one weekend philosophy everywhere. A Sunday tap
    // on "Weekend" means tonight; past Fri/Sat are clipped as always.
    const w = rangeWindow(NOW, view("weekend"));
    expect(dkey(w.start)).toBe("2026-06-14");
    expect(dkey(w.end)).toBe("2026-06-14");
  });

  it("week = today through +6 days (Jun 14–20)", () => {
    const w = rangeWindow(NOW, view("week"));
    expect(dkey(w.start)).toBe("2026-06-14");
    expect(dkey(w.end)).toBe("2026-06-20");
  });

  it("month = full June", () => {
    const w = rangeWindow(NOW, view("month"));
    expect(dkey(w.start)).toBe("2026-06-01");
    expect(dkey(w.end)).toBe("2026-06-30");
  });

  it("weekend on a Wednesday points forward to that week's Fri–Sun", () => {
    const wed = new Date("2026-06-17T12:00:00"); // Wednesday
    const w = rangeWindow(wed, { range: "weekend", year: 2026, month: 5 });
    expect(dkey(w.start)).toBe("2026-06-19");
    expect(dkey(w.end)).toBe("2026-06-21");
  });
});

describe("eventsInWindow (sample data)", () => {
  it("today = ids 1,2,3", () => {
    expect(idsFor("today")).toEqual([1, 2, 3]);
  });

  it("weekend from Sunday = today's events only (R1.7 alignment)", () => {
    expect(idsFor("weekend")).toEqual(idsFor("today"));
  });

  it("weekend from a Wednesday = 8 events, all on Jun 19–21", () => {
    const wed = new Date("2026-06-17T12:00:00");
    const ids = eventsInWindow(sampleEvents, ALL, rangeWindow(wed, view("weekend")))
      .map((e) => Number(e.id))
      .sort((a, b) => a - b);
    expect(ids.length).toBe(8);
    for (const id of ids) {
      const ev = sampleEvents.find((e) => Number(e.id) === id)!;
      expect([19, 20, 21]).toContain(new Date(ev.start).getDate());
    }
  });

  it("week = 15 events, all within Jun 14–20", () => {
    const ids = idsFor("week");
    expect(ids.length).toBe(15);
    for (const id of ids) {
      const d = new Date(sampleEvents.find((e) => Number(e.id) === id)!.start);
      expect(d.getMonth()).toBe(5);
      expect(d.getDate()).toBeGreaterThanOrEqual(14);
      expect(d.getDate()).toBeLessThanOrEqual(20);
    }
  });

  it("month = the full dataset", () => {
    expect(idsFor("month").length).toBe(sampleEvents.length);
  });

  it("today is a subset of week", () => {
    const week = new Set(idsFor("week"));
    expect(idsFor("today").every((id) => week.has(id))).toBe(true);
  });

  it("category filter narrows results", () => {
    const onlySports = new Set<CategoryKey>(["sports"]);
    const w = rangeWindow(NOW, view("month"));
    const evs = eventsInWindow(sampleEvents, onlySports, w);
    expect(evs.length).toBeGreaterThan(0);
    expect(evs.every((e) => e.category === "sports")).toBe(true);
  });
});

describe("spotlight classification (weekend window)", () => {
  it("Sunday's weekend window spotlights today only (R1.7 alignment)", () => {
    const w = rangeWindow(NOW, view("weekend"));
    expect(classifyDay(2026, 5, 13, w)).toBe("outrange");
    expect(classifyDay(2026, 5, 14, w)).toBe("inrange");
    expect(classifyDay(2026, 5, 15, w)).toBe("outrange");
  });
  it("a mid-week window spotlights the coming Fri–Sun and nothing beyond", () => {
    const w = rangeWindow(new Date("2026-06-17T12:00:00"), view("weekend"));
    expect(classifyDay(2026, 5, 18, w)).toBe("outrange");
    expect(classifyDay(2026, 5, 19, w)).toBe("inrange");
    expect(classifyDay(2026, 5, 21, w)).toBe("inrange");
    expect(classifyDay(2026, 5, 22, w)).toBe("outrange");
  });
});

describe("isFocus", () => {
  it("month is neutral, others focus", () => {
    expect(isFocus("month")).toBe(false);
    expect(isFocus("today")).toBe(true);
    expect(isFocus("weekend")).toBe(true);
    expect(isFocus("week")).toBe(true);
  });
});

describe("isUpcoming (UX9 span-aware index/detail predicate)", () => {
  // EXPLICIT Z, deliberately. This was `new Date("2026-08-06T15:00:00")` — a
  // naive parse, so it meant 15:00 Chicago on a Chicago laptop and 15:00 UTC on
  // CI. isUpcoming did the same naive parse on the other side of its compare,
  // so the two errors cancelled and the suite stayed green over a bug that only
  // existed in production (ENGINEERING rule 3). Both sides are pinned now:
  // 20:00Z in August is 15:00 Chicago, which is what every case below assumes.
  const NOWD = new Date("2026-08-06T20:00:00Z");
  const mk = (over: Partial<EventRecord>): EventRecord => ({ ...sampleEvents[0], ...over });

  it("an end-carried span counts on its CLOSING day (the vanishing-slice bug)", () => {
    // start is 5 days past, no collapse multiDayEnd — the span lives in `end`.
    // The old index predicate (multiDayEnd ? … : start) dropped this to count 0.
    const ev = mk({ start: "2026-08-01T19:00", end: "2026-08-06T18:00", multiDayEnd: null });
    expect(isUpcoming(ev, NOWD)).toBe(true);
  });

  it("a collapse multiDayEnd span also counts on its closing day", () => {
    const ev = mk({ start: "2026-08-01T00:00", end: "2026-08-01T23:59", multiDayEnd: "2026-08-06T23:59" });
    expect(isUpcoming(ev, NOWD)).toBe(true);
  });

  it("a single-day event yesterday is not upcoming", () => {
    const ev = mk({ start: "2026-08-05T20:00", end: "2026-08-05T23:00", multiDayEnd: null });
    expect(isUpcoming(ev, NOWD)).toBe(false);
  });

  it("a single-day event later today is upcoming through end of day", () => {
    const ev = mk({ start: "2026-08-06T20:00", end: "2026-08-06T23:00", multiDayEnd: null });
    expect(isUpcoming(ev, NOWD)).toBe(true);
  });

  it("a future event is upcoming", () => {
    const ev = mk({ start: "2026-09-01T20:00", end: "2026-09-01T23:00", multiDayEnd: null });
    expect(isUpcoming(ev, NOWD)).toBe(true);
  });

  it("an invalid start is never upcoming", () => {
    const ev = mk({ start: "not-a-date", end: "", multiDayEnd: null });
    expect(isUpcoming(ev, NOWD)).toBe(false);
  });

  // THE EVENING CUTOFF (rule 10, fixed 30 Oct 2026). isUpcoming compared a naive
  // Chicago wall string against a real instant, so on Vercel — a UTC server —
  // "23:59" meant 18:59 Chicago and tonight's show left /venues, /cities,
  // /neighborhoods and their three indexes at 7 PM. These instants are pinned
  // with Z so they mean the same thing on a Chicago laptop and on CI; in August
  // Chicago is UTC-5.
  describe("the evening cutoff", () => {
    const tonight = mk({ start: "2026-08-06T19:00", end: "2026-08-06T22:00", multiDayEnd: null });

    it("a 7pm show is still upcoming at 7:30pm Chicago, while it is happening", () => {
      expect(isUpcoming(tonight, new Date("2026-08-07T00:30:00Z"))).toBe(true);
    });

    it("…and at 10pm Chicago, the hour the old code had already hidden it", () => {
      expect(isUpcoming(tonight, new Date("2026-08-07T03:00:00Z"))).toBe(true);
    });

    it("…and is gone once the Chicago day is over, not when UTC's is", () => {
      // 00:30 Chicago on the 7th. The event's last day was the 6th.
      expect(isUpcoming(tonight, new Date("2026-08-07T05:30:00Z"))).toBe(false);
    });

    it("holds in winter too, when the offset is UTC-6", () => {
      const janShow = mk({ start: "2026-01-15T19:00", end: "2026-01-15T22:00", multiDayEnd: null });
      expect(isUpcoming(janShow, new Date("2026-01-16T04:00:00Z"))).toBe(true); // 22:00 Chicago
      expect(isUpcoming(janShow, new Date("2026-01-16T06:30:00Z"))).toBe(false); // 00:30 Chicago
    });
  });
});

describe('over-cap runs: the grid question is not "is it still on" (rule 5, 5 Nov 2026)', () => {
  // 12:00 Chicago on 5 Nov 2026 (CST, UTC-6), pinned with Z so this means the
  // same thing on a Chicago laptop and on CI (ENGINEERING rule 3).
  const NOV5 = new Date("2026-11-05T18:00:00Z");
  const mk = (over: Partial<EventRecord>): EventRecord => ({ ...sampleEvents[0], ...over });

  // Real rows, measured on the live site that morning. The span lives in
  // multi_day_end and end_at is cleared — but a cleared end_at does NOT reach
  // the client as "": lib/events.ts rowToEvent does `end: r.end ?? r.start`, so
  // 207 published rows carry end === start. These fixtures use that real shape,
  // not an empty string (a review caught the earlier comment claiming otherwise).
  const fallFlower = mk({ start: "2026-10-23T10:00", end: "2026-10-23T10:00", multiDayEnd: "2026-11-29T23:59" }); // 38 days
  const grinch = mk({ start: "2026-11-03T19:00", end: "2026-11-03T19:00", multiDayEnd: "2027-01-03T23:59" }); // 62 days
  const monsters = mk({ start: "2026-05-23T09:00", end: "2026-05-23T09:00", multiDayEnd: "2027-01-10T23:59" }); // 233 days

  it("a 38-day run is upcoming in the middle of it", () => {
    expect(isUpcoming(fallFlower, NOV5)).toBe(true);
  });

  it("...and so are a 62-day and a 233-day run", () => {
    expect(isUpcoming(grinch, NOV5)).toBe(true);
    expect(isUpcoming(monsters, NOV5)).toBe(true);
  });

  it("THE ASYMMETRY, deliberately: those same rows paint ONE calendar cell", () => {
    // Not a bug to fix next. daysSpanned answers "which grid cells do I paint",
    // and a 233-day run painting 233 cells IS the flood incident
    // (docs/deploy-history/HOTFIX-calendar-flood.md). isUpcoming asks a different
    // question and must never borrow this answer again.
    expect(daysSpanned(fallFlower)).toEqual(["2026-10-23"]);
    expect(daysSpanned(monsters)).toEqual(["2026-05-23"]);
  });

  it("the cap boundary: 14 days and 15 days are BOTH still on, mid-run", () => {
    // 14 days inclusive (date diff 13) is the longest run the grid expands; 15 is
    // the first it collapses. The 14-day case was already right and is the
    // control here. The 15-day one read as FINISHED from its second day.
    const atCap = mk({ start: "2026-11-01T10:00", end: "", multiDayEnd: "2026-11-14T23:59" });
    const pastCap = mk({ start: "2026-11-01T10:00", end: "", multiDayEnd: "2026-11-15T23:59" });
    expect(daysSpanned(atCap)).toHaveLength(EXPAND_MAX_DAYS);
    expect(daysSpanned(pastCap)).toEqual(["2026-11-01"]);
    expect(isUpcoming(atCap, NOV5)).toBe(true);
    expect(isUpcoming(pastCap, NOV5)).toBe(true);
  });

  it('an over-cap run that has CLOSED is not upcoming - the fix is not "always true"', () => {
    const closed = mk({ start: "2026-08-01T10:00", end: "", multiDayEnd: "2026-11-04T23:59" });
    expect(isUpcoming(closed, NOV5)).toBe(false);
  });

  it("an over-cap run is still on through its LAST day, and gone after it", () => {
    const closesToday = mk({ start: "2026-08-01T10:00", end: "", multiDayEnd: "2026-11-05T17:00" });
    // 22:00 Chicago on the closing day - rule 10 still holds through the new path
    expect(isUpcoming(closesToday, new Date("2026-11-06T04:00:00Z"))).toBe(true);
    // 00:30 Chicago the next day
    expect(isUpcoming(closesToday, new Date("2026-11-06T06:30:00Z"))).toBe(false);
  });

  it("an over-cap span carried by end rather than multiDayEnd counts too", () => {
    // Both sources of span - the divergence isUpcoming's docstring is about, now
    // covered PAST the cap as well as inside it.
    const byEnd = mk({ start: "2026-10-01T10:00", end: "2026-11-20T17:00", multiDayEnd: null });
    expect(daysSpanned(byEnd)).toEqual(["2026-10-01"]); // grid: start day only
    expect(isUpcoming(byEnd, NOV5)).toBe(true);
  });
});

describe("spanEndISO - one rule, one home (5 Nov 2026)", () => {
  const sp = (over: Record<string, unknown>) => ({
    start: "2026-07-01T20:00",
    end: "",
    multiDayEnd: null as string | null,
    ...over,
  });

  it("reads multiDayEnd, then a genuinely later end, else null", () => {
    expect(spanEndISO(sp({ multiDayEnd: "2026-07-05T23:59" }))).toBe("2026-07-05T23:59");
    expect(spanEndISO(sp({ end: "2026-07-05T17:00" }))).toBe("2026-07-05T17:00");
    expect(spanEndISO(sp({ end: "2026-07-01T23:00" }))).toBeNull(); // same day
    expect(spanEndISO(sp({}))).toBeNull();
  });

  it("multiDayEnd wins even when end lands later", () => {
    expect(spanEndISO(sp({ end: "2026-07-09T17:00", multiDayEnd: "2026-07-05T23:59" }))).toBe(
      "2026-07-05T23:59",
    );
  });

  it("a multiDayEnd at or before the start day is not a span", () => {
    expect(spanEndISO(sp({ multiDayEnd: "2026-07-01T23:59" }))).toBeNull();
    expect(spanEndISO(sp({ multiDayEnd: "2026-06-28T23:59" }))).toBeNull();
  });

  it("THE LATE-NIGHT BOUNDARY: 05:59 next morning is one show, 06:00 is a span", () => {
    expect(spanEndISO(sp({ end: "2026-07-02T05:59" }))).toBeNull();
    expect(spanEndISO(sp({ end: "2026-07-02T06:00" }))).toBe("2026-07-02T06:00");
    // two days later at 2 AM is a span, not a late night
    expect(spanEndISO(sp({ end: "2026-07-03T02:00" }))).toBe("2026-07-03T02:00");
  });

  it("holds across both DST jumps - the boundary is a calendar day, not 24 hours", () => {
    // spring forward 8 Mar 2026; fall back 1 Nov 2026
    expect(spanEndISO(sp({ start: "2026-03-07T20:00", end: "2026-03-08T01:00" }))).toBeNull();
    expect(spanEndISO(sp({ start: "2026-10-31T20:00", end: "2026-11-01T01:00" }))).toBeNull();
    expect(spanEndISO(sp({ start: "2026-03-07T20:00", end: "2026-03-08T10:00" }))).toBe(
      "2026-03-08T10:00",
    );
  });

  it("lib/multiday spanEnd IS this function now - the two cannot drift (rule 5)", () => {
    // The duplication was the rule-5 defect generator: two hand-kept copies, each
    // commented as a mirror of the other. This pins the delegation.
    const cases = [
      sp({}),
      sp({ multiDayEnd: "2026-07-05T23:59" }),
      sp({ end: "2026-07-05T17:00" }),
      sp({ end: "2026-07-02T05:59" }),
      sp({ end: "2026-07-02T06:00" }),
      sp({ end: "2026-07-03T02:00" }),
      sp({ end: "2026-07-09T17:00", multiDayEnd: "2026-07-05T23:59" }),
      sp({ multiDayEnd: "2026-06-28T23:59" }),
      sp({ start: "2026-10-31T20:00", end: "2026-11-01T01:00" }),
      sp({ start: "2026-05-23T09:00", multiDayEnd: "2027-01-10T23:59" }),
    ];
    for (const c of cases) expect(spanEnd(c)).toBe(spanEndISO(c));
  });
});

describe("eventsInWindow — RULE 5, the fourth break (5 Nov 2026)", () => {
  // The window: Tuesday 10 Nov 2026 alone, the shape rangeWindow("today") builds.
  const win = { start: new Date(2026, 10, 10, 0, 0, 0), end: new Date(2026, 10, 10, 23, 59, 59) };
  const mk = (over: Partial<EventRecord>): EventRecord => ({ ...sampleEvents[0], ...over });
  const ids = (evs: EventRecord[]) => evs.map((e) => e.id);

  // THE ONE THAT MATTERS MOST: not an over-cap run. Three days, well inside
  // EXPAND_MAX_DAYS, so the calendar grid already painted it onto 10 Nov while
  // the list — looking at the same day — said it was not on.
  it("a THREE-day run spanning the window is on, though it started earlier", () => {
    const shortRun = mk({
      id: "short",
      start: "2026-11-09T10:00",
      end: "",
      multiDayEnd: "2026-11-11T17:00",
    });
    expect(ids(eventsInWindow([shortRun], ALL, win))).toEqual(["short"]);
  });

  it("…and so does a 233-day exhibition", () => {
    const exhibition = mk({
      id: "long",
      start: "2026-05-23T09:00",
      end: "",
      multiDayEnd: "2027-01-10T23:59",
    });
    expect(ids(eventsInWindow([exhibition], ALL, win))).toEqual(["long"]);
  });

  it("a span carried by end_at rather than multiDayEnd counts too", () => {
    const byEnd = mk({ id: "byEnd", start: "2026-11-01T10:00", end: "2026-11-20T17:00", multiDayEnd: null });
    expect(ids(eventsInWindow([byEnd], ALL, win))).toEqual(["byEnd"]);
  });

  it("an event starting inside the window is unchanged", () => {
    const today = mk({ id: "today", start: "2026-11-10T19:30", end: "2026-11-10T22:00", multiDayEnd: null });
    expect(ids(eventsInWindow([today], ALL, win))).toEqual(["today"]);
  });

  it("THE OTHER DIRECTION — the fix is not 'everything matches'", () => {
    const closedYesterday = mk({ id: "a", start: "2026-10-01T10:00", end: "", multiDayEnd: "2026-11-09T23:59" });
    const startsTomorrow = mk({ id: "b", start: "2026-11-11T10:00", end: "", multiDayEnd: "2026-12-01T23:59" });
    const longPast = mk({ id: "c", start: "2026-09-01T10:00", end: "2026-09-01T12:00", multiDayEnd: null });
    expect(eventsInWindow([closedYesterday, startsTomorrow, longPast], ALL, win)).toEqual([]);
  });

  it("the boundaries: a run ending ON the first day, and one starting ON the last", () => {
    const endsToday = mk({ id: "ends", start: "2026-10-20T10:00", end: "", multiDayEnd: "2026-11-10T16:00" });
    const startsToday = mk({ id: "starts", start: "2026-11-10T20:00", end: "", multiDayEnd: "2026-12-20T23:59" });
    expect(ids(eventsInWindow([endsToday, startsToday], ALL, win)).sort()).toEqual(["ends", "starts"]);
  });

  it("the category filter still applies to a spanning event", () => {
    const run = mk({ id: "r", category: "arts", start: "2026-11-01T10:00", end: "", multiDayEnd: "2026-11-30T23:59" });
    expect(eventsInWindow([run], new Set<CategoryKey>(["music"]), win)).toEqual([]);
    expect(ids(eventsInWindow([run], new Set<CategoryKey>(["arts"]), win))).toEqual(["r"]);
  });

  // THE SYMPTOM, pinned at the level a reader meets it: the calendar cell and
  // the list are two views of one dataset and must not disagree about one day.
  it("the grid cell and the list agree for the same day", () => {
    const rows = [
      mk({ id: "s1", start: "2026-11-09T10:00", end: "", multiDayEnd: "2026-11-11T17:00" }), // in-cap run
      mk({ id: "s2", start: "2026-11-10T19:00", end: "2026-11-10T22:00", multiDayEnd: null }), // starts today
      mk({ id: "s3", start: "2026-05-23T09:00", end: "", multiDayEnd: "2027-01-10T23:59" }), // over-cap
    ];
    const inList = new Set(eventsInWindow(rows, ALL, win).map((e) => e.id));
    for (const r of rows) {
      // daysSpanned is the grid's own answer for this cell
      if (daysSpanned(r).includes("2026-11-10")) {
        expect(inList.has(r.id), `grid shows ${r.id} on 10 Nov, list does not`).toBe(true);
      }
    }
    // and the over-cap run, which the grid does NOT paint on this cell, is still
    // in the list — the list asks "is it on", not "which cells do I paint"
    expect(daysSpanned(rows[2])).toEqual(["2026-05-23"]);
    expect(inList.has("s3")).toBe(true);
  });
});

describe("planListView — the window's long runs get their own group", () => {
  const WIN = "2026-11-10";
  const mk = (over: Partial<EventRecord>): EventRecord => ({ ...sampleEvents[0], ...over });

  it("a mid-run event goes to 'ongoing', not into a day group", () => {
    const run = mk({ id: "r", start: "2026-10-01T10:00", end: "", multiDayEnd: "2026-11-20T23:59" });
    const plan = planListView([run], WIN);
    expect(plan.ongoing.map((e) => e.id)).toEqual(["r"]);
    expect(plan.days).toEqual([]);
  });

  it("an event starting in the window stays in its day group", () => {
    const today = mk({ id: "t", start: "2026-11-10T19:00", end: "2026-11-10T22:00", multiDayEnd: null });
    const plan = planListView([today], WIN);
    expect(plan.ongoing).toEqual([]);
    expect(plan.days.map((g) => g.key)).toEqual(["2026-11-10"]);
  });

  it("ongoing is ordered ending-soonest, because that is the only urgent part", () => {
    const rows = [
      mk({ id: "late", title: "Late", start: "2026-01-01T10:00", end: "", multiDayEnd: "2027-06-01T23:59" }),
      mk({ id: "soon", title: "Soon", start: "2026-10-01T10:00", end: "", multiDayEnd: "2026-11-12T23:59" }),
      mk({ id: "mid", title: "Mid", start: "2026-09-01T10:00", end: "", multiDayEnd: "2026-12-15T23:59" }),
    ];
    expect(planListView(rows, WIN).ongoing.map((e) => e.id)).toEqual(["soon", "mid", "late"]);
  });

  it("caps the group but reports the honest total", () => {
    const rows = Array.from({ length: 9 }, (_, i) =>
      mk({
        id: `r${i}`,
        start: "2026-10-01T10:00",
        end: "",
        multiDayEnd: `2026-11-${String(12 + i).padStart(2, "0")}T23:59`,
      }),
    );
    const plan = planListView(rows, WIN);
    expect(plan.ongoing).toHaveLength(LIST_ONGOING_CAP);
    expect(plan.ongoingTotal).toBe(9);
  });

  it("honest emptiness: nothing in, nothing out", () => {
    expect(planListView([], WIN)).toEqual({ ongoing: [], ongoingTotal: 0, days: [] });
  });

  it("the two groups partition the input — nothing lost, nothing doubled", () => {
    const rows = [
      mk({ id: "a", start: "2026-10-01T10:00", end: "", multiDayEnd: "2026-11-20T23:59" }),
      mk({ id: "b", start: "2026-11-10T19:00", end: "2026-11-10T22:00", multiDayEnd: null }),
      mk({ id: "c", start: "2026-11-12T19:00", end: "2026-11-12T22:00", multiDayEnd: null }),
    ];
    const plan = planListView(rows, WIN, 99);
    const seen = [...plan.ongoing.map((e) => e.id), ...plan.days.flatMap((g) => g.events.map((e) => e.id))];
    expect(seen.sort()).toEqual(["a", "b", "c"]);
  });
});

describe("matchesAfterWindow (UX9 cross-month search)", () => {
  it("returns null when nothing starts after the window", () => {
    // Sample data is entirely June → a June-month window has no 'after'.
    const w = rangeWindow(NOW, view("month"));
    expect(matchesAfterWindow(sampleEvents, ALL, w)).toBeNull();
  });

  it("counts matches after a narrow window and points at the earliest", () => {
    const w = rangeWindow(NOW, view("today")); // Jun 14
    const ahead = matchesAfterWindow(sampleEvents, ALL, w);
    expect(ahead).not.toBeNull();
    const after = sampleEvents.filter((e) => new Date(e.start) > w.end);
    expect(ahead!.count).toBe(after.length);
    const earliest = Math.min(...after.map((e) => new Date(e.start).getTime()));
    expect(ahead!.firstDate.getTime()).toBe(earliest);
    expect(ahead!.firstDate.getTime()).toBeGreaterThan(w.end.getTime());
  });

  it("respects the active category set", () => {
    const w = rangeWindow(NOW, view("today"));
    const onlySports = new Set<CategoryKey>(["sports"]);
    const ahead = matchesAfterWindow(sampleEvents, onlySports, w);
    const after = sampleEvents.filter(
      (e) => e.category === "sports" && new Date(e.start) > w.end,
    );
    expect(ahead?.count ?? 0).toBe(after.length);
  });
});
