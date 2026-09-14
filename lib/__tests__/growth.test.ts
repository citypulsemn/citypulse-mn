import { describe, it, expect } from "vitest";
import {
  weekStartOf,
  weeklyCohorts,
  churnRate,
  trend,
  buildFunnel,
  returningReaders,
  pct,
  delta,
} from "../growth";

const NOW = new Date("2026-09-14T12:00:00Z"); // a Monday

describe("weekStartOf", () => {
  it("snaps to the Monday of that week", () => {
    expect(weekStartOf(new Date("2026-09-14T12:00:00Z"))).toBe("2026-09-14"); // Mon
    expect(weekStartOf(new Date("2026-09-16T23:59:00Z"))).toBe("2026-09-14"); // Wed
    expect(weekStartOf(new Date("2026-09-20T00:00:00Z"))).toBe("2026-09-14"); // Sun
    expect(weekStartOf(new Date("2026-09-21T00:00:00Z"))).toBe("2026-09-21"); // next Mon
  });

  it("handles Sunday, which is the off-by-one everyone writes", () => {
    // JS getUTCDay() puts Sunday at 0; a naive subtraction sends it forward a
    // week instead of back six days.
    expect(weekStartOf(new Date("2026-01-04T00:00:00Z"))).toBe("2025-12-29");
  });
});

describe("weeklyCohorts", () => {
  const subs = [
    { created_at: "2026-09-01T10:00:00Z" },
    { created_at: "2026-09-02T10:00:00Z" },
    { created_at: "2026-09-09T10:00:00Z" },
    { created_at: "2026-09-14T09:00:00Z" },
    { created_at: "2026-08-20T10:00:00Z", unsubscribed_at: "2026-09-03T10:00:00Z" },
  ];

  it("buckets signups by week and runs oldest to newest", () => {
    const c = weeklyCohorts(subs, NOW, 4);
    expect(c.map((w) => w.weekStart)).toEqual(["2026-08-24", "2026-08-31", "2026-09-07", "2026-09-14"]);
    expect(c.map((w) => w.joined)).toEqual([0, 2, 1, 1]);
  });

  it("emits empty weeks, because a plateau is information", () => {
    // Drop the zero weeks and a flat stretch renders as a rising line.
    const c = weeklyCohorts([{ created_at: "2026-09-14T09:00:00Z" }], NOW, 4);
    expect(c).toHaveLength(4);
    expect(c.slice(0, 3).every((w) => w.joined === 0)).toBe(true);
  });

  it("accumulates everyone who had joined by the end of each week", () => {
    const c = weeklyCohorts(subs, NOW, 4);
    expect(c.map((w) => w.cumulative)).toEqual([1, 3, 4, 5]);
  });

  it("attributes churn to the week the person JOINED, not the week they left", () => {
    // The 20 Aug subscriber left on 3 Sep. Cohort churn belongs to their own
    // cohort or the number cannot answer "which intake sticks".
    const c = weeklyCohorts(subs, NOW, 4);
    expect(c[0]).toMatchObject({ weekStart: "2026-08-24", churnedFromCohort: 0 });
    const wide = weeklyCohorts(subs, NOW, 6);
    const aug17 = wide.find((w) => w.weekStart === "2026-08-17");
    expect(aug17).toMatchObject({ joined: 1, churnedFromCohort: 1 });
  });

  it("ignores rows with an unparseable date instead of bucketing them at 1970", () => {
    const c = weeklyCohorts([{ created_at: "not a date" }, { created_at: "2026-09-14T09:00:00Z" }], NOW, 2);
    expect(c.reduce((n, w) => n + w.joined, 0)).toBe(1);
  });

  it("survives an empty list", () => {
    expect(weeklyCohorts([], NOW, 3).every((w) => w.joined === 0 && w.cumulative === 0)).toBe(true);
  });
});

describe("churnRate", () => {
  it("is the share of everyone who ever subscribed", () => {
    expect(churnRate([{ created_at: "x" }, { created_at: "y", unsubscribed_at: "z" }])).toBe(0.5);
  });

  it("is NULL on an empty list, not zero", () => {
    // 0% churn reads as "we retain everyone". On no subscribers it means
    // nothing at all, and the page must say so.
    expect(churnRate([])).toBeNull();
  });

  it("is a real zero when people subscribed and none left", () => {
    // The live state on 14 Sep 2026: 29 subscribers, 0 churned.
    expect(churnRate(Array.from({ length: 29 }, () => ({ created_at: "2026-09-01T00:00:00Z" })))).toBe(0);
  });
});

describe("trend — one good week is not a trend", () => {
  const weeks = (joined: number[]) =>
    joined.map((n, i) => ({ weekStart: `w${i}`, joined: n, cumulative: 0, churnedFromCohort: 0 }));

  it("compares the last N weeks with the N before", () => {
    expect(trend(weeks([1, 1, 1, 1, 3, 3, 3, 3]), 4)).toEqual({
      recent: 12,
      previous: 4,
      direction: "up",
    });
  });

  it("calls a flat stretch flat rather than rounding it into a direction", () => {
    expect(trend(weeks([2, 2, 2, 2, 2, 2, 2, 2]), 4)?.direction).toBe("flat");
  });

  it("refuses to report a direction without enough history", () => {
    // Seven weeks cannot support a 4-vs-4 comparison, and a half-filled
    // comparison is exactly how a small dataset lies.
    expect(trend(weeks([1, 2, 3, 4, 5, 6, 7]), 4)).toBeNull();
    expect(trend([], 4)).toBeNull();
  });
});

describe("buildFunnel — every rate is earned", () => {
  // The real 30-day numbers on 14 Sep 2026.
  const live = { views: 4535, ticketClicks: 930, saves: 26, calendarAdds: 20, newSubscribers: 24 };

  it("computes the rates that have a real denominator", () => {
    const f = buildFunnel(live);
    expect(f[1].label).toBe("Ticket clicks");
    expect(f[1].rate).toBeCloseTo(930 / 4535, 6);
    expect(f[2].rate).toBeCloseTo(46 / 4535, 6);
  });

  it("REFUSES a conversion rate off views, and says why", () => {
    // The heart of it. 24/4535 is arithmetic, not a conversion rate: a view is
    // not a reader. Publishing "0.5%" would be a number we cannot stand behind.
    const subs = buildFunnel(live).at(-1)!;
    expect(subs.label).toBe("New subscribers");
    expect(subs.count).toBe(24);
    expect(subs.rate).toBeNull();
    expect(subs.why).toMatch(/view is not a reader/i);
  });

  it("marks the top stage as actions rather than people", () => {
    const top = buildFunnel(live)[0];
    expect(top.rate).toBeNull();
    expect(top.why).toMatch(/no identifiers|not a visitor count/i);
  });

  it("never divides by zero on a quiet period", () => {
    const f = buildFunnel({ views: 0, ticketClicks: 0, saves: 0, calendarAdds: 0, newSubscribers: 0 });
    expect(f.every((s) => s.rate === null || Number.isFinite(s.rate))).toBe(true);
    expect(f[1].rate).toBeNull();
  });

  it("treats broken inputs as zero rather than producing NaN", () => {
    const f = buildFunnel({
      views: NaN, ticketClicks: -5, saves: NaN, calendarAdds: 3, newSubscribers: NaN,
    } as never);
    expect(f.map((s) => s.count)).toEqual([0, 0, 3, 0]);
  });
});

describe("returningReaders — the one place we can count people", () => {
  it("counts distinct people and distinct-day returns", () => {
    const r = returningReaders([
      { user_token: "a", saved_at: "2026-09-01T10:00:00Z" },
      { user_token: "a", saved_at: "2026-09-05T10:00:00Z" },
      { user_token: "b", saved_at: "2026-09-01T10:00:00Z" },
      { user_token: "c", saved_at: "2026-09-02T10:00:00Z" },
    ]);
    expect(r).toMatchObject({ people: 3, returning: 1, saves: 4 });
    expect(r.returnRate).toBeCloseTo(1 / 3, 6);
  });

  it("does not count four saves in one sitting as a return", () => {
    // Enthusiasm is not retention, and conflating them flatters the number.
    const r = returningReaders([
      { user_token: "a", saved_at: "2026-09-01T09:00:00Z" },
      { user_token: "a", saved_at: "2026-09-01T09:05:00Z" },
      { user_token: "a", saved_at: "2026-09-01T09:06:00Z" },
      { user_token: "a", saved_at: "2026-09-01T23:59:00Z" },
    ]);
    expect(r).toMatchObject({ people: 1, returning: 0, saves: 4 });
  });

  it("is null-rated rather than zero-rated when nobody has saved", () => {
    expect(returningReaders([])).toMatchObject({ people: 0, returning: 0, returnRate: null, saves: 0 });
  });

  it("drops rows with no token or a broken timestamp", () => {
    const r = returningReaders([
      { user_token: "", saved_at: "2026-09-01T10:00:00Z" },
      { user_token: "   ", saved_at: "2026-09-01T10:00:00Z" },
      { user_token: "a", saved_at: "nonsense" },
      { user_token: "a", saved_at: "2026-09-01T10:00:00Z" },
    ]);
    expect(r).toMatchObject({ people: 1, saves: 1 });
  });
});

describe("presentation", () => {
  it("renders a rate as a percent and a missing one as an em dash", () => {
    expect(pct(0.205)).toBe("21%");
    expect(pct(0.205, 1)).toBe("20.5%");
    expect(pct(null)).toBe("—");
    expect(pct(undefined)).toBe("—");
    expect(pct(NaN)).toBe("—");
  });

  it("signs a delta so a flat week reads as flat", () => {
    expect(delta(14, 11)).toBe("+3");
    expect(delta(11, 14)).toBe("−3");
    expect(delta(5, 5)).toBe("±0");
  });
});
