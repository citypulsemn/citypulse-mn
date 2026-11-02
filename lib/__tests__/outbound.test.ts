import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { outboundTicketUrl, outboundHost, campaignUrl, AFFILIATE, type AffiliateTag } from "../outbound";

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

describe("campaignUrl — tagging the links we place ourselves", () => {
  it("appends the three params, with ? on a bare URL", () => {
    expect(campaignUrl("https://buy.stripe.com/abc", "site", "footer", "support")).toBe(
      "https://buy.stripe.com/abc?utm_source=site&utm_medium=footer&utm_campaign=support",
    );
  });

  it("uses & when the URL already carries a query", () => {
    expect(campaignUrl("https://buy.stripe.com/abc?x=1", "email", "digest", "support")).toBe(
      "https://buy.stripe.com/abc?x=1&utm_source=email&utm_medium=digest&utm_campaign=support",
    );
  });

  it("the email call is byte-identical to the private copy it replaced", () => {
    // lib/digest.ts now delegates here. These are the exact strings that
    // shipped before the move, so live email links do not change.
    expect(campaignUrl("https://example.com/s", "email", "digest", "sponsor")).toBe(
      "https://example.com/s?utm_source=email&utm_medium=digest&utm_campaign=sponsor",
    );
    expect(campaignUrl("https://example.com/s", "email", "digest", "support")).toBe(
      "https://example.com/s?utm_source=email&utm_medium=digest&utm_campaign=support",
    );
  });

  it("makes a footer click distinguishable from an email click — the point of the change", () => {
    // DEPLOY-SUPPORT-LINK-AND-PARKING.md claimed this was already true. It was
    // not: both tagged links were utm_medium=digest and the footer carried no
    // tag at all, so a footer click was identifiable only by the ABSENCE of a
    // tag — indistinguishable from a link someone pasted into a group chat.
    const foot = campaignUrl("https://buy.stripe.com/x", "site", "footer", "support");
    const mail = campaignUrl("https://buy.stripe.com/x", "email", "digest", "support");
    expect(foot).not.toBe(mail);
    expect(foot).toContain("utm_medium=footer");
    expect(mail).toContain("utm_medium=digest");
  });

  it("does not normalize the host's URL — a payment link is handed back verbatim", () => {
    // new URL().toString() would turn a bare origin into "https://pay.me/" and
    // re-encode reserved characters. The host's URL is theirs; we only append.
    expect(campaignUrl("https://pay.me", "site", "footer", "support")).toBe(
      "https://pay.me?utm_source=site&utm_medium=footer&utm_campaign=support",
    );
  });
});

describe("the footer's support link is actually tagged", () => {
  // A source grep, like the TopBar and privacy-page tripwires, because the
  // thing that broke here was not logic — it was a call site quietly going
  // out untagged while a deploy guide said otherwise for four days.
  const footer = readFileSync(join(__dirname, "..", "..", "components", "SiteFooter.tsx"), "utf8");

  it("routes SUPPORT.url through campaignUrl rather than using it bare", () => {
    expect(footer).toContain(`campaignUrl(SUPPORT.url, "site", "footer", "support")`);
    expect(footer, "a bare SUPPORT.url href is the untagged bug coming back").not.toMatch(
      /href=\{SUPPORT\.url\}/,
    );
  });
});
