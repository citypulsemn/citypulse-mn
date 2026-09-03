"use server";

import { ensureSaverToken } from "./saver";
import { isVisited, markVisited, unmarkVisited, isValidPlaceSlug } from "./place-visits";

/**
 * Toggle whether the current visitor has checked a place off ("Been there",
 * Places P5). Creates the anonymous saver cookie on first use — the same
 * identity as saved events, so one keep-list link carries both. Returns the
 * new visited state. No revalidatePath: /saved is force-dynamic already.
 */
export async function toggleVisitAction(slug: string): Promise<boolean> {
  if (!isValidPlaceSlug(slug)) return false;
  const token = await ensureSaverToken();
  const currently = await isVisited(token, slug);
  return currently ? unmarkVisited(token, slug) : markVisited(token, slug);
}
