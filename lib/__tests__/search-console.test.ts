import { describe, it, expect, afterEach } from "vitest";
import {
  parseSearchAnalytics,
  buildJwtClaims,
  gscDateWindow,
  getSearchImpressions,
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
