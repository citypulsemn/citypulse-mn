import { timingSafeEqual } from "node:crypto";

/**
 * ON-DEMAND REVALIDATION — the auth half, pure and unit-tested.
 *
 * Why this exists: the site's freshness has always come from short ISR windows,
 * because the only thing that could bust a cache was `refresh()` in
 * `lib/admin-actions.ts` — a server action, reachable only from the admin UI.
 * Everything else that changes what the public sees runs as a SCRIPT: the Monday
 * pipeline, the verify pass's evidence-gated cancellations, the importers, the
 * bulk hide/dedupe tools. None of them can call `revalidateTag`.
 *
 * That gap has a recorded cost. From `HOTFIX-sports-phantom-games.md`, after 26
 * phantom listings were hidden by script: "Vercel's cache was not busted by
 * refresh(). A deploy was pushed immediately after to clear it — otherwise the
 * hidden games would have sat on cached pages for up to the 1-hour window."
 * Pushing an empty deploy to clear a cache is not a mechanism, it is a workaround.
 *
 * It also has a running cost. Short TTLs across 2,198 sitemap URLs, crawled about
 * once a day, meant every crawl found every page stale and paid for a full
 * re-render: 80,539 ISR writes in 30 days against 3,464 human page views, and
 * Fluid Active CPU 4h16m over a 4h allowance (26 Aug 2026).
 *
 * With a real bust-on-write channel, freshness stops being a function of TTL and
 * the TTLs can grow. This module is the gate on that channel.
 */

/** Header the caller presents. Bearer, not a query param: URLs get logged. */
export const AUTH_HEADER = "authorization";

export type AuthResult =
  | { ok: true }
  | { ok: false; status: 401 | 503; reason: string };

/**
 * Check a request's bearer token against the configured secret.
 *
 * FAILS CLOSED when no secret is configured — mirroring `middleware.ts`, which
 * denies the admin area outright when `ADMIN_PASSWORD` is unset. An endpoint
 * that dumps every cache is not something to leave open because an env var went
 * missing. 503 rather than 401 so a misconfigured deploy is distinguishable in
 * the logs from a caller with the wrong key.
 */
export function checkRevalidateAuth(
  header: string | null,
  secret: string | undefined,
): AuthResult {
  if (!secret || secret.trim().length === 0) {
    return { ok: false, status: 503, reason: "REVALIDATE_SECRET is not configured" };
  }
  if (!header) return { ok: false, status: 401, reason: "missing Authorization header" };

  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!m) return { ok: false, status: 401, reason: "expected 'Bearer <token>'" };

  const got = Buffer.from(m[1]);
  const want = Buffer.from(secret);
  // timingSafeEqual throws on a length mismatch, so compare lengths first — and
  // still run the comparison on equal-length input rather than returning early.
  if (got.length !== want.length) return { ok: false, status: 401, reason: "bad token" };
  return timingSafeEqual(got, want) ? { ok: true } : { ok: false, status: 401, reason: "bad token" };
}

export interface RevalidateRequest {
  /** Event ids to bust individually, on top of the shared tag + tree. */
  eventIds: string[];
  /** Free-text label for the log — which script asked, and why. */
  reason: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Bounded so a malformed caller cannot make one request do unbounded work. */
export const MAX_EVENT_IDS = 200;

/**
 * Parse a request body into a revalidation instruction.
 *
 * Total by default: an empty/absent body means "bust the shared tag and the
 * public tree", which is what every script actually wants. `eventIds` is an
 * addition, never a restriction — a caller cannot ask for LESS than the tag,
 * because a partial bust is the failure mode that leaves a hidden event on a
 * city page.
 */
export function parseRevalidateBody(body: unknown): RevalidateRequest {
  const o = (body ?? {}) as Record<string, unknown>;
  const rawIds = Array.isArray(o.eventIds) ? o.eventIds : [];
  const eventIds = rawIds
    .filter((v): v is string => typeof v === "string" && UUID.test(v.trim()))
    .map((v) => v.trim())
    .slice(0, MAX_EVENT_IDS);
  const reason =
    typeof o.reason === "string" && o.reason.trim().length > 0
      ? o.reason.trim().slice(0, 120)
      : "unspecified";
  return { eventIds, reason };
}
