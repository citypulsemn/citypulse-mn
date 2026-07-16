"use server";

import { requestSavedLink } from "./saved-restore";
import type { SubscribeState } from "./subscribe-types";

/**
 * "Keep this list" action (roadmap 5.4). Same honeypot pattern as the
 * subscribe form, and the same NO-ENUMERATION rule: the success message is
 * identical whether or not an email exists in the system — the only
 * user-visible failures are a bad address or an empty list.
 */
export async function requestSavedLinkAction(
  _prev: SubscribeState,
  formData: FormData,
): Promise<SubscribeState> {
  // Honeypot: bots fill hidden fields. Silently "succeed" without storing.
  if (String(formData.get("company") || "").trim()) {
    return { status: "success", message: "Check your inbox — your link is on the way." };
  }

  const email = String(formData.get("email") || "");
  const result = await requestSavedLink(email);

  switch (result) {
    case "sent":
      return { status: "success", message: "Check your inbox — your link is on the way." };
    case "nothing_to_keep":
      return { status: "error", message: "Save an event first — then you'll have a list to keep." };
    case "invalid":
    default:
      return { status: "error", message: "That email doesn't look right — mind checking it?" };
  }
}
