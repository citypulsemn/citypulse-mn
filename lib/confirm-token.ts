import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * RESUBSCRIBE CONFIRMATION (roadmap v5 F2.3) — token layer.
 *
 * Policy (Taren's call, Jul 21): new signups stay single opt-in, but someone
 * who EXPLICITLY unsubscribed and later resubscribes must click a confirmation
 * link before they're mailed again — you left on purpose, so coming back is
 * deliberate. This also blunts a malicious re-add of a victim who opted out.
 *
 * Mirrors the restore-token pattern (stateless HMAC, id not email in the URL)
 * with the same two deliberate properties:
 *   1. A DISTINCT PURPOSE NAMESPACE ("subscribe-confirm:") in the HMAC input,
 *      so an unsubscribe/restore token can never be replayed as a confirm one.
 *   2. AN EXPIRY baked into the signed input — a confirm link changes state
 *      (pending → subscribed), so it's a bearer credential and gets a TTL.
 *      Generous (14d): a returning reader shouldn't lose their spot to a slow
 *      inbox, and the worst case is re-subscribing someone who asked to return.
 */

export const CONFIRM_TTL_DAYS = 14;

export function makeConfirmToken(id: number | string, expUnix: number, secret: string): string {
  return createHmac("sha256", secret)
    .update(`subscribe-confirm:${id}:${expUnix}`)
    .digest("base64url");
}

export function verifyConfirmToken(
  id: number | string,
  expUnix: number,
  token: string,
  secret: string,
  now: Date = new Date(),
): boolean {
  if (!Number.isFinite(expUnix)) return false;
  if (Math.floor(now.getTime() / 1000) > expUnix) return false; // expired
  const expected = Buffer.from(makeConfirmToken(id, expUnix, secret));
  const got = Buffer.from(token ?? "");
  if (expected.length !== got.length) return false;
  return timingSafeEqual(expected, got);
}

/** The link that goes in the "confirm you're back" email. */
export function confirmUrl(
  siteUrl: string,
  id: number | string,
  secret: string,
  now: Date = new Date(),
): string {
  const exp = Math.floor(now.getTime() / 1000) + CONFIRM_TTL_DAYS * 86_400;
  return `${siteUrl}/subscribe/confirm?id=${id}&exp=${exp}&t=${makeConfirmToken(id, exp, secret)}`;
}
