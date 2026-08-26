import { revalidatePath, revalidateTag } from "next/cache";
import { EVENTS_TAG } from "@/lib/events";
import { checkRevalidateAuth, parseRevalidateBody, AUTH_HEADER } from "@/lib/revalidate-auth";

/**
 * POST /api/revalidate — bust the caches from outside the app.
 *
 * The scripts that change what the public sees (the Monday pipeline, the verify
 * pass's cancellations, the importers, the bulk hide/dedupe tools) run outside
 * Next and cannot call `revalidateTag`. This is their door in. See
 * `lib/revalidate-auth.ts` for why it exists and `docs/REVALIDATION.md` for the
 * operational side.
 *
 * Mirrors `refresh()` in lib/admin-actions.ts deliberately — the same two layers
 * in the same order. If that helper ever changes, this must change with it, and
 * a test asserts they stay in step.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const auth = checkRevalidateAuth(
    req.headers.get(AUTH_HEADER),
    process.env.REVALIDATE_SECRET,
  );
  if (!auth.ok) {
    // Never echo the token or the secret — just why it was refused.
    console.warn(`[revalidate] refused: ${auth.reason}`);
    return json({ ok: false, error: auth.reason }, auth.status);
  }

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    // An empty body is the normal case: "bust everything."
  }
  const { eventIds, reason } = parseRevalidateBody(body);

  // Two layers must both clear, or the pages re-render and re-read a stale
  // getEvents() array — the same trap documented in admin-actions' refresh().
  revalidateTag(EVENTS_TAG);
  revalidatePath("/", "layout");
  for (const id of eventIds) revalidatePath(`/event/${id}`);

  console.log(
    `[revalidate] ok — tag + tree${eventIds.length ? ` + ${eventIds.length} event page(s)` : ""} · reason: ${reason}`,
  );

  return json({ ok: true, tag: EVENTS_TAG, tree: "/", eventIds: eventIds.length, reason }, 200);
}

/** GET exists only to say "use POST" — it never revalidates, so a crawler or a
 *  prefetch cannot dump the cache by following a link. */
export async function GET(): Promise<Response> {
  return json({ ok: false, error: "POST with an Authorization: Bearer header" }, 405);
}

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
