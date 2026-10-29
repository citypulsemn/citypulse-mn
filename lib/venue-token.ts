import { createHmac, timingSafeEqual } from "node:crypto";
import { envOr } from "./env";

/**
 * VENUE REPORT MAGIC LINKS (Monetization C1) — token layer.
 *
 * The fifth module in this shape (unsubscribe, restore, confirm, report), and
 * deliberately the same shape rather than a new idea: stateless HMAC over a
 * namespaced message, no table, no session, no account. A venue gets a URL in
 * an email and the URL is the credential.
 *
 * THE NAMESPACE ("venue-report:") is what makes sharing the secret safe. No
 * unsubscribe, restore, confirm or take-it-down token can be replayed as a
 * venue report, or the reverse, because the signed message differs even when
 * the key does not.
 *
 * IT HAS AN EXPIRY even though it changes nothing. The other read-only link on
 * the site (unsubscribe) lives forever because the worst case is unsubscribing.
 * Here the worst case is that a forwarded link gives a stranger a permanent
 * read on one business's traffic with us. Not sensitive, not personal — the
 * stats table holds no user identifiers by schema — but it is commercial
 * information we do not publish, so it gets a life. 90 days: long enough that a
 * venue can bookmark it for a quarter, short enough that a link in a forwarded
 * thread stops working.
 *
 * SECRET SHARING, same argument as report-token: prefer VENUE_REPORT_SECRET,
 * fall back to UNSUBSCRIBE_SECRET so the feature works the day it ships. This
 * project's record on unset env vars is the reason — REVALIDATE_SECRET was
 * unset for two months and the channel it gated was silently dead.
 */

export const VENUE_REPORT_TTL_DAYS = 90;

export function venueReportSecret(): string {
  return envOr("citypulse-dev-venue-secret", "VENUE_REPORT_SECRET", "UNSUBSCRIBE_SECRET");
}

export function makeVenueToken(key: string, expUnix: number, secret: string): string {
  return createHmac("sha256", secret).update(`venue-report:${key}:${expUnix}`).digest("base64url");
}

export function verifyVenueToken(
  key: string,
  expUnix: number,
  token: string,
  secret: string,
  now: Date = new Date(),
): boolean {
  if (!key) return false;
  if (!Number.isFinite(expUnix)) return false;
  if (Math.floor(now.getTime() / 1000) > expUnix) return false; // expired
  const expected = Buffer.from(makeVenueToken(key, expUnix, secret));
  const got = Buffer.from(token ?? "");
  // timingSafeEqual throws on a length mismatch, so compare lengths first.
  if (expected.length !== got.length) return false;
  return timingSafeEqual(expected, got);
}

/** The link that goes in the email to a venue. */
export function venueReportUrl(
  siteUrl: string,
  key: string,
  secret: string,
  now: Date = new Date(),
): string {
  const base = siteUrl.replace(/\/+$/, "");
  const exp = Math.floor(now.getTime() / 1000) + VENUE_REPORT_TTL_DAYS * 86_400;
  return `${base}/venue-report?v=${encodeURIComponent(key)}&exp=${exp}&t=${makeVenueToken(key, exp, secret)}`;
}
