import { describe, it, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  parseSearchAnalytics,
  parseAnalyticsRows,
  buildJwtClaims,
  gscDateWindow,
  getSearchImpressions,
  getSearchAnalyticsByDimension,
  resolveInspectionUrl,
  inspectUrls,
} from "../search-console";

describe("parseSearchAnalytics — GSC searchAnalytics response → totals", () => {
  it("sums an aggregate (no-dimensions) single row and derives ctr", () => {
    const raw = { rows: [{ clicks: 84, impressions: 2100, ctr: 0.04, position: 12.3 }] };
    expect(parseSearchAnalytics(raw)).toEqual({ impressions: 2100, clicks: 84, ctr: 84 / 2100 });
  });

  it("sums per-day rows (dimensions:['date']) across the week", () => {
    const raw = {
      rows: [
        { keys: ["2026-08-01"], clicks: 10, impressions: 300 },
        { keys: ["2026-08-02"], clicks: 12, impressions: 340 },
        { keys: ["2026-08-03"], clicks: 8, impressions: 260 },
      ],
    };
    const out = parseSearchAnalytics(raw)!;
    expect(out.impressions).toBe(900);
    expect(out.clicks).toBe(30);
    expect(out.ctr).toBeCloseTo(30 / 900, 10);
  });

  it("honest emptiness: missing/empty/all-zero → null, never a fake zero row", () => {
    expect(parseSearchAnalytics({})).toBeNull();
    expect(parseSearchAnalytics({ rows: [] })).toBeNull();
    expect(parseSearchAnalytics({ rows: [{ clicks: 0, impressions: 0 }] })).toBeNull();
    expect(parseSearchAnalytics(null)).toBeNull();
    expect(parseSearchAnalytics("nope")).toBeNull();
  });

  it("ignores junk rows and non-finite numbers rather than throwing", () => {
    const raw = { rows: [null, "x", { impressions: 100, clicks: 5 }, { impressions: NaN, clicks: Infinity }] };
    expect(parseSearchAnalytics(raw)).toEqual({ impressions: 100, clicks: 5, ctr: 0.05 });
  });

  it("clicks with zero impressions can't divide-by-zero (ctr 0)", () => {
    // impressions 0 but a click recorded — degenerate, but must not NaN.
    const raw = { rows: [{ impressions: 0, clicks: 3 }] };
    expect(parseSearchAnalytics(raw)).toEqual({ impressions: 0, clicks: 3, ctr: 0 });
  });
});

describe("parseAnalyticsRows — dimensioned response → typed rows (the report)", () => {
  it("shapes query/page rows and sorts by impressions desc", () => {
    const raw = {
      rows: [
        { keys: ["fringe festival"], clicks: 8, impressions: 120, ctr: 0.066, position: 4.2 },
        { keys: ["things to do minneapolis"], clicks: 20, impressions: 900, ctr: 0.022, position: 8.9 },
        { keys: ["kielbasa festival"], clicks: 12, impressions: 300, ctr: 0.04, position: 3.1 },
      ],
    };
    const rows = parseAnalyticsRows(raw);
    expect(rows.map((r) => r.key)).toEqual([
      "things to do minneapolis",
      "kielbasa festival",
      "fringe festival",
    ]);
    expect(rows[0]).toEqual({ key: "things to do minneapolis", clicks: 20, impressions: 900, ctr: 0.022, position: 8.9 });
  });

  it("drops keyless/junk rows and coerces non-finite fields to 0", () => {
    const raw = { rows: [null, "x", { keys: [] }, { keys: ["ok"], impressions: NaN, clicks: 5 }] };
    expect(parseAnalyticsRows(raw)).toEqual([{ key: "ok", clicks: 5, impressions: 0, ctr: 0, position: 0 }]);
  });

  it("honest emptiness: no rows / non-object → []", () => {
    expect(parseAnalyticsRows({})).toEqual([]);
    expect(parseAnalyticsRows({ rows: [] })).toEqual([]);
    expect(parseAnalyticsRows(null)).toEqual([]);
  });
});

describe("getSearchAnalyticsByDimension — safe before the service account is wired", () => {
  const saved = process.env.GSC_SERVICE_ACCOUNT_JSON;
  afterEach(() => {
    if (saved === undefined) delete process.env.GSC_SERVICE_ACCOUNT_JSON;
    else process.env.GSC_SERVICE_ACCOUNT_JSON = saved;
  });

  it("no key → [] (never-break, the report degrades to empty)", async () => {
    delete process.env.GSC_SERVICE_ACCOUNT_JSON;
    expect(await getSearchAnalyticsByDimension("query")).toEqual([]);
    expect(await getSearchAnalyticsByDimension("page")).toEqual([]);
  });
});

describe("resolveInspectionUrl — the URL Inspection API needs an absolute URL", () => {
  it("prefixes a bare path with the base, collapsing a trailing slash", () => {
    expect(resolveInspectionUrl("/places", "https://www.citypulsemn.com")).toBe("https://www.citypulsemn.com/places");
    expect(resolveInspectionUrl("/places", "https://www.citypulsemn.com/")).toBe("https://www.citypulsemn.com/places");
  });
  it("passes an already-absolute URL through unchanged", () => {
    expect(resolveInspectionUrl("https://x.com/y", "https://www.citypulsemn.com")).toBe("https://x.com/y");
  });
});

describe("inspectUrls — safe before the service account is wired", () => {
  const saved = process.env.GSC_SERVICE_ACCOUNT_JSON;
  afterEach(() => {
    if (saved === undefined) delete process.env.GSC_SERVICE_ACCOUNT_JSON;
    else process.env.GSC_SERVICE_ACCOUNT_JSON = saved;
  });

  it("no key → [] (never-break, the index check degrades to empty)", async () => {
    delete process.env.GSC_SERVICE_ACCOUNT_JSON;
    expect(await inspectUrls(["/places"])).toEqual([]);
  });
});

describe("buildJwtClaims — the service-account assertion (getting this right IS the auth)", () => {
  const claims = buildJwtClaims("bot@proj.iam.gserviceaccount.com", 1_000_000);
  it("carries issuer, the read-only Search Console scope, and Google's token audience", () => {
    expect(claims.iss).toBe("bot@proj.iam.gserviceaccount.com");
    expect(claims.scope).toBe("https://www.googleapis.com/auth/webmasters.readonly");
    expect(claims.aud).toBe("https://oauth2.googleapis.com/token");
  });
  it("expires exactly one hour after iat (Google's cap)", () => {
    expect(claims.iat).toBe(1_000_000);
    expect(claims.exp).toBe(1_000_000 + 3600);
  });
});

describe("gscDateWindow — ends 3 days back for GSC's finalization lag", () => {
  it("returns a `days`-long YYYY-MM-DD window ending 3 days before now", () => {
    const now = new Date("2026-08-06T12:00:00Z");
    expect(gscDateWindow(now, 7)).toEqual({ startDate: "2026-07-28", endDate: "2026-08-03" });
  });
  it("endDate is always 3 days back regardless of window length", () => {
    const now = new Date("2026-08-06T12:00:00Z");
    expect(gscDateWindow(now, 28).endDate).toBe("2026-08-03");
    expect(gscDateWindow(now, 28).startDate).toBe("2026-07-07");
  });
});

describe("getSearchImpressions — safe before the service account is wired", () => {
  const saved = process.env.GSC_SERVICE_ACCOUNT_JSON;
  afterEach(() => {
    if (saved === undefined) delete process.env.GSC_SERVICE_ACCOUNT_JSON;
    else process.env.GSC_SERVICE_ACCOUNT_JSON = saved;
  });

  it("no key configured → null (the digest falls back to the manual line)", async () => {
    delete process.env.GSC_SERVICE_ACCOUNT_JSON;
    expect(await getSearchImpressions(7)).toBeNull();
  });

  it("blank key → null, no attempt", async () => {
    process.env.GSC_SERVICE_ACCOUNT_JSON = "   ";
    expect(await getSearchImpressions(7)).toBeNull();
  });

  it("malformed key → null (never-break: a bad secret can't crash the digest)", async () => {
    process.env.GSC_SERVICE_ACCOUNT_JSON = "{not json";
    expect(await getSearchImpressions(7)).toBeNull();
  });
});

/**
 * THE DEAD INDEXATION CHECK (30 Oct 2026). 9ee3014 wrapped every Google call in
 * AbortSignal.timeout(6s) to stop /admin/growth answering 504. Correct for a page
 * render; too tight for URL Inspection, which is the slower endpoint. The next
 * run of the report — 39 days later, because it is manual — lost all 16
 * inspections to TimeoutError, including 12 that had passed unbounded on 10 Sep.
 * Nothing alerted: the never-break contract made each one an honest ERROR row.
 *
 * These pin the split and, more usefully, the BUDGET. inspectUrls is serial, so
 * the worst case is INDEX_PATHS.length x the per-call ceiling, and that has to
 * fit inside the workflow's timeout-minutes. The failure mode this catches is
 * someone adding a dozen URLs to INDEX_PATHS and silently killing the job again.
 */
describe("the indexation check's timeout budget", () => {
  const lib = readFileSync(join(__dirname, "..", "search-console.ts"), "utf8");
  const script = readFileSync(join(__dirname, "..", "..", "scripts", "gsc-report.ts"), "utf8");
  const wf = readFileSync(join(__dirname, "..", "..", ".github", "workflows", "gsc-report.yml"), "utf8");

  const num = (s: string) => Number(s.replace(/_/g, ""));
  const inspectMs = num(lib.match(/GSC_INSPECT_TIMEOUT_MS = ([\d_]+)/)![1]);
  const pageMs = num(lib.match(/GSC_TIMEOUT_MS = ([\d_]+)/)![1]);

  it("URL Inspection gets a longer ceiling than the page-render one", () => {
    expect(inspectMs).toBeGreaterThan(pageMs);
    // and it is actually threaded into the inspect call, not just declared
    expect(lib).toMatch(/urlInspection\/index:inspect[\s\S]{0,400}GSC_INSPECT_TIMEOUT_MS/);
  });

  it("the analytics readers keep the 6s page ceiling (the 504 fix stands)", () => {
    const analytics = lib.slice(
      lib.indexOf("export async function getSearchAnalyticsByDimension"),
      lib.indexOf("export interface IndexStatus"),
    );
    expect(analytics).toContain("gscFetch(");
    expect(analytics).not.toContain("GSC_INSPECT_TIMEOUT_MS");
  });

  it("worst-case serial inspection fits inside the job's timeout-minutes", () => {
    const paths = script.match(/const INDEX_PATHS = \[([\s\S]*?)\];/)![1];
    const count = (paths.match(/"\//g) ?? []).length;
    expect(count).toBeGreaterThan(0);
    const jobMs = num(wf.match(/timeout-minutes: (\d+)/)![1]) * 60_000;
    // leave room for checkout + npm ci + the two analytics calls
    expect(count * inspectMs).toBeLessThan(jobMs - 90_000);
  });
});
