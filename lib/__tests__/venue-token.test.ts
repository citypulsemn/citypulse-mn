import { describe, it, expect } from "vitest";
import {
  makeVenueToken,
  verifyVenueToken,
  venueReportUrl,
  VENUE_REPORT_TTL_DAYS,
} from "../venue-token";
import { makeRestoreToken } from "../restore-token";
import { makeUnsubToken } from "../unsubscribe-token";

const SECRET = "test-secret";
const NOW = new Date("2026-10-29T12:00:00Z");
const SOON = Math.floor(NOW.getTime() / 1000) + 3600;

/**
 * C1's credential. The link IS the login, so these are the only checks
 * standing between a signed URL and someone else's commercial numbers.
 */
describe("venue report tokens", () => {
  it("verifies a token it just minted", () => {
    const t = makeVenueToken("scream-town", SOON, SECRET);
    expect(verifyVenueToken("scream-town", SOON, t, SECRET, NOW)).toBe(true);
  });

  it("rejects the same token pointed at another venue", () => {
    // The whole risk: edit ?v= and read a competitor's numbers.
    const t = makeVenueToken("scream-town", SOON, SECRET);
    expect(verifyVenueToken("first-avenue", SOON, t, SECRET, NOW)).toBe(false);
  });

  it("rejects a tampered expiry, so a link cannot be extended by hand", () => {
    const t = makeVenueToken("scream-town", SOON, SECRET);
    expect(verifyVenueToken("scream-town", SOON + 86_400, t, SECRET, NOW)).toBe(false);
  });

  it("rejects an expired link", () => {
    const past = Math.floor(NOW.getTime() / 1000) - 1;
    const t = makeVenueToken("scream-town", past, SECRET);
    expect(verifyVenueToken("scream-town", past, t, SECRET, NOW)).toBe(false);
  });

  it("rejects a non-numeric expiry instead of throwing", () => {
    // ?exp=lol reaches us as NaN. The page must render the expired notice,
    // not a stack trace.
    const t = makeVenueToken("scream-town", SOON, SECRET);
    expect(verifyVenueToken("scream-town", Number.NaN, t, SECRET, NOW)).toBe(false);
  });

  it("rejects a missing or junk token without throwing on the length compare", () => {
    expect(verifyVenueToken("scream-town", SOON, "", SECRET, NOW)).toBe(false);
    expect(verifyVenueToken("scream-town", SOON, "short", SECRET, NOW)).toBe(false);
    expect(verifyVenueToken("scream-town", SOON, "x".repeat(200), SECRET, NOW)).toBe(false);
  });

  it("rejects an empty venue key", () => {
    const t = makeVenueToken("", SOON, SECRET);
    expect(verifyVenueToken("", SOON, t, SECRET, NOW)).toBe(false);
  });

  it("rejects a token signed with another secret", () => {
    const t = makeVenueToken("scream-town", SOON, "other-secret");
    expect(verifyVenueToken("scream-town", SOON, t, SECRET, NOW)).toBe(false);
  });

  /**
   * The namespace is what lets this share UNSUBSCRIBE_SECRET. If a restore or
   * unsubscribe token ever verified here, the shared key would be a real hole.
   */
  it("cannot be satisfied by a restore or unsubscribe token on the same key", () => {
    expect(verifyVenueToken("42", SOON, makeRestoreToken("42", SOON, SECRET), SECRET, NOW)).toBe(false);
    expect(verifyVenueToken("42", SOON, makeUnsubToken("42", SECRET), SECRET, NOW)).toBe(false);
  });
});

describe("venueReportUrl", () => {
  it("builds a link that verifies, with the TTL baked in", () => {
    const url = venueReportUrl("https://www.citypulsemn.com", "scream-town", SECRET, NOW);
    const u = new URL(url);
    expect(u.pathname).toBe("/venue-report");
    const key = u.searchParams.get("v")!;
    const exp = Number(u.searchParams.get("exp"));
    expect(key).toBe("scream-town");
    expect(exp - Math.floor(NOW.getTime() / 1000)).toBe(VENUE_REPORT_TTL_DAYS * 86_400);
    expect(verifyVenueToken(key, exp, u.searchParams.get("t")!, SECRET, NOW)).toBe(true);
  });

  it("does not double the slash when the site URL has a trailing one", () => {
    expect(venueReportUrl("https://www.citypulsemn.com/", "scream-town", SECRET, NOW))
      .toContain("https://www.citypulsemn.com/venue-report?");
  });
});
