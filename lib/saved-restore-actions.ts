"use server";

import { headers } from "next/headers";
import { requestSavedLink } from "./saved-restore";
import { rateAllow, ipBucket, firstForwardedIp, RATE_LIMITS } from "./rate-limit";
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

  // R2.1 — per-IP cap, checked AFTER the honeypot (honeypot bots never count)
  // and answered with the same generic success as everything else on this
  // path: throttling is part of the no-enumeration surface here.
  const ip = firstForwardedIp((await headers()).get("x-forwarded-for"));
  const perIp = RATE_LIMITS.savedLinkPerIp;
  if (!(await rateAllow(ipBucket("saved-link", ip), perIp.limit, perIp.windowMinutes))) {
    return { status: "success", message: "Check your inbox — your link is on the way." };
  }

  const email = String(formData.get("email") || "");
  const result = await requestSavedLink(email);

  switch (result) {
    case "sent":
      return { status: "success", message: "Check your inbox — your link is on the way." };
    case "nothing_to_keep":
      return { status: "error", message: "Save an event first — then you'll have a list to keep." };
    case "send_failed":
      return { status: "error", message: "We couldn't send the email just now — mind trying again in a minute?" };
    case "invalid":
    default:
      return { status: "error", message: "That email doesn't look right — mind checking it?" };
  }
}
