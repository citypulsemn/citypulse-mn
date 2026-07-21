import { describe, it, expect } from "vitest";
import { composeOpsDigest, buildSections, parseStoredTotals, wowLabel, deltaTag, type OpsInputs } from "../ops-digest";

const NOW = new Date("2026-07-20T15:30:00Z"); // a Monday, 10:30am Chicago

function healthy(overrides: Partial<OpsInputs> = {}): OpsInputs {
  return {
    pipeline: {
      started_at: "2026-07-20T13:00:00Z",
      finished_at: "2026-07-20T13:22:10Z",
      ok: true,
      upserted: 148, cancelled: 3, archived: 12, collapsed: 5, collapsed_runs: 4,
      error: null,
    },
    prevPipeline: {
      started_at: "2026-07-13T13:00:00Z",
      finished_at: "2026-07-13T13:20:00Z",
      ok: true,
      upserted: 136, cancelled: 2, archived: 15, collapsed: 8, collapsed_runs: 6,
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
    feeds: { clicks7: 9, top: [{ label: "venue-first-avenue", count: 5 }, { label: "live-music", count: 3 }] },
    sitemapUrls: 121,
    prevSitemapUrls: 118,
    errors: {},
    ...overrides,
  };
}

describe("parseStoredTotals — jsonb baseline read-back", () => {
  it("passes a proper object through untouched", () => {
    const totals = { view: 68, ticket_click: 15, save: 4, calendar: 1062 };
    expect(parseStoredTotals(totals)).toEqual(totals);
  });
  it("recovers the legacy double-stringified rows (the WoW-always-'first-report' bug)", () => {
    expect(parseStoredTotals('{"view":7,"ticket_click":3,"save":3,"calendar":117}')).toEqual({
      view: 7, ticket_click: 3, save: 3, calendar: 117,
    });
  });
  it("honest emptiness: garbage shapes → null, never a fake object", () => {
    expect(parseStoredTotals(null)).toBeNull();
    expect(parseStoredTotals(undefined)).toBeNull();
    expect(parseStoredTotals("not json")).toBeNull();
    expect(parseStoredTotals("42")).toBeNull(); // valid JSON, wrong shape
    expect(parseStoredTotals([1, 2])).toBeNull();
  });
});

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
  it("all eight sections render in both formats", () => {
    for (const title of ["Pipeline", "Coverage", "Verification", "Engagement (7d)", "Trending", "Index surface", "Subscribers", "Feeds"]) {
      expect(text).toContain(title);
      expect(html).toContain(title);
    }
  });
  it("carries the run counters WITH run-over-run diffs, WoW deltas, trending, personalized note", () => {
    expect(text).toContain("148 upserted (+12)"); // 148 vs prev 136
    expect(text).toContain("12 archived (-3)"); // 12 vs prev 15
    expect(text).toContain("Δ vs last run");
    expect(text).toContain("views 412 (+18% WoW)");
    expect(text).toContain("1. Aquatennial Fireworks");
    expect(text).toContain("17 personalized");
  });
});

describe("deltaTag (F2.6) — run-over-run delta formatting", () => {
  it("signs the delta and marks a flat run", () => {
    expect(deltaTag(148, 136)).toBe(" (+12)");
    expect(deltaTag(12, 15)).toBe(" (-3)");
    expect(deltaTag(5, 5)).toBe(" (±0)");
  });
  it("stays silent when either side is unknown (no fake baseline)", () => {
    expect(deltaTag(4, null)).toBe("");
    expect(deltaTag(null, 6)).toBe("");
    expect(deltaTag(4, undefined)).toBe("");
  });
});

describe("pipeline diffs & stampede tripwire (F2.6)", () => {
  it("labels the dedupe count 'deduped' and the multi-day fold 'collapsed', each diffed", () => {
    const { text } = composeOpsDigest(healthy(), NOW);
    expect(text).toContain("5 deduped (-3)"); // collapsed column 5 vs prev 8
    expect(text).toContain("4 collapsed (-2)"); // collapsed_runs 4 vs prev 6
  });

  it("shows NO diff on the first-ever run (prevPipeline null) — never a fake delta", () => {
    const sections = buildSections(healthy({ prevPipeline: null }));
    const pipe = sections.find((s) => s.title === "Pipeline")!;
    expect(pipe.lines[0]).toContain("148 upserted");
    expect(pipe.lines[0]).not.toMatch(/\([+-]?\d/); // no "(+12)" etc.
    expect(pipe.lines[1]).not.toContain("Δ vs last run");
    expect(pipe.alert).toBe(false);
  });

  it("a new column with no prior number stays quiet (collapsed_runs vs a null-column prev)", () => {
    const prev = { ...healthy().prevPipeline!, collapsed_runs: null };
    const sections = buildSections(healthy({ prevPipeline: prev }));
    const pipe = sections.find((s) => s.title === "Pipeline")!;
    expect(pipe.lines[0]).toContain("4 collapsed"); // count shown
    expect(pipe.lines[0]).not.toContain("4 collapsed ("); // but no delta tag
  });

  it("a flood of archives raises the stampede alert (the R0.2 fingerprint)", () => {
    const sections = buildSections(
      healthy({ pipeline: { ...healthy().pipeline!, archived: 140 } }),
    );
    const pipe = sections.find((s) => s.title === "Pipeline")!;
    expect(pipe.alert).toBe(true);
    expect(pipe.lines.join("\n")).toContain("stampede check");
  });

  it("a flood of dedupes also trips it", () => {
    const sections = buildSections(
      healthy({ pipeline: { ...healthy().pipeline!, collapsed: 90 } }),
    );
    expect(sections.find((s) => s.title === "Pipeline")!.alert).toBe(true);
  });

  it("normal counts do NOT trip it", () => {
    expect(buildSections(healthy()).find((s) => s.title === "Pipeline")!.alert).toBe(false);
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

  it("every section can fail and the email still composes with all unavailable notices", () => {
    const errs = Object.fromEntries(
      ["pipeline", "coverage", "verify", "engagement", "trending", "subscribers", "index", "feeds"].map((k) => [k, "db down"]),
    );
    const { subject, text } = composeOpsDigest(healthy({ errors: errs }), NOW);
    expect(subject).toContain("8 alerts");
    expect(text.match(/section unavailable: db down/g)).toHaveLength(8);
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

describe("R2.3 — aux failures degrade; they don't kill their section", () => {
  it("a failed BASELINE read leaves Engagement fully reporting, WoW as first report, no alert", () => {
    const sections = buildSections(
      healthy({ prevTotals: null, errors: { engagement_prev: "db down" } }),
    );
    const eng = sections.find((s) => s.title === "Engagement (7d)")!;
    expect(eng.alert).toBe(false);
    expect(eng.lines.join("\n")).toContain("views 412 (first report)");
    expect(eng.lines.join("\n")).not.toContain("unavailable");
    expect(eng.lines.join("\n")).toContain("last baseline unreadable");
  });

  it("a failed digest-note read leaves Subscribers reporting, note line degraded, no alert", () => {
    const sections = buildSections(
      healthy({ lastDigestNote: null, errors: { digest_note: "db down" } }),
    );
    const subs = sections.find((s) => s.title === "Subscribers")!;
    expect(subs.alert).toBe(false);
    expect(subs.lines.join("\n")).toContain("84 subscribed");
    expect(subs.lines.join("\n")).not.toContain("last digest:");
    expect(subs.lines.join("\n")).toContain("last digest note unavailable");
  });

  it("a failed prev-sitemap read leaves Index reporting the live count, no alert", () => {
    const sections = buildSections(
      healthy({ prevSitemapUrls: null, errors: { index_prev: "db down" } }),
    );
    const idx = sections.find((s) => s.title === "Index surface")!;
    expect(idx.alert).toBe(false);
    expect(idx.lines.join("\n")).toContain("121 URLs in the live sitemap (first report)");
    expect(idx.lines.join("\n")).toContain("last count unreadable");
  });

  it("REAL engagement failure is still unavailable + alert — zeros are never reported as fact", () => {
    const sections = buildSections(
      healthy({
        engagement: { totals: { view: 0, ticket_click: 0, save: 0, calendar: 0 }, daily: [], top: [] },
        errors: { engagement: "connection refused" },
      }),
    );
    const eng = sections.find((s) => s.title === "Engagement (7d)")!;
    expect(eng.alert).toBe(true);
    expect(eng.lines.join("\n")).toContain("section unavailable");
    expect(eng.lines.join("\n")).not.toContain("views 0");
  });
});

describe("R2.3 — gather-side tripwires (script source)", () => {
  const src = ((): string => {
    const { readFileSync } = require("node:fs") as typeof import("node:fs");
    const { join } = require("node:path") as typeof import("node:path");
    return readFileSync(join(__dirname, "..", "..", "scripts", "send-ops-digest.ts"), "utf8");
  })();

  it("engagement goes through wrap with the STRICT read (failure-zeros can't pose as data)", () => {
    expect(src).toContain('wrap("engagement", emptyEngagement, () => getEngagementStrict(7))');
    expect(src).not.toContain("await getEngagement(7)");
  });

  it("aux reads carry their own keys — no more collisions with real sections", () => {
    expect(src).toContain('"engagement_prev"');
    expect(src).toContain('"digest_note"');
    expect(src).toContain('"index_prev"');
  });

  it("a failed engagement run never writes the WoW baseline", () => {
    expect(src.indexOf("inputs.errors.engagement")).toBeGreaterThan(-1);
    expect(src.indexOf("inputs.errors.engagement")).toBeLessThan(src.indexOf("insert into ops_digest_runs"));
  });
});

describe("R2.4 — the operator email escapes what it interpolates", () => {
  it("a markup-bearing title renders as text in HTML, untouched in plain text", () => {
    const { html, text } = composeOpsDigest(
      healthy({
        engagement: {
          ...healthy().engagement,
          top: [{ title: "Beauty & the Beast <Preview>" } as never],
        },
        trending: { count: 3, top: ['<script>alert(1)</script>', "B", "C"] },
      }),
      NOW,
    );
    expect(html).toContain("Beauty &amp; the Beast &lt;Preview&gt;");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<Preview>");
    expect(text).toContain("Beauty & the Beast <Preview>"); // plain text stays plain
  });

  it("a markup-bearing DB error string cannot inject into the inbox", () => {
    const { html } = composeOpsDigest(
      healthy({ errors: { pipeline: 'boom <img src=x onerror="steal()">' } }),
      NOW,
    );
    expect(html).toContain("&lt;img src=x onerror=&quot;steal()&quot;&gt;");
    expect(html).not.toContain("<img src=x");
  });
});

describe("Feeds section (F2.5)", () => {
  it("reports total clicks and the top feeds", () => {
    const { text } = composeOpsDigest(healthy(), NOW);
    expect(text).toContain("9 calendar-subscribe clicks (7d)");
    expect(text).toContain("venue-first-avenue: 5");
  });
  it("zero clicks reads as a quiet 'feeds are new', NOT an alert", () => {
    const sections = buildSections(healthy({ feeds: { clicks7: 0, top: [] } }));
    const feeds = sections.find((s) => s.title === "Feeds")!;
    expect(feeds.alert).toBe(false);
    expect(feeds.lines[0]).toContain("feeds are new");
  });
  it("singular click grammar", () => {
    const sections = buildSections(healthy({ feeds: { clicks7: 1, top: [{ label: "uptown", count: 1 }] } }));
    const feeds = sections.find((s) => s.title === "Feeds")!;
    expect(feeds.lines[0]).toBe("1 calendar-subscribe click (7d)");
  });
  it("a gather failure is an unavailable alert, not a crash", () => {
    const sections = buildSections(healthy({ errors: { feeds: "db down" } }));
    const feeds = sections.find((s) => s.title === "Feeds")!;
    expect(feeds.alert).toBe(true);
    expect(feeds.lines[0]).toContain("unavailable");
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
