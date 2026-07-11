import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Stateless one-click unsubscribe tokens (roadmap 3.1). The token is an
 * HMAC-SHA256 over the subscriber id, so the link is unforgeable without the
 * secret and nothing extra needs storing. The id (not the email) travels in the
 * URL to keep PII out of it.
 */

export function unsubSecret(): string {
  return process.env.UNSUBSCRIBE_SECRET ?? "citypulse-dev-unsub-secret";
}

export function makeUnsubToken(id: number | string, secret: string): string {
  return createHmac("sha256", secret).update(`unsub:${id}`).digest("base64url");
}

export function verifyUnsubToken(id: number | string, token: string, secret: string): boolean {
  const expected = Buffer.from(makeUnsubToken(id, secret));
  const got = Buffer.from(token ?? "");
  if (expected.length !== got.length) return false;
  return timingSafeEqual(expected, got);
}

export function unsubscribeUrl(siteUrl: string, id: number | string, secret: string): string {
  return `${siteUrl}/unsubscribe?id=${id}&t=${makeUnsubToken(id, secret)}`;
}
