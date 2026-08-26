import { SITE_URL } from "./seo/site";

/**
 * The script side of on-demand revalidation.
 *
 * ENGINEERING RULE 1 (never-break contract): a script's job is to get the data
 * right. Busting a cache is the aux path, and a broken instrument must not kill
 * its panel — so this NEVER throws and NEVER changes an exit code. A pipeline
 * that imported 305 events correctly has succeeded even if the CDN keeps serving
 * yesterday's page for another hour.
 *
 * But it must be LOUD, because the whole point of this channel is that longer
 * ISR windows become safe once it works. Silence here would mean stale
 * cancellations sitting behind a long TTL with nothing saying so.
 */

export interface RevalidateOutcome {
  ok: boolean;
  /** Why it did not happen, for the log. Absent when ok. */
  reason?: string;
  status?: number;
}

/** Where to POST. Overridable so a local run can hit its own dev server. */
function endpoint(): string {
  const base = (process.env.REVALIDATE_URL || process.env.SITE_URL || SITE_URL).replace(/\/+$/, "");
  return `${base}/api/revalidate`;
}

/**
 * Ask the site to drop its caches. Returns an outcome; callers log it.
 *
 * `eventIds` is an addition to the always-total tag bust, not a filter — see
 * parseRevalidateBody. Pass them when specific event PAGES changed (a
 * cancellation), skip them for bulk work.
 */
export async function revalidateSite(
  reason: string,
  eventIds: string[] = [],
  { timeoutMs = 15_000 }: { timeoutMs?: number } = {},
): Promise<RevalidateOutcome> {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || secret.trim().length === 0) {
    return { ok: false, reason: "REVALIDATE_SECRET is not set" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(endpoint(), {
      method: "POST",
      headers: {
        authorization: `Bearer ${secret}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ reason, eventIds }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, status: res.status, reason: text.slice(0, 200) || res.statusText };
    }
    return { ok: true, status: res.status };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Call it and say what happened, in one line, without ever throwing.
 *
 * The failure line is a ⚠ and names the reason, because a silent no-op here is
 * exactly what would let a cancelled event sit behind a long TTL.
 */
export async function revalidateAndReport(
  tag: string,
  reason: string,
  eventIds: string[] = [],
): Promise<RevalidateOutcome> {
  const out = await revalidateSite(reason, eventIds);
  if (out.ok) {
    console.log(`[${tag}] ↻ site caches cleared${eventIds.length ? ` (+${eventIds.length} event page(s))` : ""}`);
  } else {
    console.warn(
      `[${tag}] ⚠ revalidation did NOT happen: ${out.reason}` +
        ` — pages may serve stale content until their ISR window expires`,
    );
  }
  return out;
}
