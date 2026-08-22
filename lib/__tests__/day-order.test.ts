import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { orderDayEvents, splitDayEvents, dayTimeLabel } from "../day-order";
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

describe("dayTimeLabel — never show a clock time we can't stand behind", () => {
  /**
   * An event that began earlier stores the FIRST day's time, so a run that opened
   * Aug 13 at 10 AM rendered "10 AM" on Aug 21 — a real-looking number that simply
   * isn't today's. Grouping fixed the ORDER; this fixes the number.
   */
  it("an event that began earlier shows how long it runs, not a stale time", () => {
    const run = ev({
      title: "Opened Last Week",
      start: "2026-07-13T10:00",
      end: "2026-07-13T17:00",
      multiDayEnd: "2026-07-23T17:00",
    });
    expect(dayTimeLabel(run, DAY)).toBe("Through Jul 23");
    expect(dayTimeLabel(run, DAY)).not.toContain("10");  // no stale clock time
    expect(dayTimeLabel(run, DAY)).not.toMatch(/AM|PM/);
  });

  it('says "Last day" when the run ends on the day you are viewing', () => {
    const closing = ev({
      title: "Closing Today",
      start: "2026-07-18T10:00",
      end: "2026-07-18T17:00",
      multiDayEnd: "2026-07-20T17:00",
    });
    expect(dayTimeLabel(closing, DAY)).toBe("Last day");
  });

  it("crosses a month boundary correctly", () => {
    const run = ev({
      title: "Into August",
      start: "2026-07-18T10:00",
      end: "2026-07-18T17:00",
      multiDayEnd: "2026-08-02T17:00",
    });
    expect(dayTimeLabel(run, DAY)).toBe("Through Aug 2");
  });

  it("KEEPS the real start time for something opening today, even if it runs on", () => {
    // The whole point: a play opening tonight at 8 PM that runs through Wednesday
    // should say 8 PM. That it also runs later is on the event page.
    const opening = ev({ title: "Opens Tonight", start: "2026-07-20T20:00", end: "2026-07-22T22:00" });
    expect(dayTimeLabel(opening, DAY)).toBe("8 PM");
  });

  it("a normal single-day event is unaffected", () => {
    expect(dayTimeLabel(ev({ title: "Just Today", start: "2026-07-20T19:00" }), DAY)).toBe("7 PM");
  });

  it("an all-day event today still reads All day", () => {
    const allDay = ev({ title: "All Day", start: "2026-07-20T00:00", allDay: true });
    expect(dayTimeLabel(allDay, DAY)).toBe("All day");
  });

  it("degrades to a plain word when there is no usable end date", () => {
    // Began earlier, no span end recorded — we know it's running, nothing more.
    // end: null is the real "no usable end" case — the fixture default end
    // (2026-07-20T21:00) would correctly make this a LAST DAY instead.
    const vague = ev({ title: "No End", start: "2026-07-18T10:00", end: undefined });
    expect(dayTimeLabel(vague, DAY)).toBe("Ongoing");
  });

  it("both day surfaces use it", () => {
    const panel = readFileSync(join(__dirname, "..", "..", "components", "DayPanel.tsx"), "utf8");
    expect(panel).toContain("dayTimeLabel");
    const card = readFileSync(join(__dirname, "..", "..", "components", "EventDayCard.tsx"), "utf8");
    expect(card).toContain("dayTimeLabel");
    const page = readFileSync(join(__dirname, "..", "..", "app", "day", "[date]", "page.tsx"), "utf8");
    expect(page).toContain("dayKey={date}");
  });

  it("cards OUTSIDE a day view are untouched (no dayKey ⇒ old span badge)", () => {
    // this-week / saved / collections have no single day in view.
    const card = readFileSync(join(__dirname, "..", "..", "components", "EventDayCard.tsx"), "utf8");
    expect(card).toContain("dayKey?: string");
    expect(card).toContain("isMultiDay(event)"); // the fallback path survives
  });
});
