"use server";

import { headers } from "next/headers";
import { addSubscriber, normalizeEmail } from "./subscribe";
import { getSaverToken } from "./saver";
import { rateAllow, ipBucket, emailBucket, firstForwardedIp, RATE_LIMITS } from "./rate-limit";
import { confirmUrl } from "./confirm-token";
import { sendConfirmEmail } from "./confirm-send";
import { unsubSecret } from "./unsubscribe-token";
import { SITE_URL } from "./seo/site";
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

  // R2.1 — per-IP cap, checked AFTER the honeypot so bot noise it already
  // eats never counts. Unlike the keep-list path this failure is HONEST: a
  // silently dropped subscriber thinks they're on the list and never retries.
  const ip = firstForwardedIp((await headers()).get("x-forwarded-for"));
  const perIp = RATE_LIMITS.subscribePerIp;
  if (!(await rateAllow(ipBucket("subscribe", ip), perIp.limit, perIp.windowMinutes))) {
    return {
      status: "error",
      message: "A lot of signups from this network right now — please try again in a bit.",
    };
  }

  const email = String(formData.get("email") || "");
  const source = String(formData.get("source") || "site");
  // ROADMAP 5.3 — read the anonymous saver cookie from THIS browser (if any)
  // so the weekly digest can lead with the subscriber's own saved events.
  const saverToken = await getSaverToken();
  const { result, id } = await addSubscriber(email, source, saverToken);

  switch (result) {
    case "added":
      return { status: "success", message: "You're on the list — see you in your inbox." };
    case "resubscribed":
      // R0.5: honest copy — this row was pending (kept a list) a moment ago.
      return { status: "success", message: "Welcome back — you're on the list again." };
    case "reconfirm": {
      // F2.3 — they explicitly unsubscribed before, so we DON'T mail them again
      // on trust: send a one-click confirm link and wait. Per-target-email cap
      // (mirrors the keep-list email-bomb guard) so this can't be looped at a
      // victim who opted out; over the cap we show the same check-inbox message
      // (they already have earlier links) and send nothing.
      if (id == null) {
        return { status: "error", message: "Something went wrong — please try again." };
      }
      const target = normalizeEmail(email);
      const cap = RATE_LIMITS.savedLinkPerEmail; // 3/hour/address
      const underCap = await rateAllow(emailBucket("subscribe-confirm", target), cap.limit, cap.windowMinutes);
      const sent = underCap
        ? await sendConfirmEmail(target, confirmUrl(SITE_URL, id, unsubSecret()))
        : true; // throttled: pretend-sent, stay generic
      return sent
        ? {
            status: "success",
            message: "You unsubscribed before — check your inbox to confirm you're back on the list.",
          }
        : {
            status: "error",
            message: "We couldn't send the confirmation email just now — mind trying again in a minute?",
          };
    }
    case "already":
      return { status: "already", message: "You're already subscribed 🎉" };
    case "invalid":
      return { status: "error", message: "Please enter a valid email address." };
    default:
      return { status: "error", message: "Something went wrong — please try again." };
  }
}
