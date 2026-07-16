import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * SAVED-LIST MAGIC LINKS (roadmap 5.4) — token layer.
 *
 * Mirrors the unsubscribe-token pattern (stateless HMAC, id not email in the
 * URL) with two deliberate differences:
 *
 *  1. A DISTINCT PURPOSE NAMESPACE ("saved-restore:") inside the HMAC input,
 *     so an unsubscribe token can never be replayed as a restore token or
 *     vice versa, even though both use the same secret.
 *  2. AN EXPIRY, baked into the signed input. An unsubscribe link may live
 *     forever (worst case: you unsubscribe). A restore link is a bearer
 *     credential that CHANGES state on whatever device opens it — it gets
 *     7 days, then dies.
 */

export const RESTORE_TTL_DAYS = 7;

export function makeRestoreToken(id: number | string, expUnix: number, secret: string): string {
  return createHmac("sha256", secret)
    .update(`saved-restore:${id}:${expUnix}`)
    .digest("base64url");
}

export function verifyRestoreToken(
  id: number | string,
  expUnix: number,
  token: string,
  secret: string,
  now: Date = new Date(),
): boolean {
  if (!Number.isFinite(expUnix)) return false;
  if (Math.floor(now.getTime() / 1000) > expUnix) return false; // expired
  const expected = Buffer.from(makeRestoreToken(id, expUnix, secret));
  const got = Buffer.from(token ?? "");
  if (expected.length !== got.length) return false;
  return timingSafeEqual(expected, got);
}

/** The link that goes in the email. */
export function restoreUrl(
  siteUrl: string,
  id: number | string,
  secret: string,
  now: Date = new Date(),
): string {
  const exp = Math.floor(now.getTime() / 1000) + RESTORE_TTL_DAYS * 86_400;
  return `${siteUrl}/saved/restore?id=${id}&exp=${exp}&t=${makeRestoreToken(id, exp, secret)}`;
}
