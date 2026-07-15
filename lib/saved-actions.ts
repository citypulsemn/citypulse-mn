"use server";

import { revalidatePath } from "next/cache";
import { ensureSaverToken } from "./saver";
import { isSaved, saveEvent, unsaveEvent, isValidUuid } from "./saved";
import { recordStat } from "./stats";

/**
 * Toggle whether the current visitor has saved an event. Creates the anonymous
 * cookie on first save. Returns the new saved state.
 */
export async function toggleSaveAction(eventId: string): Promise<boolean> {
  if (!isValidUuid(eventId)) return false;
  const token = await ensureSaverToken();
  const currently = await isSaved(token, eventId);
  const nowSaved = currently
    ? await unsaveEvent(token, eventId)
    : await saveEvent(token, eventId);
  // Roadmap 5.1 — saves are counted ONLY here, inside the server action (the
  // public beacon rejects 'save'), so this metric can't be inflated with curl.
  // Adds only; un-saving isn't an engagement signal worth charting.
  if (!currently && nowSaved) void recordStat(eventId, "save");
  revalidatePath("/saved");
  return nowSaved;
}
