import { describe, it, expect } from "vitest";
import { selectRelated, RELATED_CAP } from "../related";
import { VENUE_INTROS, NEIGHBORHOOD_INTROS } from "../editorial";
import { VENUE_PAGES } from "../venue-pages";
import { NEIGHBORHOODS } from "../neighborhoods";
import type { EventRecord } from "../types";

const NOW = new Date("2026-07-20T17:00:00Z");

let seq = 0;
function ev(overrides: Partial<EventRecord> = {}): EventRecord {
  seq += 1;
  return {
    id: `e${seq}`,
    title: "Show", category: "music", venue: "First Avenue", address: "",
    city: "Minneapolis", lat: 44.9, lng: -93.2,
    start: "2026-07-25T20:00", end: "", price: "$20", priceTier: "$$",
    ticketUrl: "", description: "", image: "", sourceUrl: "",
    status: "published", multiDayEnd: null, allDay: false,
    neighborhood: null,
    ...overrides,
  };
}

describe("selectRelated — more at this venue", () => {
  it("finds upcoming events at the same venue THROUGH THE ALIAS MACHINERY, excludes self, soonest first, capped", () => {
    const current = ev({ id: "me", venue: "First Ave" }); // alias form
    const pool = [
      current,
      ev({ id: "entry", venue: "7th St Entry", start: "2026-07-22T20:00" }), // same slug!
      ev({ id: "late", venue: "First Avenue", start: "2026-08-10T20:00" }),
      ev({ id: "past", venue: "First Avenue", start: "2026-07-01T20:00" }), // past: out
      ev({ id: "elsewhere", venue: "Turf Club", start: "2026-07-23T20:00" }),
      ev({ id: "a", venue: "First Avenue", start: "2026-07-26T20:00" }),
      ev({ id: "b", venue: "First Avenue", start: "2026-07-28T20:00" }),
      ev({ id: "c", venue: "First Avenue", start: "2026-08-01T20:00" }),
    ];
    const r = selectRelated(pool, current, NOW)!;
    expect(r.kind).toBe("venue");
    expect(r.key).toBe("first-avenue");
    expect(r.events).toHaveLength(RELATED_CAP);
    expect(r.events.map((e) => e.id)).toEqual(["entry", "a", "b", "c"]); // soonest 4; "late" (Aug 10) misses the cap
  });

  it("venue with nothing else upcoming → falls back to the neighborhood", () => {
    const current = ev({ id: "me", venue: "Icehouse", neighborhood: "whittier-eat-street" });
    const pool = [
      current,
      ev({ id: "nearby", venue: "Somewhere on Nicollet", neighborhood: "whittier-eat-street", start: "2026-07-24T19:00" }),
      ev({ id: "far", venue: "Turf Club", neighborhood: "midway-hamline" }),
    ];
    const r = selectRelated(pool, current, NOW)!;
    expect(r.kind).toBe("neighborhood");
    expect(r.key).toBe("whittier-eat-street");
    expect(r.events.map((e) => e.id)).toEqual(["nearby"]);
  });

  it("unknown venue + no neighborhood → null (honest emptiness)", () => {
    const current = ev({ id: "me", venue: "Somebody's Garage" });
    expect(selectRelated([current], current, NOW)).toBeNull();
  });

  it("drafts never appear", () => {
    const current = ev({ id: "me" });
    const pool = [current, ev({ venue: "First Avenue", status: "draft", start: "2026-07-22T20:00" })];
    expect(selectRelated(pool, current, NOW)).toBeNull();
  });
});

describe("editorial intros — the drift guard", () => {
  const venueSlugs = new Set(VENUE_PAGES.map((v) => v.slug));
  const nbhdKeys = new Set(NEIGHBORHOODS.map((n) => n.key));

  it("every venue intro keys to a REAL venue-page slug", () => {
    for (const slug of Object.keys(VENUE_INTROS)) {
      expect(venueSlugs.has(slug), `VENUE_INTROS["${slug}"] has no venue page`).toBe(true);
    }
  });

  it("ALL 16 neighborhoods have an intro, and no intro points at a ghost", () => {
    for (const key of Object.keys(NEIGHBORHOOD_INTROS)) {
      expect(nbhdKeys.has(key), `NEIGHBORHOOD_INTROS["${key}"] has no district`).toBe(true);
    }
    for (const n of NEIGHBORHOODS) {
      expect(NEIGHBORHOOD_INTROS[n.key], `${n.key} is missing its intro`).toBeTruthy();
    }
  });

  it("intros are paragraph-sized: no stubs, no essays", () => {
    for (const [k, text] of [...Object.entries(VENUE_INTROS), ...Object.entries(NEIGHBORHOOD_INTROS)]) {
      expect(text.length, `${k} too short`).toBeGreaterThan(80);
      expect(text.length, `${k} too long`).toBeLessThan(520);
    }
  });
});
