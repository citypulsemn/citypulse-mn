import { sql } from "./db";

/**
 * Rate limiting on the public write paths (roadmap v5 R2.1).
 *
 * The forcing scenario: a script loops the keep-list form with a victim's
 * email → their inbox fills with restore links, `subscribers` fills with
 * pending rows, and the Resend quota burns. Subscribe and submit allow the
 * same unbounded row creation; the beacon allows unbounded counter spam.
 *
 * Design: no new infra. One Postgres table (`rate_events`) holds a counter
 * per bucket ("subscribe:ip:1.2.3.4", "saved-link:email:a@b.com") with a
 * fixed window that resets IN PLACE when it lapses — a single atomic upsert
 * per check, so two concurrent requests can't both slip under the cap.
 *
 * Failure posture, per the roadmap: FAIL OPEN on database trouble (a
 * rate-limit outage must never take down subscribing — never-break rule),
 * FAIL CLOSED on the limit itself. Honeypots run before any counting, so
 * bot noise the honeypot already eats never inflates a bucket.
 */

export const RATE_LIMITS = {
  /** Restore-link emails per target address — the email-bomb gate. */
  savedLinkPerEmail: { limit: 3, windowMinutes: 60 },
  /** Keep-list requests per caller IP. */
  savedLinkPerIp: { limit: 10, windowMinutes: 60 },
  /** Subscribes per caller IP — generous: one shared venue Wi-Fi during a
   *  promoted event is many real people on one address. */
  subscribePerIp: { limit: 30, windowMinutes: 60 },
  /** Event submissions per caller IP. */
  submitPerIp: { limit: 10, windowMinutes: 60 },
  /** Beacon hits per caller IP. Honest-but-cheap: the beacon's inflatability
   *  is an accepted design note — this just caps the blast radius. */
  beaconPerIp: { limit: 240, windowMinutes: 60 },
} as const;

/** First hop of x-forwarded-for (the client, on Vercel), or "unknown" when
 *  the header is absent (local dev — everyone shares one bucket there). */
export function firstForwardedIp(xff: string | null | undefined): string {
  const first = (xff ?? "").split(",")[0].trim().toLowerCase();
  return first || "unknown";
}

export function ipBucket(path: string, ip: string): string {
  return `${path}:ip:${ip}`;
}

export function emailBucket(path: string, email: string): string {
  return `${path}:email:${email.trim().toLowerCase()}`;
}

/**
 * Count one hit against the bucket and say whether it's still under the cap.
 * True = proceed. One round trip; the window rolls over in place.
 */
export async function rateAllow(
  bucket: string,
  limit: number,
  windowMinutes: number,
  db: typeof sql = sql,
): Promise<boolean> {
  if (!db) return true; // dev without a database — never block
  try {
    const rows = await db<{ n: number }[]>`
      insert into rate_events (bucket, window_start, n)
      values (${bucket}, now(), 1)
      on conflict (bucket) do update set
        n = case
              when rate_events.window_start > now() - make_interval(mins => ${windowMinutes})
              then rate_events.n + 1
              else 1
            end,
        window_start = case
              when rate_events.window_start > now() - make_interval(mins => ${windowMinutes})
              then rate_events.window_start
              else now()
            end
      returning n
    `;
    const n = rows[0]?.n;
    return typeof n === "number" ? n <= limit : true;
  } catch (err) {
    // Fail open: a broken instrument must not kill its panel (rule 1).
    console.error("[rate-limit] check failed — failing open:", err);
    return true;
  }
}

/** Drop buckets idle for 2+ days (every window is ≤ 1 hour). The weekly
 *  pipeline calls this so the table can't accumulate one row per IP forever. */
export async function pruneRateEvents(db: typeof sql = sql): Promise<number> {
  if (!db) return 0;
  try {
    const res = await db`
      delete from rate_events where window_start < now() - interval '2 days'
    `;
    return res.count ?? 0;
  } catch (err) {
    console.error("[rate-limit] prune failed (non-fatal):", err);
    return 0;
  }
}
