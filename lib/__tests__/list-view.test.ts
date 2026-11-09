import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { groupEventsByDay, planListView, soonestFirstThenRuns } from "../list-view";
import type { EventRecord } from "../types";

function ev(id: string, start: string, overrides: Partial<EventRecord> = {}): EventRecord {
  return {
    id,
    title: id,
    category: "music",
    venue: "V",
    address: "",
    city: "Minneapolis",
    lat: 44.9,
    lng: -93.2,
    start,
    end: "",
    price: "$10",
    priceTier: "$",
    ticketUrl: "",
    description: "",
    image: "",
    sourceUrl: "",
    status: "published",
    multiDayEnd: null,
    allDay: false,
    ...overrides,
  };
}

describe("groupEventsByDay (UX4) — the chronological agenda", () => {
  const WINDOW_START = "2026-08-07"; // e.g. a "this weekend" window

  it("buckets events by start day, days ascending, events within a day by time", () => {
    const groups = groupEventsByDay(
      [
        ev("sat-late", "2026-08-08T21:00"),
        ev("fri", "2026-08-07T19:00"),
        ev("sat-early", "2026-08-08T11:00"),
      ],
      WINDOW_START,
    );
    expect(groups.map((g) => g.key)).toEqual(["2026-08-07", "2026-08-08"]);
    expect(groups[1].events.map((e) => e.id)).toEqual(["sat-early", "sat-late"]); // 11am before 9pm
  });

  it("clamps an ongoing event (started before the window) to the window's first day", () => {
    // A festival that began Aug 1 but is still running this weekend must sit at
    // the TOP of the list, not under an Aug 1 header that has already passed.
    const groups = groupEventsByDay(
      [ev("sat", "2026-08-08T19:00"), ev("ongoing", "2026-08-01T10:00", { multiDayEnd: "2026-08-10T22:00" })],
      WINDOW_START,
    );
    expect(groups[0].key).toBe("2026-08-07"); // clamped to window start, ranks first
    expect(groups[0].events.map((e) => e.id)).toContain("ongoing");
    expect(groups.some((g) => g.key === "2026-08-01")).toBe(false); // no past header
  });

  it("empty in → empty out", () => {
    expect(groupEventsByDay([], WINDOW_START)).toEqual([]);
  });

  it("does not mutate the input array order", () => {
    const input = [ev("b", "2026-08-08T21:00"), ev("a", "2026-08-08T11:00")];
    const snapshot = input.map((e) => e.id);
    groupEventsByDay(input, WINDOW_START);
    expect(input.map((e) => e.id)).toEqual(snapshot);
  });
});

describe("UX4 wiring — the list view and the mobile default", () => {
  const root = join(__dirname, "..", "..");
  const explorer = readFileSync(join(root, "components", "EventsExplorer.tsx"), "utf8");

  it("the view type includes 'list' and the explorer drives the shared toggle", () => {
    expect(explorer).toContain('"list" | "calendar" | "map"');
    // The three buttons moved out of this file into components/ViewToggle.tsx so
    // the other events pages could carry the control too; the explorer still owns
    // the state and still switches view in place.
    expect(explorer).toContain("<ViewToggleButtons view={view} onSelect={setView} />");
    const toggle = readFileSync(join(root, "components", "ViewToggle.tsx"), "utf8");
    expect(toggle).toContain("onClick={() => onSelect(v.key)}");
    for (const label of ["List", "Calendar", "Map"]) expect(toggle).toContain(label);
  });

  it("the list renders the WINDOWED events (what the presets drive), not the whole month", () => {
    // Substance, not formatting: the list must get the WINDOWED set, the window
    // start for day grouping, and todayKey — which is what decides "Already
    // running" (5 Nov 2026; splitting on the window instead labelled closed runs
    // as running on the month preset).
    expect(explorer).toContain("<ListView");
    expect(explorer).toContain("events={windowedEvents}");
    expect(explorer).toContain("windowStartKey={dkey(win.start)}");
    expect(explorer).toContain("todayKey={dkey(now)}");
  });

  it("list/week is the UNIVERSAL default (U5 — no viewport swap, so no mobile flash)", () => {
    // U5 replaced the client-only `window.innerWidth < 820` swap (which flashed the
    // month calendar before switching phones to the list) with a shared default that
    // the SSR first paint already matches on every device.
    expect(explorer).not.toContain("window.innerWidth < 820");
    expect(explorer).toContain('const DEFAULT_VIEW = "list"');
    expect(explorer).toContain('const DEFAULT_RANGE: RangeKey = "week"');
  });

  it("the list reuses EventDayCard so rows carry the UX3 save overlay", () => {
    expect(readFileSync(join(root, "components", "ListView.tsx"), "utf8")).toContain("EventDayCard");
  });
});

describe("soonestFirstThenRuns — one ordering for every card surface (6 Nov 2026)", () => {
  const W0 = "2026-07-13"; // the window opens here

  // Runs are category "arts", never "music": PER_NIGHT = {sports, music}, so
  // staleSpanIds deletes a music row carrying a multiDayEnd. A music run is a
  // shape production cannot produce.
  const run = (id: string, start: string, end: string) =>
    ev(id, start, { category: "arts", multiDayEnd: end });

  it("what starts in the window comes first; runs already underway come after", () => {
    const out = soonestFirstThenRuns(
      [
        run("long-run", "2026-05-23T10:00", "2027-01-10T17:00"),
        ev("wed", "2026-07-15T20:00"),
        run("short-run", "2026-07-01T10:00", "2026-07-20T17:00"),
        ev("mon", "2026-07-13T20:00"),
      ],
      W0,
    );
    expect(out.map((e) => e.id)).toEqual(["mon", "wed", "short-run", "long-run"]);
  });

  it("runs are ordered ending-soonest-first, so the one about to close leads them", () => {
    const out = soonestFirstThenRuns(
      [
        run("closes-later", "2026-05-01T10:00", "2027-01-10T17:00"),
        run("closes-sooner", "2026-05-01T10:00", "2026-07-20T17:00"),
      ],
      W0,
    );
    expect(out.map((e) => e.id)).toEqual(["closes-sooner", "closes-later"]);
  });

  it("a run that STARTS inside the window is a dated event, not a run-behind", () => {
    // It is news this week, so it sorts by its start like anything else.
    const out = soonestFirstThenRuns(
      [run("underway", "2026-07-01T10:00", "2026-08-30T17:00"), run("opens-tue", "2026-07-14T10:00", "2026-08-30T17:00")],
      W0,
    );
    expect(out.map((e) => e.id)).toEqual(["opens-tue", "underway"]);
  });

  it("drops nothing — every event comes back exactly once", () => {
    const input = [
      run("a", "2026-05-23T10:00", "2027-01-10T17:00"),
      ev("b", "2026-07-15T20:00"),
      ev("c", "2026-07-13T20:00"),
    ];
    const out = soonestFirstThenRuns(input, W0);
    expect(out).toHaveLength(3);
    expect([...out].map((e) => e.id).sort()).toEqual(["a", "b", "c"]);
  });

  it("an empty list yields an empty list", () => {
    expect(soonestFirstThenRuns([], W0)).toEqual([]);
  });
});

describe("soonestFirstThenRuns — the map list and the list view must agree (8 Nov 2026)", () => {
  const run = (id: string, start: string, end: string) =>
    ev(id, start, { category: "arts", multiDayEnd: end });

  it("an explicit todayKey keeps the split identical to planListView's", () => {
    // The map's month view opens on the 1st, which can be BEFORE today, and a
    // date-picked range can open after it. ListView is handed windowStartKey
    // and todayKey separately; the map list is handed the SAME array, so it
    // has to ask the same question or the two halves of one screen disagree.
    const windowStartKey = "2026-07-20";
    const todayKey = "2026-07-13";
    const mid = run("mid", "2026-07-15T10:00", "2026-07-25T17:00");

    const plan = planListView([mid], windowStartKey, todayKey, 10);
    expect(plan.ongoing).toEqual([]); // it has not started yet — it is dated
    expect(plan.days.flatMap((g) => g.events).map((e) => e.id)).toEqual(["mid"]);

    // Letting todayKey default to the window start answers a different
    // question — "was it underway when the window opened" — and calls the same
    // row already-running. That is the divergence the parameter exists to stop.
    expect(planListView([mid], windowStartKey, windowStartKey, 10).ongoing.map((e) => e.id)).toEqual(["mid"]);
  });

  it("soonestFirstThenRuns HONOURS an explicit todayKey — the two calls must differ", () => {
    // The first draft of this test compared two calls that a mutation would
    // have changed identically, so it pinned nothing. This one fails the moment
    // the parameter is ignored.
    const windowStartKey = "2026-07-20";
    const todayKey = "2026-07-13";
    const mid = run("mid", "2026-07-15T10:00", "2026-07-25T17:00");
    const later = ev("later", "2026-07-22T20:00");

    // With today's date: `mid` has not started yet, so it is a DATED row,
    // clamped to the window's first day and therefore ahead of the 22nd.
    expect(soonestFirstThenRuns([later, mid], windowStartKey, todayKey).map((e) => e.id)).toEqual(["mid", "later"]);

    // Letting it default asks "was it underway when the window opened", which
    // calls the same row already-running and pushes it behind.
    expect(soonestFirstThenRuns([later, mid], windowStartKey).map((e) => e.id)).toEqual(["later", "mid"]);
  });

  it("but the default is still identical when the window opens today", () => {
    const today = "2026-07-13";
    const events = [run("underway", "2026-07-01T10:00", "2026-07-30T17:00"), ev("tue", "2026-07-14T20:00")];
    expect(soonestFirstThenRuns(events, today).map((e) => e.id)).toEqual(
      soonestFirstThenRuns(events, today, today).map((e) => e.id),
    );
  });
});

describe("map list wiring — both halves of the screen get the same window", () => {
  const root = join(__dirname, "..", "..");

  it("MapEventList orders with the shared helper, not its own start sort", () => {
    const map = readFileSync(join(root, "components", "MapEventList.tsx"), "utf8");
    expect(map).toContain("soonestFirstThenRuns(events, windowStartKey, todayKey)");
    expect(map).not.toContain("sort((a, b) => a.start.localeCompare(b.start))");
  });

  it("the explorer hands ListView and MapEventList the same keys", () => {
    const explorer = readFileSync(join(root, "components", "EventsExplorer.tsx"), "utf8");
    const keys = explorer.match(/windowStartKey=\{dkey\(win\.start\)\}/g) ?? [];
    const todays = explorer.match(/todayKey=\{dkey\(now\)\}/g) ?? [];
    expect(keys.length).toBe(2); // ListView and MapEventList
    expect(todays.length).toBe(2);
  });
});
