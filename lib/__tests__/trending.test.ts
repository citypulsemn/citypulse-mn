import { describe, it, expect } from "vitest";
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

  it("computes the documented example: one click + three views today ≈ 8", () => {
    const rows: StatRow[] = [
      { day: TODAY, action: "ticket_click", count: 1 },
      { day: TODAY, action: "view", count: 3 },
    ];
    expect(scoreRows(rows, TODAY)).toBe(8);
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

  it("ALL-OR-NOTHING: fewer than MIN_LIST qualifiers renders nothing", () => {
    // Three events clear the floor — that's noise wearing a crown, not a trend.
    const few = [scored(20), scored(15), scored(12), scored(2)];
    expect(rankTrending(few)).toEqual([]);
    expect(TREND_MIN_LIST).toBeGreaterThan(3);
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
