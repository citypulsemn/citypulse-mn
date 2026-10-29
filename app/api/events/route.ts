import { NextResponse } from "next/server";
import { getEvents } from "@/lib/events";
import { API_EVENTS_LIMIT } from "@/lib/api-events";

// On-demand + revalidate, never build-time (standing rule 2).
export const revalidate = 300;

/**
 * Operator convenience, not a public API — see lib/api-events.ts for what this
 * is for and why it is capped.
 *
 * No request parameter is read, deliberately: the moment this handler touches
 * `searchParams` the route stops being prerenderable, and every distinct query
 * string becomes its own cache key and its own function invocation. A `?limit=`
 * worth 20 more rows is not worth handing anyone an unbounded invocation knob
 * on a project that has already run up a compute overage.
 *
 * `count` is always the honest full total, so the SETUP.md smoke check ("YOUR
 * events, not the 30 samples") still reads true while the body stays small.
 */
export async function GET() {
  const events = await getEvents();

  return NextResponse.json(
    {
      count: events.length,
      returned: Math.min(API_EVENTS_LIMIT, events.length),
      events: events.slice(0, API_EVENTS_LIMIT),
    },
    {
      headers: {
        // Let the CDN actually hold it. The old response said
        // `max-age=0, must-revalidate`, so every caller re-ran the route.
        "cache-control": "public, s-maxage=300, stale-while-revalidate=600",
        // Match robots.txt, which already disallows /api/.
        "x-robots-tag": "noindex",
      },
    },
  );
}
