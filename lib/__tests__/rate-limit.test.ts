import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  firstForwardedIp,
  ipBucket,
  emailBucket,
  rateAllow,
  pruneRateEvents,
  RATE_LIMITS,
} from "../rate-limit";
import { sql } from "../db";

type Db = NonNullable<typeof sql>;

/** Fake postgres tag: records the query text, returns a canned result (or
 *  throws). Behavior of the REAL upsert is pinned by the query-text tripwires
 *  below plus the rolled-back prod probe in the deploy guide. */
function fakeDb(result: unknown[] | Error) {
  const calls: string[] = [];
  const db = ((strings: TemplateStringsArray, ..._vals: unknown[]) => {
    calls.push(strings.join(" $param "));
    if (result instanceof Error) return Promise.reject(result);
    return Promise.resolve(result);
  }) as unknown as Db;
  return { db, calls };
}

describe("firstForwardedIp", () => {
  it("takes the first hop (the client on Vercel)", () => {
    expect(firstForwardedIp("203.0.113.9, 10.0.0.1, 10.0.0.2")).toBe("203.0.113.9");
  });
  it("trims and lowercases (IPv6 hex)", () => {
    expect(firstForwardedIp("  2001:DB8::1 , 10.0.0.1")).toBe("2001:db8::1");
  });
  it("absent or empty header → the shared 'unknown' bucket, never a crash", () => {
    expect(firstForwardedIp(null)).toBe("unknown");
    expect(firstForwardedIp(undefined)).toBe("unknown");
    expect(firstForwardedIp("   ")).toBe("unknown");
  });
});

describe("bucket builders", () => {
  it("shape is path:kind:id, with emails normalized", () => {
    expect(ipBucket("subscribe", "1.2.3.4")).toBe("subscribe:ip:1.2.3.4");
    expect(emailBucket("saved-link", "  A@B.Com ")).toBe("saved-link:email:a@b.com");
  });
});

describe("rateAllow — failure posture", () => {
  it("fails OPEN with no database (dev must never block)", async () => {
    expect(await rateAllow("b", 1, 60, null)).toBe(true);
  });

  it("fails OPEN when the query throws (rule 1: a broken instrument must not kill its panel)", async () => {
    const { db } = fakeDb(new Error("connection refused"));
    expect(await rateAllow("b", 1, 60, db)).toBe(true);
  });

  it("fails CLOSED on the limit — boundary honest: n == limit allowed, n == limit+1 blocked", async () => {
    const at = fakeDb([{ n: 3 }]);
    expect(await rateAllow("b", 3, 60, at.db)).toBe(true);
    const over = fakeDb([{ n: 4 }]);
    expect(await rateAllow("b", 3, 60, over.db)).toBe(false);
  });

  it("an empty result (shouldn't happen) fails open, not closed", async () => {
    const { db } = fakeDb([]);
    expect(await rateAllow("b", 3, 60, db)).toBe(true);
  });
});

describe("rateAllow — the atomic upsert (query-text tripwires)", () => {
  it("is ONE statement: insert … on conflict … returning (no read-then-write race)", async () => {
    const { db, calls } = fakeDb([{ n: 1 }]);
    await rateAllow("b", 3, 60, db);
    expect(calls.length).toBe(1);
    expect(calls[0]).toContain("insert into rate_events");
    expect(calls[0]).toContain("on conflict (bucket) do update");
    expect(calls[0]).toContain("returning n");
  });

  it("rolls the window over IN PLACE: both n and window_start reset when the window lapsed", async () => {
    const { db, calls } = fakeDb([{ n: 1 }]);
    await rateAllow("b", 3, 60, db);
    const caseArms = calls[0].match(/when rate_events\.window_start > now\(\) - make_interval/g);
    expect(caseArms?.length).toBe(2); // one case for n, one for window_start
    expect(calls[0]).toContain("else 1");
    expect(calls[0]).toContain("else now()");
  });
});

describe("pruneRateEvents", () => {
  it("sweeps buckets idle 2+ days; returns 0 (not a crash) on failure", async () => {
    const ok = fakeDb(Object.assign([], { count: 5 }));
    expect(await pruneRateEvents(ok.db)).toBe(5);
    expect(ok.calls[0]).toContain("delete from rate_events");
    expect(ok.calls[0]).toContain("interval '2 days'");
    const broken = fakeDb(new Error("boom"));
    expect(await pruneRateEvents(broken.db)).toBe(0);
    expect(await pruneRateEvents(null)).toBe(0);
  });
});

describe("wiring tripwires — where the checks sit matters as much as the checks", () => {
  const lib = (f: string) => readFileSync(join(__dirname, "..", f), "utf8");

  it("honeypot short-circuits BEFORE any counting, on all three forms", () => {
    for (const f of ["subscribe-actions.ts", "submit-actions.ts", "saved-restore-actions.ts"]) {
      const src = lib(f);
      const honeypot = src.indexOf('formData.get("company")');
      const rate = src.indexOf("rateAllow(");
      expect(honeypot, `${f} has the honeypot`).toBeGreaterThan(-1);
      expect(rate, `${f} rate-checks`).toBeGreaterThan(-1);
      expect(honeypot, `${f}: honeypot must come first`).toBeLessThan(rate);
    }
  });

  it("the email-bomb gate: per-TARGET-address cap sits before the subscriber insert", () => {
    const src = lib("saved-restore.ts");
    const cap = src.indexOf('emailBucket("saved-link"');
    const insert = src.indexOf("insert into subscribers");
    expect(cap).toBeGreaterThan(-1);
    expect(cap).toBeLessThan(insert);
  });

  it("throttled keep-list paths answer the same generic success (no-enumeration)", () => {
    const src = lib("saved-restore-actions.ts");
    expect(src.match(/Check your inbox — your link is on the way\./g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("beacon parses before counting and stays a uniform 204", () => {
    const src = readFileSync(
      join(__dirname, "..", "..", "app", "api", "beacon", "route.ts"),
      "utf8",
    );
    expect(src.indexOf("parseBeacon(")).toBeLessThan(src.indexOf("rateAllow("));
    expect(src).toContain("status: 204");
  });

  it("schema is additive and the pipeline sweeps stale buckets", () => {
    const schema = readFileSync(join(__dirname, "..", "..", "db", "schema.sql"), "utf8");
    expect(schema).toContain("create table if not exists rate_events");
    const pipeline = readFileSync(
      join(__dirname, "..", "..", "scripts", "run-pipeline.ts"),
      "utf8",
    );
    expect(pipeline).toContain("pruneRateEvents()");
  });
});

describe("limits are sane", () => {
  it("email-bomb cap is the tightest; beacon is the loosest", () => {
    const l = RATE_LIMITS;
    expect(l.savedLinkPerEmail.limit).toBeLessThanOrEqual(l.savedLinkPerIp.limit);
    expect(l.subscribePerIp.limit).toBeGreaterThan(l.savedLinkPerIp.limit); // venue Wi-Fi headroom
    expect(l.beaconPerIp.limit).toBeGreaterThan(l.subscribePerIp.limit);
  });
});
