"use server";

import { addSubscriber } from "./subscribe";
import { getSaverToken } from "./saver";
import type { SubscribeState } from "./subscribe-types";

// A "use server" module must export ONLY async server actions.
// The SubscribeState type and initial value live in ./subscribe-types.

export async function subscribeAction(
  _prev: SubscribeState,
  formData: FormData,
): Promise<SubscribeState> {
  // Honeypot: bots fill hidden fields. Silently "succeed" without storing.
  if (String(formData.get("company") || "").trim()) {
    return { status: "success", message: "Thanks — you're on the list." };
  }

  const email = String(formData.get("email") || "");
  const source = String(formData.get("source") || "site");
  // ROADMAP 5.3 — read the anonymous saver cookie from THIS browser (if any)
  // so the weekly digest can lead with the subscriber's own saved events.
  const saverToken = await getSaverToken();
  const result = await addSubscriber(email, source, saverToken);

  switch (result) {
    case "added":
      return { status: "success", message: "You're on the list — see you in your inbox." };
    case "resubscribed":
      // R0.5: honest copy — this row was unsubscribed or pending a moment ago.
      return { status: "success", message: "Welcome back — you're on the list again." };
    case "already":
      return { status: "already", message: "You're already subscribed 🎉" };
    case "invalid":
      return { status: "error", message: "Please enter a valid email address." };
    default:
      return { status: "error", message: "Something went wrong — please try again." };
  }
}
