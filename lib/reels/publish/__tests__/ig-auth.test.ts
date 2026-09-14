import { describe, expect, it } from "vitest";
import {
  IG_SCOPES,
  REDIRECT_URI,
  buildAuthUrl,
  buildCodeExchangeRequest,
  buildLongLivedUrl,
  buildToken,
  parseRedirectInput,
} from "../../../../scripts/reels/ig-auth";

describe("ig-auth: buildAuthUrl", () => {
  it("golden: exact authorize URL with encoded redirect and both scopes", () => {
    expect(buildAuthUrl("1234", REDIRECT_URI)).toBe(
      "https://www.instagram.com/oauth/authorize" +
        "?client_id=1234" +
        "&redirect_uri=https%3A%2F%2Flocalhost%2F" +
        "&response_type=code" +
        "&scope=instagram_business_basic,instagram_business_content_publish",
    );
  });

  it("scope constant carries exactly the two publish scopes", () => {
    expect(IG_SCOPES).toBe("instagram_business_basic,instagram_business_content_publish");
  });
});

describe("ig-auth: parseRedirectInput", () => {
  it("extracts the code from the full redirected URL and drops the '#_' suffix", () => {
    expect(parseRedirectInput("https://localhost/?code=AQBxCode123#_")).toBe("AQBxCode123");
  });

  it("finds code= among other query params", () => {
    expect(parseRedirectInput("https://localhost/?state=x&code=abc-DEF_123&foo=1#_")).toBe(
      "abc-DEF_123",
    );
  });

  it("accepts a pasted query fragment starting at code=", () => {
    expect(parseRedirectInput("code=abc123#_")).toBe("abc123");
  });

  it("accepts the bare code, trimmed, with or without the '#_' Instagram appends", () => {
    expect(parseRedirectInput("  AQBxCode123  ")).toBe("AQBxCode123");
    expect(parseRedirectInput("AQBxCode123#_")).toBe("AQBxCode123");
  });

  it("honest emptiness: blank paste throws, it does not invent a code", () => {
    expect(() => parseRedirectInput("   ")).toThrow(/Nothing pasted/);
  });

  it("a URL without code= (e.g. a denial) throws a clear error", () => {
    expect(() => parseRedirectInput("https://localhost/?error=access_denied#_")).toThrow(
      /Couldn't find code=/,
    );
  });
});

describe("ig-auth: token-exchange builders", () => {
  it("golden: form-encoded code exchange against api.instagram.com", () => {
    const req = buildCodeExchangeRequest("id1", "sec1", REDIRECT_URI, "abc");
    expect(req.url).toBe("https://api.instagram.com/oauth/access_token");
    expect(req.body).toBe(
      "client_id=id1&client_secret=sec1&grant_type=authorization_code" +
        "&redirect_uri=https%3A%2F%2Flocalhost%2F&code=abc",
    );
  });

  it("golden: long-lived exchange URL on graph.instagram.com", () => {
    expect(buildLongLivedUrl("sec1", "short-tok")).toBe(
      "https://graph.instagram.com/access_token?grant_type=ig_exchange_token" +
        "&client_secret=sec1&access_token=short-tok",
    );
  });

  it("buildToken starts both clocks at the same instant, matching IgToken", () => {
    const token = buildToken("tok", "178414", "citypulsempls", new Date("2026-08-27T12:00:00Z"));
    expect(token).toEqual({
      accessToken: "tok",
      igUserId: "178414",
      username: "citypulsempls",
      obtainedAt: "2026-08-27T12:00:00.000Z",
      lastRefreshedAt: "2026-08-27T12:00:00.000Z",
    });
  });
});
