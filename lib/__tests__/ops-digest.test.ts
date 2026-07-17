import { describe, it, expect } from "vitest";
import { composeOpsDigest, buildSections, wowLabel, type OpsInputs } from "../ops-digest";

const NOW = new Date("2026-07-20T15:30:00Z"); // a Monday, 10:30am Chicago

function healthy(overrides: Partial<OpsInputs> = {}): OpsInputs {
  return {
    pipeline: {
      started_at: "2026-07-20T13:00:00Z",
      finished_at: "2026-07-20T13:22:10Z",
      ok: true,
      upserted: 148, cancelled: 3, archived: 12, collapsed: 5,
      error: null,
    },
    coverageHealthy: true,
    coverageAlerts: ["[coverage] all categories meet their weekly floor ✓"],
    verify: { verified7: 41, neverVerifiedUpcoming: 12 },
    engagement: {
      totals: { view: 412, ticket_click: 38, save: 21, calendar: 9 },
      daily: [],
      top: [{ title: "Aquatennial Fireworks" } as never],
    },
    prevTotals: { view: 350, ticket_click: 40, save: 21, calendar: 0 },
    trending: { count: 6, top: ["Aquatennial Fireworks", "Trampled by Turtles", "Como Family Day"] },
    subscribers: { total: 84, delta7: 6 },
    lastDigestNote: "84 sent, 17 personalized",
    sitemapUrls: 121,
    prevSitemapUrls: 118,
    errors: {},
    ...overrides,
  };
}

describe("wowLabel — week-over-week math", () => {
  it("computes signed percentages", () => {
    expect(wowLabel(412, 350)).toBe("+18% WoW");
    expect(wowLabel(38, 40)).toBe("-5% WoW");
    expect(wowLabel(21, 21)).toBe("±0%");
  });
  it("first run: no prior row → 'first report' (never a fake 0% or NaN)", () => {
    expect(wowLabel(412, null)).toBe("first report");
  });
  it("prev of zero: 'new' when activity appears, ±0% when both zero", () => {
    expect(wowLabel(9, 0)).toBe("new");
    expect(wowLabel(0, 0)).toBe("±0%");
  });
});

describe("composeOpsDigest — the healthy week", () => {
  const { subject, html, text } = composeOpsDigest(healthy(), NOW);
  it("subject is green with the Chicago date", () => {
    expect(subject).toBe("✅ City Pulse ops — all green (Jul 20)");
  });
  it("all six sections render in both formats", () => {
    for (const title of ["Pipeline", "Coverage", "Verification", "Engagement (7d)", "Trending", "Index surface", "Subscribers"]) {
      expect(text).toContain(title);
      expect(html).toContain(title);
    }
  });
  it("carries the run counters, WoW deltas, trending top 3, and the personalized note", () => {
    expect(text).toContain("148 upserted");
    expect(text).toContain("views 412 (+18% WoW)");
    expect(text).toContain("1. Aquatennial Fireworks");
    expect(text).toContain("17 personalized");
  });
});

describe("alert states", () => {
  it("failed pipeline: ⚠️ subject counts it, error text surfaces", () => {
    const { subject, text } = composeOpsDigest(
      healthy({ pipeline: { ...healthy().pipeline!, ok: false, error: "agent timeout in music band" } }),
      NOW,
    );
    expect(subject).toBe("⚠️ City Pulse ops — 1 alert (Jul 20)");
    expect(text).toContain("FAILED — agent timeout in music band");
  });

  it("killed run (finished_at null): the kill signature is named explicitly", () => {
    const { text } = composeOpsDigest(
      healthy({ pipeline: { ...healthy().pipeline!, finished_at: null } }),
      NOW,
    );
    expect(text).toContain("KILLED/INCOMPLETE");
  });

  it("coverage breach: alerts pass through verbatim and count toward the subject", () => {
    const { subject, text } = composeOpsDigest(
      healthy({
        coverageHealthy: false,
        coverageAlerts: ["[coverage] music: 3 events week of Jul 27 (floor 8) — THIN"],
      }),
      NOW,
    );
    expect(subject).toContain("1 alert");
    expect(text).toContain("floor 8");
  });

  it("multiple alerts pluralize", () => {
    const { subject } = composeOpsDigest(
      healthy({
        pipeline: { ...healthy().pipeline!, ok: false, error: "x" },
        coverageHealthy: false,
        coverageAlerts: ["breach"],
      }),
      NOW,
    );
    expect(subject).toContain("2 alerts");
  });
});

describe("the resilience contract", () => {
  it("a failed section renders 'unavailable' with its reason — and the email still composes", () => {
    const { subject, text } = composeOpsDigest(
      healthy({ errors: { engagement: "connection refused" } }),
      NOW,
    );
    expect(text).toContain("section unavailable: connection refused");
    expect(subject).toContain("alert"); // an unavailable section IS an alert
    expect(text).toContain("Trending"); // the rest of the cockpit still reports
  });

  it("every section can fail and the email still composes with six unavailable notices", () => {
    const errs = Object.fromEntries(
      ["pipeline", "coverage", "verify", "engagement", "trending", "subscribers", "index"].map((k) => [k, "db down"]),
    );
    const { subject, text } = composeOpsDigest(healthy({ errors: errs }), NOW);
    expect(subject).toContain("7 alerts");
    expect(text.match(/section unavailable: db down/g)).toHaveLength(7);
  });
});

describe("the Index surface section (roadmap 3.1)", () => {
  it("reports live sitemap count with WoW", () => {
    const { text } = composeOpsDigest(healthy(), NOW);
    expect(text).toContain("121 URLs in the live sitemap (+3% WoW)");
  });
  it("first run: no prior sitemap number → 'first report'", () => {
    const { text } = composeOpsDigest(healthy({ prevSitemapUrls: null }), NOW);
    expect(text).toContain("121 URLs in the live sitemap (first report)");
  });
  it("unfetchable sitemap is an alert, not a crash", () => {
    const { subject, text } = composeOpsDigest(healthy({ sitemapUrls: null }), NOW);
    expect(text).toContain("sitemap not fetched");
    expect(subject).toContain("alert");
  });
});

describe("quiet states that are NOT alerts", () => {
  it("dark trending is expected while stats accumulate — no alarm", () => {
    const sections = buildSections(healthy({ trending: { count: 0, top: [] } }));
    const trending = sections.find((s) => s.title === "Trending")!;
    expect(trending.alert).toBe(false);
    expect(trending.lines[0]).toContain("dark");
  });
  it("no pipeline rows yet IS an alert (the cockpit should notice silence)", () => {
    const sections = buildSections(healthy({ pipeline: null }));
    expect(sections.find((s) => s.title === "Pipeline")!.alert).toBe(true);
  });
});
