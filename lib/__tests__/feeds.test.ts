import { describe, it, expect } from "vitest";
import {
  resolveFeed,
  selectFeedEvents,
  allFeedSlugs,
  categoryFeedSlug,
  FEED_WINDOW_DAYS,
} from "../feeds";
import { feedICS, eventToICS } from "../ics";
import { CATEGORY_KEYS } from "../categories";
import { COLLECTIONS } from "../collections";
import { VENUE_PAGES } from "../venue-pages";
import { NEIGHBORHOODS } from "../neighborhoods";
import type { EventRecord } from "../types";

// A Monday morning, Chicago time. Weekend = Jul 24–26.
const NOW = new Date("2026-07-20T15:00:00Z");

function ev(overrides: Partial<EventRecord> = {}): EventRecord {
  return {
    id: Math.random().toString(36).slice(2),
    title: "Event",
    category: "music",
    venue: "First Avenue",
    address: "701 1st Ave N",
    city: "Minneapolis",
    lat: 44.9812,
    lng: -93.2761,
    start: "2026-07-25T20:00",
    end: "",
    price: "$20",
    priceTier: "$$",
    ticketUrl: "",
    description: "",
    image: "",
    sourceUrl: "",
    status: "published",
    multiDayEnd: null,
    ...overrides,
  };
}

describe("resolveFeed — the slug namespace", () => {
  it("drift guard: every advertised slug resolves, and no two collide", () => {
    const slugs = allFeedSlugs();
    expect(new Set(slugs).size).toBe(slugs.length); // no collisions
    for (const slug of slugs) {
      expect(resolveFeed(slug), `slug "${slug}" must resolve`).not.toBeNull();
    }
  });

  it("covers every registry completely", () => {
    const slugs = new Set(allFeedSlugs());
    expect(slugs.has("this-weekend")).toBe(true);
    for (const k of CATEGORY_KEYS) expect(slugs.has(categoryFeedSlug(k))).toBe(true);
    for (const c of COLLECTIONS) expect(slugs.has(c.slug)).toBe(true);
    for (const v of VENUE_PAGES) expect(slugs.has(`venue-${v.slug}`)).toBe(true);
    for (const n of NEIGHBORHOODS) expect(slugs.has(n.key)).toBe(true);
  });

  it("brands 'weird' as 'unique' — the raw key is not a public slug", () => {
    expect(resolveFeed("unique")?.key).toBe("weird");
    expect(resolveFeed("weird")).toBeNull();
  });

  it("unknown slugs are null (route 404s)", () => {
    expect(resolveFeed("polka")).toBeNull();
    expect(resolveFeed("venue-nonexistent-hall")).toBeNull();
    expect(resolveFeed("")).toBeNull();
  });

  it("names carry the brand for the calendar app's subscription list", () => {
    expect(resolveFeed("live-music")?.name).toContain("City Pulse");
    expect(resolveFeed("venue-first-avenue")?.name).toContain("First Avenue");
  });
});

describe("selectFeedEvents — rolling window, true spans", () => {
  const feed = resolveFeed("music")!;

  it("includes today and the window edge; excludes beyond it", () => {
    const inside = ev({ id: "in", start: "2026-07-20T19:00" });
    const edge = ev({ id: "edge", start: "2026-08-19T19:00" });
    const beyond = ev({ id: "out", start: "2026-09-05T19:00" });
    const picked = selectFeedEvents([inside, edge, beyond], feed, NOW);
    expect(picked.map((e) => e.id)).toEqual(["in", "edge"]);
  });

  it("true spans (rule 5): an ongoing multi-day run mid-span is IN; one that ended yesterday is OUT", () => {
    const running = ev({ id: "run", category: "festival", start: "2026-07-01T10:00", multiDayEnd: "2026-08-30T23:59" });
    const over = ev({ id: "over", category: "festival", start: "2026-07-01T10:00", multiDayEnd: "2026-07-19T23:59" });
    const picked = selectFeedEvents([running, over], resolveFeed("festival")!, NOW);
    expect(picked.map((e) => e.id)).toEqual(["run"]);
  });

  it("filters by kind: category, venue (alias match), neighborhood (geo)", () => {
    const music = ev({ id: "m" });
    const sports = ev({ id: "s", category: "sports" });
    expect(selectFeedEvents([music, sports], resolveFeed("music")!, NOW).map((e) => e.id)).toEqual(["m"]);

    const atFirstAve = ev({ id: "fa", venue: "First Avenue (Mainroom)" });
    const elsewhere = ev({ id: "el", venue: "Cedar Cultural Center", lat: 44.9689, lng: -93.2472 });
    expect(
      selectFeedEvents([atFirstAve, elsewhere], resolveFeed("venue-first-avenue")!, NOW).map((e) => e.id),
    ).toEqual(["fa"]);

    // Nearest-neighborhood geo rule: First Avenue's coords resolve to North
    // Loop (closer center, within radius), not Downtown — assert the actual rule.
    expect(
      selectFeedEvents([atFirstAve, ev({ id: "far", lat: 45.2, lng: -93.0 })], resolveFeed("north-loop")!, NOW).map(
        (e) => e.id,
      ),
    ).toEqual(["fa"]);
  });

  it("collection feeds apply the collection's filters with the FEED's window", () => {
    const freebie = ev({ id: "free", price: "Free", priceTier: "Free", start: "2026-08-10T18:00" });
    const paid = ev({ id: "paid", start: "2026-08-10T18:00" });
    const picked = selectFeedEvents([freebie, paid], resolveFeed("free-this-week")!, NOW);
    // 2026-08-10 is outside the collection's own 7-day page window but inside
    // the feed's 30-day window — feeds are subscriptions, not snapshots.
    expect(picked.map((e) => e.id)).toEqual(["free"]);
  });

  it("this-weekend uses the weekend's days, span-aware", () => {
    const saturday = ev({ id: "sat", start: "2026-07-25T20:00" });
    const monday = ev({ id: "mon", start: "2026-07-27T20:00" });
    const spanning = ev({ id: "span", category: "festival", start: "2026-07-10T10:00", multiDayEnd: "2026-08-02T23:59" });
    const picked = selectFeedEvents([saturday, monday, spanning], resolveFeed("this-weekend")!, NOW);
    expect(picked.map((e) => e.id).sort()).toEqual(["sat", "span"]);
  });

  it("honest emptiness: drafts/archived excluded; nothing matching → empty feed, not a fake one", () => {
    const draft = ev({ id: "d", status: "draft" });
    const archived = ev({ id: "a", status: "archived" });
    expect(selectFeedEvents([draft, archived], feed, NOW)).toEqual([]);
    expect(selectFeedEvents([], feed, NOW)).toEqual([]);
  });

  it("sorted by start ascending", () => {
    const late = ev({ id: "late", start: "2026-08-01T20:00" });
    const early = ev({ id: "early", start: "2026-07-21T20:00" });
    expect(selectFeedEvents([late, early], feed, NOW).map((e) => e.id)).toEqual(["early", "late"]);
  });

  it("window constant is what the docs advertise", () => {
    expect(FEED_WINDOW_DAYS).toBe(30);
  });
});

describe("feedICS — the calendar envelope", () => {
  const NOW_STAMP = new Date("2026-07-20T15:00:00Z");
  const events = [
    ev({ id: "one", title: "Show One" }),
    ev({ id: "two", title: "All-Day Fair; with, chars", allDay: true, start: "2026-07-26T00:00", multiDayEnd: "2026-07-28T23:59" }),
  ];

  it("one VCALENDAR wrapping N VEVENTs, named, CRLF-terminated", () => {
    const ics = feedICS("Live Music — City Pulse MN", events, { now: NOW_STAMP, baseUrl: "https://www.citypulsemn.com" });
    expect(ics.match(/BEGIN:VCALENDAR/g)).toHaveLength(1);
    expect(ics.match(/END:VCALENDAR/g)).toHaveLength(1);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics.match(/END:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain("X-WR-CALNAME:Live Music — City Pulse MN");
    expect(ics).toContain("X-WR-TIMEZONE:America/Chicago");
    expect(ics.endsWith("\r\n")).toBe(true);
    expect(ics.includes("\n") && !ics.includes("\r\n\r\n\r\n")).toBe(true);
  });

  it("all-day events keep VALUE=DATE handling inside the feed (DTEND exclusive)", () => {
    const ics = feedICS("Feed", events, { now: NOW_STAMP });
    expect(ics).toContain("DTSTART;VALUE=DATE:20260726");
    expect(ics).toContain("DTEND;VALUE=DATE:20260729");
  });

  it("every content line folds to ≤75 octets-ish (RFC 5545 folding)", () => {
    const long = ev({ id: "long", title: "T".repeat(200) });
    const ics = feedICS("Feed", [long], { now: NOW_STAMP });
    for (const line of ics.split("\r\n")) {
      expect(line.length).toBeLessThanOrEqual(76); // 75 + leading fold space
    }
  });

  it("refactor guard: single-event eventToICS still emits its own complete VCALENDAR", () => {
    const single = eventToICS(events[0], { now: NOW_STAMP, baseUrl: "https://www.citypulsemn.com" });
    expect(single.match(/BEGIN:VCALENDAR/g)).toHaveLength(1);
    expect(single).toContain("PRODID:-//City Pulse MN//Events//EN");
    expect(single).not.toContain("X-WR-CALNAME");
  });
});
