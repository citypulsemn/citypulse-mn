import { parseBeacon, recordStat } from "@/lib/stats";
import { parseFeedBeacon, recordFeedClick } from "@/lib/feed-stats";
import { rateAllow, ipBucket, firstForwardedIp, RATE_LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * First-party analytics beacon (roadmap 5.1). Two payload shapes:
 *   {id, action}   — an event stat (view / ticket_click / calendar)
 *   {feed, source} — a feed-adoption click (F2.5)
 * ('save' is counted inside the save server-action, never here.)
 *
 * Always answers 204: a beacon must never surface an error to the page, and a
 * uniform response gives probes nothing to learn from. Invalid payloads are
 * dropped by the parsers; unknown ids/slugs never create rows.
 */
export async function POST(req: Request) {
  try {
    const raw = await req.json();
    const beacon = parseBeacon(raw);
    const feed = beacon ? null : parseFeedBeacon(raw);
    // R2.1 — per-IP cap, checked only for beacons that PARSE (junk POSTs
    // shouldn't cost a counter write). Over the cap: drop, same 204. The
    // response never varies, so the cap is invisible from outside.
    if (beacon || feed) {
      const ip = firstForwardedIp(req.headers.get("x-forwarded-for"));
      const perIp = RATE_LIMITS.beaconPerIp;
      if (await rateAllow(ipBucket("beacon", ip), perIp.limit, perIp.windowMinutes)) {
        if (beacon) await recordStat(beacon.id, beacon.action);
        else if (feed) await recordFeedClick(feed.slug, feed.source);
      }
    }
  } catch {
    // malformed JSON, aborted body — drop it
  }
  return new Response(null, { status: 204 });
}
