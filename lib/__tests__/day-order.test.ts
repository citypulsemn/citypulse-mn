import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { orderDayEvents, splitDayEvents } from "../day-order";
import type { EventRecord } from "../types";

const DAY = "2026-07-20";

function ev(o: Partial<EventRecord> & { title: string }): EventRecord {
  return {
    id: o.title,
    category: "music",
    venue: "V",
    address: "",
    city: "Minneapolis",
    lat: 44.98,
    lng: -93.27,
    start: "2026-07-20T19:00",
    end: "2026-07-20T21:00",
    price: "Free",
    priceTier: "Free",
    ticketUrl: "",
    description: "",
    image: "",
    sourceUrl: "",
    status: "published",
    ...o,
  };
}

describe("orderDayEvents — one within-a-day order shared by /day and DayPanel (U2)", () => {
  it("sorts single-day timed events chronologically by start time", () => {
    const nine = ev({ title: "Nine PM", start: "2026-07-20T21:00", end: "2026-07-20T22:30" });
    const seven = ev({ title: "Seven PM", start: "2026-07-20T19:00", end: "2026-07-20T20:00" });
    const eight = ev({ title: "Eight PM", start: "2026-07-20T20:00", end: "2026-07-20T21:00" });
    expect(orderDayEvents([nine, seven, eight], DAY).map((e) => e.title)).toEqual([
      "Seven PM",
      "Eight PM",
      "Nine PM",
    ]);
  });

  it("leads the timed group with all-day events (00:00 start)", () => {
    const allDay = ev({ title: "All Day", start: "2026-07-20T00:00", end: "2026-07-20T00:00", allDay: true });
    const seven = ev({ title: "Seven PM", start: "2026-07-20T19:00" });
    expect(orderDayEvents([seven, allDay], DAY).map((e) => e.title)).toEqual(["All Day", "Seven PM"]);
  });

  it("puts multi-day spans first, then the timed events", () => {
    const fest = ev({ title: "State Fair", start: "2026-07-18T10:00", end: "2026-07-18T22:00", multiDayEnd: "2026-07-25T22:00" });
    const seven = ev({ title: "Seven PM Show", start: "2026-07-20T19:00" });
    expect(orderDayEvents([seven, fest], DAY).map((e) => e.title)).toEqual(["State Fair", "Seven PM Show"]);
  });

  it("orders spans by title, NOT by their stale original start (the /day page bug)", () => {
    // Both span Jul 20. Under the old `order by start_at asc`, the earlier-starting
    // one would pin to the top; the shared rule sorts spans alphabetically instead.
    const early = ev({ title: "Zzz Fair", start: "2026-07-18T10:00", end: "2026-07-18T18:00", multiDayEnd: "2026-07-25T18:00" });
    const late = ev({ title: "Aaa Fair", start: "2026-07-19T10:00", end: "2026-07-19T18:00", multiDayEnd: "2026-07-24T18:00" });
    expect(orderDayEvents([early, late], DAY).map((e) => e.title)).toEqual(["Aaa Fair", "Zzz Fair"]);
  });

  it("does not mutate the input array", () => {
    const input = [
      ev({ title: "B", start: "2026-07-20T21:00" }),
      ev({ title: "A", start: "2026-07-20T19:00" }),
    ];
    const before = input.map((e) => e.title);
    orderDayEvents(input, DAY);
    expect(input.map((e) => e.title)).toEqual(before);
  });

  it("returns empty for empty input", () => {
    expect(orderDayEvents([], DAY)).toEqual([]);
  });
});

describe("a run that OPENS today keeps its showtime (the Aug 2026 regression)", () => {
  /**
   * The old rule split on "does this span multiple days?" — so a play opening
   * tonight at 8 PM and running through Sunday was filed with the ongoing
   * festivals and sorted ALPHABETICALLY, while the card displayed "8 PM". The
   * panel showed a time and then refused to sort by it. Measured on Aug 21:
   * 11 events were grouped that way and 6 of them started that very day.
   */
  const opensTonight = ev({
    title: "Zzz Opening Night", // last alphabetically, so ordering is unambiguous
    start: "2026-07-20T20:00",
    end: "2026-07-22T22:00", // runs three days
  });
  const earlyShow = ev({ title: "Aaa Matinee", start: "2026-07-20T10:00" });
  const ongoing = ev({
    title: "Mmm Ongoing Festival",
    start: "2026-07-18T10:00",
    end: "2026-07-18T18:00",
    multiDayEnd: "2026-07-25T18:00",
  });

  it("sorts a same-day opening by its clock time, not its title", () => {
    const order = orderDayEvents([opensTonight, earlyShow], DAY).map((e) => e.title);
    expect(order).toEqual(["Aaa Matinee", "Zzz Opening Night"]); // 10 AM before 8 PM
  });

  it("still protects the genuinely-ongoing from a stale start time", () => {
    const { ongoing: on, timed } = splitDayEvents([opensTonight, earlyShow, ongoing], DAY);
    expect(on.map((e) => e.title)).toEqual(["Mmm Ongoing Festival"]);
    expect(timed.map((e) => e.title)).toEqual(["Aaa Matinee", "Zzz Opening Night"]);
  });

  it("ongoing lead the flat order, then today's events by the clock", () => {
    expect(orderDayEvents([opensTonight, ongoing, earlyShow], DAY).map((e) => e.title)).toEqual([
      "Mmm Ongoing Festival",
      "Aaa Matinee",
      "Zzz Opening Night",
    ]);
  });

  it("splits on the DAY, never on a Date parse (frame-pure string compare)", () => {
    // A 00:00 start on the day itself is today's all-day event, not ongoing.
    const allDayToday = ev({ title: "Today All Day", start: "2026-07-20T00:00", allDay: true });
    const { ongoing: on, timed } = splitDayEvents([allDayToday], DAY);
    expect(on).toEqual([]);
    expect(timed.map((e) => e.title)).toEqual(["Today All Day"]);
  });

  it("both surfaces render the group heading, so the order explains itself", () => {
    const page = readFileSync(join(__dirname, "..", "..", "app", "day", "[date]", "page.tsx"), "utf8");
    expect(page).toContain("splitDayEvents");
    expect(page).toContain("Already running");
    expect(page).toContain("Starting today");

    // The homepage day panel is the surface the regression was reported from —
    // it must group and label identically, from the same shared split.
    const panel = readFileSync(join(__dirname, "..", "..", "components", "DayPanel.tsx"), "utf8");
    expect(panel).toContain("splitDayEvents");
    expect(panel).toContain("Already running");
    expect(panel).toContain("Starting today");
  });
});
