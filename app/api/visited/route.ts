import { getSaverToken } from "@/lib/saver";
import { getVisitedSlugsSafe } from "@/lib/place-visits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lets the statically built places pages hydrate "Been there" state
// client-side without making the pages themselves dynamic (Places P5; the
// 26 Aug CPU fix depends on those pages never rendering per visitor). No
// cookie → an empty list with ZERO database reads, so crawlers and first-time
// visitors cost nothing.
export async function GET() {
  const token = await getSaverToken();
  const slugs = token ? await getVisitedSlugsSafe(token) : [];
  return Response.json({ slugs }, { headers: { "cache-control": "no-store" } });
}
