import { parseBeacon, recordStat } from "@/lib/stats";
import { rateAllow, ipBucket, firstForwardedIp, RATE_LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * First-party analytics beacon (roadmap 5.1). Accepts {id, action} for the
 * public actions only ('save' is counted inside the save server-action).
 *
 * Always answers 204: a beacon must never surface an error to the page, and a
 * uniform response gives probes nothing to learn from. Invalid payloads are
 * simply dropped by parseBeacon; unknown-but-valid UUIDs die on the foreign
 * key inside recordStat's swallow.
 */
export async function POST(req: Request) {
  try {
    const raw = await req.json();
    const beacon = parseBeacon(raw);
    // R2.1 — per-IP cap, checked only for beacons that parse (junk POSTs
    // shouldn't cost a counter write). Over the cap: drop, same 204. The
    // response never varies, so the cap is invisible from outside.
    if (beacon) {
      const ip = firstForwardedIp(req.headers.get("x-forwarded-for"));
      const perIp = RATE_LIMITS.beaconPerIp;
      if (await rateAllow(ipBucket("beacon", ip), perIp.limit, perIp.windowMinutes)) {
        await recordStat(beacon.id, beacon.action);
      }
    }
  } catch {
    // malformed JSON, aborted body — drop it
  }
  return new Response(null, { status: 204 });
}
