"use server";

import { addSubscriber } from "./subscribe";

export interface SubscribeState {
  status: "idle" | "success" | "already" | "error";
  message: string;
}

export const initialSubscribeState: SubscribeState = { status: "idle", message: "" };

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
  const result = await addSubscriber(email, source);

  switch (result) {
    case "added":
      return { status: "success", message: "You're on the list — see you in your inbox." };
    case "already":
      return { status: "already", message: "You're already subscribed 🎉" };
    case "invalid":
      return { status: "error", message: "Please enter a valid email address." };
    default:
      return { status: "error", message: "Something went wrong — please try again." };
  }
}
