"use server";

import { headers } from "next/headers";
import { validateSubmission, addSubmission, type SubmissionInput } from "./submissions";
import { rateAllow, ipBucket, firstForwardedIp, RATE_LIMITS } from "./rate-limit";
import type { SubmitState } from "./submit-types";

// A "use server" module must export ONLY async server actions.
// State type + initial value live in ./submit-types.

export async function submitEventAction(
  _prev: SubmitState,
  formData: FormData,
): Promise<SubmitState> {
  // Honeypot: bots fill hidden fields. Silently "succeed" without storing.
  if (String(formData.get("company") || "").trim()) {
    return { status: "success", message: "Thanks — we'll take a look!" };
  }

  // R2.1 — per-IP cap, after the honeypot. Honest error: someone typing in
  // real submissions deserves to know the queue said no, not a fake thanks.
  const ip = firstForwardedIp((await headers()).get("x-forwarded-for"));
  const perIp = RATE_LIMITS.submitPerIp;
  if (!(await rateAllow(ipBucket("submit", ip), perIp.limit, perIp.windowMinutes))) {
    return {
      status: "error",
      message: "Too many submissions right now — please try again in a bit.",
    };
  }

  const input: SubmissionInput = {
    title: String(formData.get("title") || ""),
    category: String(formData.get("category") || ""),
    date: String(formData.get("date") || ""),
    time: String(formData.get("time") || ""),
    endTime: String(formData.get("endTime") || ""),
    venue: String(formData.get("venue") || ""),
    city: String(formData.get("city") || ""),
    address: String(formData.get("address") || ""),
    price: String(formData.get("price") || ""),
    ticketUrl: String(formData.get("ticketUrl") || ""),
    description: String(formData.get("description") || ""),
    submitterEmail: String(formData.get("submitterEmail") || ""),
  };

  const result = validateSubmission(input);
  if (!result.ok) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      errors: result.errors,
    };
  }

  const outcome = await addSubmission(result.value);
  if (outcome === "error") {
    return { status: "error", message: "Something went wrong — please try again." };
  }

  return {
    status: "success",
    message: "Thanks! Your event is in the queue — we review submissions and publish the ones that fit.",
  };
}
