/**
 * Basic-auth helpers for the admin area. Pure and edge-safe (used by
 * middleware.ts and the server actions) — no Node-only APIs.
 */

/** Parse an `Authorization: Basic <base64>` header into { user, pass }. */
export function parseBasicAuth(header: string | null): { user: string; pass: string } | null {
  if (!header || !header.startsWith("Basic ")) return null;
  try {
    const decoded = atob(header.slice(6).trim());
    const i = decoded.indexOf(":");
    if (i < 0) return null;
    return { user: decoded.slice(0, i), pass: decoded.slice(i + 1) };
  } catch {
    return null;
  }
}

/** Length-safe, constant-time-ish string comparison. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Validate credentials against the configured admin user/pass. */
export function checkAuth(
  header: string | null,
  expectedUser: string,
  expectedPass: string,
): boolean {
  const creds = parseBasicAuth(header);
  return (
    !!creds && safeEqual(creds.user, expectedUser) && safeEqual(creds.pass, expectedPass)
  );
}
