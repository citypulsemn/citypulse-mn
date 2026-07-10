import { getEvent } from "@/lib/events";
import { eventToICS } from "@/lib/ics";
import { SITE_URL } from "@/lib/seo/site";

export const runtime = "nodejs";
export const revalidate = 300;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const event = await getEvent(id); // published/archived/cancelled; draft → null

  if (!event) {
    return new Response("Not found", { status: 404 });
  }

  const ics = eventToICS(event, { baseUrl: SITE_URL });
  return new Response(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="citypulse-${event.id}.ics"`,
      "cache-control": "public, max-age=300",
    },
  });
}
