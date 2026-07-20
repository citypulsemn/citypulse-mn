import { getEvents } from "@/lib/events";
import { resolveFeed, selectFeedEvents } from "@/lib/feeds";
import { feedICS } from "@/lib/ics";
import { SITE_URL } from "@/lib/seo/site";

// On-demand + revalidate, never build-time (standing rule 2). An hour is
// right for a subscription feed: calendar apps poll on their own schedule
// (typically every few hours), and event data changes mostly weekly.
export const runtime = "nodejs";
export const revalidate = 3600;

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const feed = resolveFeed(slug);
  if (!feed) {
    return new Response("Not found", { status: 404 });
  }

  const events = await getEvents();
  const selected = selectFeedEvents(events, feed, new Date());
  const ics = feedICS(feed.name, selected, { baseUrl: SITE_URL });

  return new Response(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      // inline (no attachment disposition): this URL is meant to be handed to
      // a calendar app as a subscription, not downloaded once.
      "cache-control": "public, max-age=3600",
    },
  });
}
