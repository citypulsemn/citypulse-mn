import { getSaverToken } from "@/lib/saver";
import { getSavedEventIds } from "@/lib/saved";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lets the (statically cached) homepage hydrate save-state client-side without
// making the page itself dynamic.
export async function GET() {
  const token = await getSaverToken();
  const ids = token ? await getSavedEventIds(token) : [];
  return Response.json({ ids }, { headers: { "cache-control": "no-store" } });
}
