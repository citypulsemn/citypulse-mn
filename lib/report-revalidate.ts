import { revalidatePath, revalidateTag } from "next/cache";
import { EVENTS_TAG } from "./events";

/**
 * Clear the caches after an emailed report decision.
 *
 * This runs INSIDE the app, so it can call `revalidateTag` directly — unlike the
 * scripts, which have to go through `/api/revalidate`. It mirrors `refresh()` in
 * lib/admin-actions.ts: both layers, or the pages re-render and re-read a stale
 * `getEvents()` array and the hidden listing stays visible.
 *
 * ENGINEERING rule 1: the decision is already committed when this is called, so
 * a cache failure must never surface as an error. Worst case the listing sits on
 * a cached page until its ISR window expires.
 */
export async function revalidateReportDecision(
  eventId: string,
  action: "delete" | "keep",
): Promise<void> {
  // Keeping a listing changes nothing a reader can see, so there is nothing to
  // clear — and busting the whole public tree for a no-op would cost a full
  // re-render of every page for no reason.
  if (action !== "delete") return;
  try {
    revalidateTag(EVENTS_TAG);
    revalidatePath("/", "layout");
    revalidatePath(`/event/${eventId}`);
  } catch (err) {
    console.warn("[report-action] revalidation failed; caches will expire on their own:", err);
  }
}
