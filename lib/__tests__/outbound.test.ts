import { describe, it, expect } from "vitest";
import { outboundTicketUrl, outboundHost, AFFILIATE, type AffiliateTag } from "../outbound";

const FAKE: Record<string, AffiliateTag> = {
  "seatgeek.com": { params: { aid: "12345" } },
  "ticketmaster.com": { params: { irgwc: "1", camefrom: "citypulse" } },
};

describe("outboundHost", () => {
  it("strips www and lowercases", () => {
    expect(outboundHost("https://WWW.SeatGeek.com/foo")).toBe("seatgeek.com");
  });
  it("returns null for garbage", () => {
    expect(outboundHost("not a url")).toBeNull();
    expect(outboundHost("")).toBeNull();
  });
});

describe("outboundTicketUrl — passthrough by default (dormant seam)", () => {
  it("the live config is empty, so real URLs pass through unchanged", () => {
    expect(Object.keys(AFFILIATE)).toHaveLength(0);
    const url = "https://www.ticketmaster.com/event/abc?foo=1";
    expect(outboundTicketUrl(url)).toBe(url);
  });
  it("passes through empty, unparseable, and unknown-host inputs", () => {
    expect(outboundTicketUrl("", FAKE)).toBe("");
    expect(outboundTicketUrl("not a url", FAKE)).toBe("not a url");
    expect(outboundTicketUrl("https://first-avenue.com/show/1", FAKE)).toBe("https://first-avenue.com/show/1");
  });
});

describe("outboundTicketUrl — tagging (with a joined program)", () => {
  it("appends the affiliate params for a matching host", () => {
    const out = outboundTicketUrl("https://seatgeek.com/e/123", FAKE);
    expect(out).toContain("seatgeek.com/e/123");
    expect(out).toContain("aid=12345");
  });
  it("matches regardless of www / case", () => {
    expect(outboundTicketUrl("https://WWW.SeatGeek.com/e/1", FAKE)).toContain("aid=12345");
  });
  it("never rewrites the host or path", () => {
    const out = new URL(outboundTicketUrl("https://seatgeek.com/e/123", FAKE));
    expect(out.hostname).toBe("seatgeek.com");
    expect(out.pathname).toBe("/e/123");
  });
  it("preserves the vendor's existing query and never clobbers a shared param", () => {
    const out = outboundTicketUrl("https://ticketmaster.com/e?camefrom=partner&x=9", FAKE);
    const q = new URL(out).searchParams;
    expect(q.get("x")).toBe("9");
    expect(q.get("camefrom")).toBe("partner"); // ours does NOT overwrite theirs
    expect(q.get("irgwc")).toBe("1"); // ours is still added
  });
  it("is idempotent", () => {
    const once = outboundTicketUrl("https://seatgeek.com/e/1", FAKE);
    expect(outboundTicketUrl(once, FAKE)).toBe(once);
  });
});
