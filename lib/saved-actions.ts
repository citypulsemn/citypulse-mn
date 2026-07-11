"use server";

import { revalidatePath } from "next/cache";
import { ensureSaverToken } from "./saver";
import { isSaved, saveEvent, unsaveEvent, isValidUuid } from "./saved";

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
  revalidatePath("/saved");
  return nowSaved;
}
