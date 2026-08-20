import { describe, it, expect } from "vitest";
import { splitDigestEvents, nextMondayKey, renderDigestEmail, digestWeekLabel } from "../digest";
import type { EventRecord } from "../types";

/**
 * The email was landing 8-for-8 weekend events. NOT a window bug — the window was
 * always the full 7 days. `scoreEvent` gives weekend events +2, so with 8 slots the
 * weekend filled every one before a midweek event was considered. Measured on a real
 * send: weekend was 45% of the 127 available events and 100% of the picks, while
 * THURSDAY had the most events of any day (33) and never appeared.
 */

const THU = new Date("2026-08-20T15:00:00Z"); // Thu Aug 20, 10am Central — a real send

let n = 0;
const ev = (startDay: string, over: Partial<EventRecord> = {}): EventRecord =>
  ({
    id: `e${++n}`,
    title: `Event ${n}`,
    category: "music",
    venue: `Venue ${n}`, // distinct: the 1-per-venue rule isn't what's under test
    address: "1 Main St",
    city: "Minneapolis",
    lat: 44.98, lng: -93.27,
    start: `${startDay}T19:00`,
    end: null,
    price: "$10", priceTier: "$",
    ticketUrl: "https://example.com/t",
    description: "A description long enough to score the description point.",
    image: null, sourceUrl: "https://example.com", status: "published",
    multiDayEnd: null, allDay: false,
    ...over,
  }) as EventRecord;

describe("nextMondayKey — the boundary between the two halves", () => {
  it("from a Thursday send, the coming Monday", () => {
    expect(nextMondayKey(THU)).toBe("2026-08-24");
  });
  it("from a Sunday, tomorrow", () => {
    expect(nextMondayKey(new Date("2026-08-23T15:00:00Z"))).toBe("2026-08-24");
  });
  it("from a Monday, the NEXT Monday — never today", () => {
    expect(nextMondayKey(new Date("2026-08-24T15:00:00Z"))).toBe("2026-08-31");
  });
});

describe("splitDigestEvents — midweek events can no longer be crowded out", () => {
  // A realistic week: lots of weekend, some midweek. Before the split, the 8 slots
  // went entirely to the weekend.
  const week = [
    ...Array.from({ length: 12 }, () => ev("2026-08-21")), // Fri
    ...Array.from({ length: 12 }, () => ev("2026-08-22")), // Sat
    ...Array.from({ length: 6 }, () => ev("2026-08-23")), // Sun
    ...Array.from({ length: 6 }, () => ev("2026-08-25")), // Tue
    ...Array.from({ length: 4 }, () => ev("2026-08-26")), // Wed
  ];

  it("reserves slots for next week instead of letting the weekend take all 8", () => {
    const { soon, later } = splitDigestEvents(week, THU);
    expect(soon.length + later.length).toBe(8);
    expect(later.length).toBe(3);
    expect(later.every((e) => e.start.slice(0, 10) >= "2026-08-24")).toBe(true);
    expect(soon.every((e) => e.start.slice(0, 10) < "2026-08-24")).toBe(true);
  });

  it("keeps the spread rules the single list had (max 2 per day)", () => {
    const { soon, later } = splitDigestEvents(week, THU);
    const perDay = new Map<string, number>();
    for (const e of [...soon, ...later]) {
      const d = e.start.slice(0, 10);
      perDay.set(d, (perDay.get(d) ?? 0) + 1);
    }
    for (const [day, count] of perDay) expect(count, day).toBeLessThanOrEqual(2);
  });

  it("both halves come out in date order", () => {
    const { soon, later } = splitDigestEvents(week, THU);
    for (const list of [soon, later]) {
      const days = list.map((e) => e.start.slice(0, 10));
      expect([...days].sort()).toEqual(days);
    }
  });

  it("HONEST DEGRADATION: a thin next week gives its slots back, not a short email", () => {
    const noMidweek = [
      ...Array.from({ length: 12 }, () => ev("2026-08-21")),
      ...Array.from({ length: 12 }, () => ev("2026-08-22")),
      ...Array.from({ length: 12 }, () => ev("2026-08-23")),
    ];
    const { soon, later } = splitDigestEvents(noMidweek, THU);
    expect(later).toEqual([]); // nothing to show → caller renders no section
    expect(soon.length).toBe(6); // 3 days x max 2/day — full email, no filler
  });

  it("an entirely empty week yields two empty halves, never invented filler", () => {
    const { soon, later } = splitDigestEvents([], THU);
    expect(soon).toEqual([]);
    expect(later).toEqual([]);
  });
});

describe("the rendered email", () => {
  const week = [
    ...Array.from({ length: 8 }, () => ev("2026-08-21")),
    ...Array.from({ length: 8 }, () => ev("2026-08-22")),
    ...Array.from({ length: 6 }, () => ev("2026-08-25")),
  ];
  const { soon, later } = splitDigestEvents(week, THU);
  const out = renderDigestEmail({
    events: soon, laterEvents: later,
    weekLabel: digestWeekLabel(THU),
    unsubscribeUrl: "https://x/u", siteUrl: "https://x",
  });

  it("carries both headings in HTML and text", () => {
    expect(out.html).toContain(">This weekend<");
    expect(out.html).toContain(">Next week<");
    expect(out.text).toContain("THIS WEEKEND");
    expect(out.text).toContain("NEXT WEEK");
  });

  it("the subject counts BOTH halves — the email carries them", () => {
    expect(out.subject).toContain(`+ ${soon.length + later.length - 1} more`);
  });

  it("no second section (and no orphan heading) when next week is empty", () => {
    const solo = renderDigestEmail({
      events: soon, laterEvents: [],
      weekLabel: digestWeekLabel(THU),
      unsubscribeUrl: "https://x/u", siteUrl: "https://x",
    });
    expect(solo.html).not.toContain(">Next week<");
    expect(solo.html).not.toContain(">This weekend<"); // one list ⇒ no headings at all
    expect(solo.text).not.toContain("NEXT WEEK");
  });
});
