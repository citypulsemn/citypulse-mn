import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { groupEventsByDay } from "../list-view";
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

  it("the view type includes 'list' and there's a List toggle button", () => {
    expect(explorer).toContain('"list" | "calendar" | "map"');
    expect(explorer).toContain('onClick={() => setView("list")}');
  });

  it("the list renders the WINDOWED events (what the presets drive), not the whole month", () => {
    expect(explorer).toContain("<ListView events={windowedEvents} windowStartKey={dkey(win.start)} />");
  });

  it("mobile viewers default to the list, opening on 'this week' (calendar hides titles < 820px)", () => {
    expect(explorer).toContain("window.innerWidth < 820");
    expect(explorer).toContain('setView("list")');
    expect(explorer).toContain('setRange("week")');
  });

  it("the list reuses EventDayCard so rows carry the UX3 save overlay", () => {
    expect(readFileSync(join(root, "components", "ListView.tsx"), "utf8")).toContain("EventDayCard");
  });
});
