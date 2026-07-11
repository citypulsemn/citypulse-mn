"use server";

import { validateSubmission, addSubmission, type SubmissionInput } from "./submissions";
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
