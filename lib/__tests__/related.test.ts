import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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

  it("regression (R1.3): tonight's show stays in the strip all afternoon (walls to walls)", () => {
    // 3:30 PM CDT = 20:30Z. The old naive parse read the 7 PM wall as 7 PM UTC
    // (= 2 PM CT) and the strip rendered null from early afternoon onward.
    const afternoon = new Date("2026-07-20T20:30:00Z");
    const current = ev({ id: "me", venue: "First Avenue" });
    const tonight = ev({ id: "tonight", venue: "First Avenue", start: "2026-07-20T19:00" });
    const thisMorning = ev({ id: "gone", venue: "First Avenue", start: "2026-07-20T09:00" });
    const r = selectRelated([current, tonight, thisMorning], current, afternoon)!;
    expect(r.events.map((e) => e.id)).toEqual(["tonight"]); // in; the morning show is honestly past
  });

  it("regression (R1.3): winter frame uses the CST offset, not CDT", () => {
    const noonCST = new Date("2027-01-10T18:30:00Z"); // 12:30 PM CST
    const current = ev({ id: "me", venue: "First Avenue" });
    const at1pm = ev({ id: "in", venue: "First Avenue", start: "2027-01-10T13:00" });
    const at11am = ev({ id: "out", venue: "First Avenue", start: "2027-01-10T11:00" });
    const r = selectRelated([current, at1pm, at11am], current, noonCST)!;
    expect(r.events.map((e) => e.id)).toEqual(["in"]);
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

describe("selectRelated — a run already on at this venue (RULE 5, 9 Nov 2026)", () => {
  // "arts", not the helper's default "music": PER_NIGHT = {sports, music}, so
  // staleSpanIds deletes a music row carrying a multiDayEnd.
  const run = (id: string, start: string, end: string, over: Partial<EventRecord> = {}) =>
    ev({ id, category: "arts", venue: "First Avenue", start, multiDayEnd: end, ...over });

  it("a run underway at the same venue is IN the strip", () => {
    // It asked `e.start >= nowWall` and nothing else, so a run that opened
    // before today was absent here while the venue page this strip links to
    // listed it — that page has used the span-aware isUpcoming since 5 Nov.
    const current = ev({ id: "me", start: "2026-07-25T20:00" });
    const exhibition = run("exhibit", "2026-05-23T10:00", "2027-01-10T17:00");
    const r = selectRelated([current, exhibition], current, NOW)!;
    expect(r.kind).toBe("venue");
    expect(r.events.map((e) => e.id)).toEqual(["exhibit"]);
  });

  it("but it sorts BEHIND what is actually coming up", () => {
    // Admitting runs on a start sort would have led 129 of 679 event pages
    // with a months-old exhibition (measured on live data).
    const current = ev({ id: "me", start: "2026-08-30T20:00" });
    const r = selectRelated(
      [
        current,
        run("exhibit", "2026-05-23T10:00", "2027-01-10T17:00"),
        ev({ id: "friday", start: "2026-07-24T20:00" }),
        ev({ id: "tomorrow", start: "2026-07-21T20:00" }),
      ],
      current,
      NOW,
    )!;
    expect(r.events.map((e) => e.id)).toEqual(["tomorrow", "friday", "exhibit"]);
  });

  it("a run that has already CLOSED stays out", () => {
    const current = ev({ id: "me", start: "2026-07-25T20:00" });
    const closed = run("closed", "2026-05-01T10:00", "2026-07-10T17:00");
    expect(selectRelated([current, closed], current, NOW)).toBeNull();
  });

  it("R1.3 is UNCHANGED: this morning's show is still honestly past", () => {
    // The first cut of this fix swapped the whole predicate for isUpcoming,
    // which is DAY-granular — that would have brought the morning show back
    // until midnight. The run clause is ADDED to the wall-clock floor instead.
    const afternoon = new Date("2026-07-20T20:30:00Z"); // 3:30 PM CDT
    const current = ev({ id: "me" });
    const thisMorning = ev({ id: "gone", start: "2026-07-20T09:00" });
    const tonight = ev({ id: "tonight", start: "2026-07-20T19:00" });
    const r = selectRelated([current, thisMorning, tonight], current, afternoon)!;
    expect(r.events.map((e) => e.id)).toEqual(["tonight"]);
  });
});

describe("MoreAtVenue — a run states its span, not a stale clock (9 Nov 2026)", () => {
  // NORMALISED: a fresh Windows clone writes this file with CRLF (.gitattributes
  // is `* text=auto`, core.autocrlf=true here), and every .claude worktree already
  // holds it that way. An un-normalised multi-line toContain would pass in the
  // shared checkout and in Actions, and fail in a worktree — which is where this
  // project gates its review agents. lib/__tests__/no-horizontal-scroll.test.ts
  // already does exactly this.
  const src = readFileSync(join(__dirname, "..", "..", "components", "MoreAtVenue.tsx"), "utf8").replace(/\r\n/g, "\n");

  // These assert WIRING only — that the component defers to the shared rule and
  // drops the clock. The rule's BEHAVIOUR is tested in multiday.test.ts, because
  // a string match passes whatever beganBeforeToday actually does.
  it("defers to the shared beganBeforeToday rule rather than re-deriving it", () => {
    expect(src).toContain("const underway = beganBeforeToday(e, todayKey);");
  });

  it("an underway row shows the span and NO time", () => {
    // The row printed e.start's date and timeLabel(e) unconditionally, so an
    // exhibition read "Sat, May 23 · 10 AM" — a date months past and the first
    // day's clock, which lib/day-order.ts refuses to print.
    expect(src).toContain("? multiDayLabel(e)");
    expect(src).toContain("{!underway && <span className=\"more-at-time\">{timeLabel(e)}</span>}");
  });

  it("the date column fits the widest span on ONE left edge", () => {
    const css = readFileSync(join(__dirname, "..", "..", "app", "globals.css"), "utf8").replace(/\r\n/g, "\n");
    // 96px, not min-width: flex:none sizes to content above a floor, so min-width
    // left the one row with a span wider than its neighbours.
    expect(css).toContain(".more-at-date { flex: none; width: 96px;");
  });
});
