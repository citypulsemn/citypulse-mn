import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  decayFactor,
  scoreRows,
  rankTrending,
  TREND_MIN_SCORE,
  TREND_MIN_LIST,
  TREND_CAP,
  TREND_HALF_LIFE_DAYS,
  type StatRow,
  type ScoredEvent,
} from "../trending";
import type { EventRecord } from "../types";
import { isEnded } from "../event-view";

const TODAY = "2026-07-15";

function ev(overrides: Partial<EventRecord> = {}): EventRecord {
  return {
    id: Math.random().toString(36).slice(2),
    title: "Show", category: "music", venue: "First Avenue", address: "",
    city: "Minneapolis", lat: 44.9, lng: -93.2,
    start: "2026-07-18T19:00", end: "", price: "$20", priceTier: "$$",
    ticketUrl: "", description: "", image: "", sourceUrl: "",
    status: "published", multiDayEnd: null, allDay: false,
    ...overrides,
  };
}

describe("decayFactor — momentum, not lifetime totals", () => {
  it("is 1 today, half at the half-life, a quarter at two half-lives", () => {
    expect(decayFactor(0)).toBe(1);
    expect(decayFactor(TREND_HALF_LIFE_DAYS)).toBeCloseTo(0.5, 5);
    expect(decayFactor(TREND_HALF_LIFE_DAYS * 2)).toBeCloseTo(0.25, 5);
  });

  it("never boosts future/negative ages", () => {
    expect(decayFactor(-2)).toBe(1);
  });
});

describe("scoreRows — the intent ladder", () => {
  it("a ticket click outweighs several views", () => {
    const clicks: StatRow[] = [{ day: TODAY, action: "ticket_click", count: 1 }];
    const views: StatRow[] = [{ day: TODAY, action: "view", count: 4 }];
    expect(scoreRows(clicks, TODAY)).toBeGreaterThan(scoreRows(views, TODAY));
  });

  it("yesterday's engagement beats the same engagement five days ago", () => {
    const recent: StatRow[] = [{ day: "2026-07-14", action: "view", count: 10 }];
    const stale: StatRow[] = [{ day: "2026-07-10", action: "view", count: 10 }];
    expect(scoreRows(recent, TODAY)).toBeGreaterThan(scoreRows(stale, TODAY));
  });

  it("computes the ladder exactly: one ticket click (5) + three views (3) = 8", () => {
    const rows: StatRow[] = [
      { day: TODAY, action: "ticket_click", count: 1 },
      { day: TODAY, action: "view", count: 3 },
    ];
    expect(scoreRows(rows, TODAY)).toBe(8);
  });

  it("one ticket click alone clears the recalibrated floor (F1.2: MIN_SCORE 5)", () => {
    expect(scoreRows([{ day: TODAY, action: "ticket_click", count: 1 }], TODAY)).toBe(5);
    expect(5).toBeGreaterThanOrEqual(TREND_MIN_SCORE);
  });

  it("no rows → zero", () => {
    expect(scoreRows([], TODAY)).toBe(0);
  });
});

describe("rankTrending — the cold-start honesty policy", () => {
  const scored = (score: number, start = "2026-07-18T19:00"): ScoredEvent => ({
    event: ev({ start }),
    score,
  });

  it("ALL-OR-NOTHING boundary: one short of MIN_LIST is dark; exactly MIN_LIST renders", () => {
    const strong = TREND_MIN_SCORE + 10;
    // One short of the minimum cluster is noise wearing a crown, not a trend.
    const justUnder = Array.from({ length: TREND_MIN_LIST - 1 }, () => scored(strong));
    expect(rankTrending(justUnder)).toEqual([]);
    // Exactly MIN_LIST qualifiers is the moment it earns its place.
    const justEnough = Array.from({ length: TREND_MIN_LIST }, () => scored(strong));
    expect(rankTrending(justEnough)).toHaveLength(TREND_MIN_LIST);
    // A sub-floor event never counts toward the minimum.
    const padded = [...justEnough.slice(0, TREND_MIN_LIST - 1), scored(TREND_MIN_SCORE - 1)];
    expect(rankTrending(padded)).toEqual([]);
  });

  it("the recalibrated cluster size stays a real minimum (≥ 3)", () => {
    expect(TREND_MIN_LIST).toBeGreaterThanOrEqual(3);
  });

  it("the floor drops low-signal events even in a big list", () => {
    const list = [scored(30), scored(20), scored(12), scored(9), scored(TREND_MIN_SCORE - 1)];
    const out = rankTrending(list);
    expect(out).toHaveLength(4);
    expect(out.every((c) => c.score >= TREND_MIN_SCORE)).toBe(true);
  });

  it("sorts by score, breaking ties toward the sooner event", () => {
    const soon = scored(10, "2026-07-16T19:00");
    const later = scored(10, "2026-07-20T19:00");
    const top = scored(50);
    const fourth = scored(9);
    const out = rankTrending([later, soon, top, fourth]);
    expect(out[0].score).toBe(50);
    expect(out[1].event.start).toBe("2026-07-16T19:00");
    expect(out[2].event.start).toBe("2026-07-20T19:00");
  });

  it("caps the list", () => {
    const many = Array.from({ length: 30 }, (_, i) => scored(100 - i));
    expect(rankTrending(many)).toHaveLength(TREND_CAP);
  });
});

// ---------------------------------------------------------------------------
// The eligibility predicate inside getTrendingEvents (10 Nov 2026)
//
// getTrendingEvents needs a DB, so the SQL cannot be executed here. What CAN be
// pinned is the claim the SQL makes: that "still attendable" means what isEnded
// means. isEnded is pure, so the two December rows that exposed the difference
// are a golden test, and the source assertion keeps the SQL saying it.
// ---------------------------------------------------------------------------

/** The two live rows where coalesce(multi_day_end, end_at, start_at) and
 *  greatest(start_at, end_at, multi_day_end) disagree, as stored on 10 Nov 2026.
 *  Category "arts": PER_NIGHT covers music and sports, so staleSpanIds would
 *  strip multiDayEnd off a music row and this shape could not exist there. */
const JULMARKNAD = ev({
  title: "Julmarknad Handcraft Market & Festival",
  venue: "American Swedish Institute",
  category: "arts",
  start: "2026-12-04T17:00",
  end: "2026-12-06T17:00",
  multiDayEnd: "2026-12-05T23:59",
});

const MUSIC_MAN = ev({
  title: "The Music Man",
  venue: "Ordway Music Theater",
  category: "arts",
  start: "2026-12-08T19:30",
  end: "2026-12-25T21:30",
  multiDayEnd: "2026-12-09T23:59",
});

/** What the predicate the fix REPLACED would have computed. */
function coalesceEnd(e: EventRecord): string {
  return e.multiDayEnd || e.end || e.start;
}

describe("still attendable is isEnded's question, not multi_day_end's (10 Nov 2026)", () => {
  it("keeps a run alive past a multi_day_end that is not the latest of the three", () => {
    // 10 Dec: Music Man's multi_day_end has passed, its end_at has not.
    const dec10 = new Date("2026-12-10T12:00:00-06:00");
    expect(isEnded(MUSIC_MAN, dec10)).toBe(false);
    expect(coalesceEnd(MUSIC_MAN) < "2026-12-10T12:00").toBe(true);
  });

  it("is a sixteen-day difference on that row, not a rounding one", () => {
    const old = coalesceEnd(MUSIC_MAN).slice(0, 10);
    const now = [MUSIC_MAN.start, MUSIC_MAN.end, MUSIC_MAN.multiDayEnd ?? ""]
      .reduce((a, b) => (b > a ? b : a))
      .slice(0, 10);
    expect(old).toBe("2026-12-09");
    expect(now).toBe("2026-12-25");
  });

  it("keeps the festival's closing Sunday, which multi_day_end cuts off", () => {
    const dec6 = new Date("2026-12-06T12:00:00-06:00");
    expect(isEnded(JULMARKNAD, dec6)).toBe(false);
    expect(coalesceEnd(JULMARKNAD) < "2026-12-06T12:00").toBe(true);
  });

  it("drops a row only once ALL THREE stamps are behind us", () => {
    const dec26 = new Date("2026-12-26T12:00:00-06:00");
    expect(isEnded(MUSIC_MAN, dec26)).toBe(true);
  });

  it("is identical to coalesce whenever multi_day_end IS the latest", () => {
    // The ordinary shape: a run whose multi_day_end is the true span end.
    const ordinary = ev({
      category: "arts",
      start: "2026-12-08T19:30",
      end: "2026-12-08T21:30",
      multiDayEnd: "2026-12-20T23:59",
    });
    const latest = [ordinary.start, ordinary.end, ordinary.multiDayEnd ?? ""].reduce((a, b) =>
      b > a ? b : a,
    );
    expect(coalesceEnd(ordinary)).toBe(latest);
  });
});

describe("the trending query asks that question in SQL", () => {
  const src = readFileSync(join(__dirname, "..", "trending.ts"), "utf8").replace(/\r\n/g, "\n");
  // Scoped to the SQL LITERAL, not the function: the comment above it names the
  // rejected coalesce form in order to reject it, and a whole-function slice
  // would match that prose and fail on its own explanation.
  const fn = src.slice(
    src.indexOf("export async function getTrendingEvents"),
    src.indexOf("if (statRows.length === 0)"),
  );
  const query = fn.slice(fn.indexOf("select s.event_id"));

  it("selects on the latest of the three stamps", () => {
    expect(query).toContain("greatest(e.start_at, e.end_at, e.multi_day_end) >= now()");
  });

  it("does not prefer multi_day_end over a later end_at", () => {
    expect(query).not.toContain("coalesce(e.multi_day_end");
  });

  it("the slice is really the query, so the two assertions above mean something", () => {
    expect(query.length).toBeGreaterThan(100);
    expect(query).toContain("from event_stats s");
  });
});
