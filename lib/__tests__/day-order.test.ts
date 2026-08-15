import { describe, it, expect } from "vitest";
import { orderDayEvents } from "../day-order";
import type { EventRecord } from "../types";

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
    expect(orderDayEvents([nine, seven, eight]).map((e) => e.title)).toEqual([
      "Seven PM",
      "Eight PM",
      "Nine PM",
    ]);
  });

  it("leads the timed group with all-day events (00:00 start)", () => {
    const allDay = ev({ title: "All Day", start: "2026-07-20T00:00", end: "2026-07-20T00:00", allDay: true });
    const seven = ev({ title: "Seven PM", start: "2026-07-20T19:00" });
    expect(orderDayEvents([seven, allDay]).map((e) => e.title)).toEqual(["All Day", "Seven PM"]);
  });

  it("puts multi-day spans first, then the timed events", () => {
    const fest = ev({ title: "State Fair", start: "2026-07-18T10:00", end: "2026-07-18T22:00", multiDayEnd: "2026-07-25T22:00" });
    const seven = ev({ title: "Seven PM Show", start: "2026-07-20T19:00" });
    expect(orderDayEvents([seven, fest]).map((e) => e.title)).toEqual(["State Fair", "Seven PM Show"]);
  });

  it("orders spans by title, NOT by their stale original start (the /day page bug)", () => {
    // Both span Jul 20. Under the old `order by start_at asc`, the earlier-starting
    // one would pin to the top; the shared rule sorts spans alphabetically instead.
    const early = ev({ title: "Zzz Fair", start: "2026-07-18T10:00", end: "2026-07-18T18:00", multiDayEnd: "2026-07-25T18:00" });
    const late = ev({ title: "Aaa Fair", start: "2026-07-19T10:00", end: "2026-07-19T18:00", multiDayEnd: "2026-07-24T18:00" });
    expect(orderDayEvents([early, late]).map((e) => e.title)).toEqual(["Aaa Fair", "Zzz Fair"]);
  });

  it("does not mutate the input array", () => {
    const input = [
      ev({ title: "B", start: "2026-07-20T21:00" }),
      ev({ title: "A", start: "2026-07-20T19:00" }),
    ];
    const before = input.map((e) => e.title);
    orderDayEvents(input);
    expect(input.map((e) => e.title)).toEqual(before);
  });

  it("returns empty for empty input", () => {
    expect(orderDayEvents([])).toEqual([]);
  });
});
