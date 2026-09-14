import { describe, it, expect } from "vitest";
import {
  normalizeReferrer,
  referrerLabel,
  referrerChannel,
  byChannel,
} from "../referrers";

describe("normalizeReferrer — a trust boundary, not a formatter", () => {
  it("keeps a plain host, lowercased and de-www'd", () => {
    expect(normalizeReferrer("www.Google.com")).toBe("google.com");
    expect(normalizeReferrer("news.ycombinator.com")).toBe("news.ycombinator.com");
  });

  it("calls a missing referrer direct, not unknown", () => {
    // No referrer is a real answer — a bookmark, a typed URL, an app, or a
    // browser stripping it. It is not a failure to record.
    for (const v of ["", "   ", null, undefined]) {
      expect(normalizeReferrer(v), JSON.stringify(v)).toBe("direct");
    }
  });

  it("calls our own pages internal", () => {
    for (const h of ["citypulsemn.com", "www.citypulsemn.com", "localhost", "127.0.0.1"]) {
      expect(normalizeReferrer(h), h).toBe("internal");
    }
  });

  it("STRIPS everything but the host if a full URL arrives", () => {
    // The client is supposed to send a bare hostname. The endpoint is public,
    // so the path and query must be destroyed here regardless — that is where
    // someone's search terms or a session id would be.
    expect(normalizeReferrer("https://www.google.com/search?q=embarrassing+thing")).toBe("google.com");
    expect(normalizeReferrer("https://mail.example.org/inbox/12345?token=abc")).toBe("mail.example.org");
  });

  it("never returns anything that could carry an identifier", () => {
    for (const v of [
      "https://www.google.com/search?q=secret",
      "example.com/path",
      "sub.example.com:8443/a?b=c",
    ]) {
      const out = normalizeReferrer(v);
      expect(out, v).not.toMatch(/[/?=&#]/);
    }
  });

  it("rejects junk rather than storing it", () => {
    for (const v of [
      123,
      {},
      [],
      true,
      "not a host at all",
      "<script>alert(1)</script>",
      "a".repeat(200) + ".com",
      "'; drop table events; --",
    ] as unknown[]) {
      expect(normalizeReferrer(v), JSON.stringify(v)).toBeNull();
    }
  });

  it("rejects a bare word that is not a host and not us", () => {
    expect(normalizeReferrer("intranet")).toBeNull();
  });

  it("takes a custom self-host list", () => {
    expect(normalizeReferrer("staging.example.com", ["example.com"])).toBe("internal");
    expect(normalizeReferrer("example.com", ["example.com"])).toBe("internal");
  });
});

describe("referrerLabel — the reading layer, storage keeps the raw host", () => {
  it("collapses a search engine's many hosts into one name", () => {
    for (const h of ["google.com", "google.co.uk", "news.google.com"]) {
      expect(referrerLabel(h), h).toBe("Google");
    }
  });

  it("names the social sources people actually think in", () => {
    expect(referrerLabel("t.co")).toBe("X / Twitter");
    expect(referrerLabel("x.com")).toBe("X / Twitter");
    expect(referrerLabel("lnkd.in")).toBe("LinkedIn");
    expect(referrerLabel("youtu.be")).toBe("YouTube");
  });

  it("passes an unknown host through unchanged rather than bucketing it away", () => {
    expect(referrerLabel("mynortheaster.com")).toBe("mynortheaster.com");
  });

  it("gives the two synthetic values readable names", () => {
    expect(referrerLabel("direct")).toBe("Direct / none");
    expect(referrerLabel("internal")).toBe("Within the site");
  });
});

describe("referrerChannel", () => {
  it("sorts hosts into the channels a growth decision uses", () => {
    expect(referrerChannel("google.com")).toBe("search");
    expect(referrerChannel("instagram.com")).toBe("social");
    expect(referrerChannel("mail.google.com")).toBe("email");
    expect(referrerChannel("direct")).toBe("direct");
    expect(referrerChannel("internal")).toBe("internal");
    expect(referrerChannel("mynortheaster.com")).toBe("referral");
  });

  it("does not let Gmail fall into search just because it is a google host", () => {
    // mail.google.com matches /google\./ too; the email rule has to win.
    expect(referrerChannel("mail.google.com")).not.toBe("search");
  });
});

describe("byChannel", () => {
  it("rolls hosts up, sorts biggest first, and shares sum to one", () => {
    const out = byChannel([
      { host: "google.com", count: 60 },
      { host: "google.co.uk", count: 20 },
      { host: "instagram.com", count: 15 },
      { host: "direct", count: 5 },
    ]);
    expect(out[0]).toMatchObject({ channel: "search", count: 80 });
    expect(out.map((r) => r.channel)).toEqual(["search", "social", "direct"]);
    expect(out.reduce((n, r) => n + r.share, 0)).toBeCloseTo(1, 6);
  });

  it("does not divide by zero on an empty or all-zero set", () => {
    expect(byChannel([])).toEqual([]);
    expect(byChannel([{ host: "direct", count: 0 }])).toEqual([
      { channel: "direct", count: 0, share: 0 },
    ]);
  });

  it("ignores rows with a broken count instead of producing NaN", () => {
    const out = byChannel([
      { host: "google.com", count: 10 },
      { host: "instagram.com", count: NaN },
    ]);
    expect(out).toEqual([{ channel: "search", count: 10, share: 1 }]);
  });
});
