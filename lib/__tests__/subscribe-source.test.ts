import { describe, it, expect } from "vitest";
import { composeOpsDigest, buildSections, type OpsInputs } from "../ops-digest";

const NOW = new Date("2026-07-20T15:30:00Z");

function base(sub: Partial<OpsInputs["subscribers"]>): OpsInputs {
  return {
    pipeline: { started_at: "2026-07-20 08:00", finished_at: "2026-07-20 08:22", ok: true, upserted: 1, cancelled: 0, archived: 0, collapsed: 0, error: null },
    coverageHealthy: true,
    coverageAlerts: ["ok"],
    verify: { verified7: 0, neverVerifiedUpcoming: 0 },
    engagement: { totals: { view: 0, ticket_click: 0, save: 0, calendar: 0 }, daily: [], top: [] },
    prevTotals: null,
    trending: { count: 0, top: [] },
    subscribers: { total: 100, delta7: 8, ...sub },
    lastDigestNote: null,
    sitemapUrls: 120,
    prevSitemapUrls: 120,
    errors: {},
  };
}

describe("Subscribers section — source breakdown (roadmap 3.4)", () => {
  it("renders new signups grouped by placement when present", () => {
    const { text } = composeOpsDigest(
      base({ bySource7: [{ source: "this-weekend", count: 5 }, { source: "venue-page", count: 2 }, { source: "site", count: 1 }] }),
      NOW,
    );
    expect(text).toContain("new by placement: this-weekend 5 · venue-page 2 · site 1");
  });

  it("omits the breakdown line entirely on a zero-signup week (no empty 'new by placement:')", () => {
    const sections = buildSections(base({ delta7: 0, bySource7: [] }));
    const sub = sections.find((s) => s.title === "Subscribers")!;
    expect(sub.lines.some((l) => l.includes("new by placement"))).toBe(false);
    expect(sub.lines[0]).toContain("100 subscribed (+0 last 7 days)");
  });

  it("tolerates a missing bySource7 field (older gather shape) without crashing", () => {
    const inputs = base({});
    delete (inputs.subscribers as { bySource7?: unknown }).bySource7;
    const sections = buildSections(inputs);
    const sub = sections.find((s) => s.title === "Subscribers")!;
    expect(sub.lines.some((l) => l.includes("new by placement"))).toBe(false);
    expect(sub.alert).toBe(false);
  });
});
