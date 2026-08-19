"use server";

import { headers } from "next/headers";
import { validateReport, addReport, type ReportInput } from "./event-reports";
import { rateAllow, ipBucket, firstForwardedIp, RATE_LIMITS } from "./rate-limit";
import type { ReportState } from "./report-types";

// A "use server" module must export ONLY async server actions.
// State type + initial value live in ./report-types.

export async function submitReportAction(
  _prev: ReportState,
  formData: FormData,
): Promise<ReportState> {
  // Honeypot FIRST, exactly as submit-actions.ts does: bots fill hidden fields,
  // and we silently "succeed" without storing. Running it before the rate limit
  // is deliberate — bot noise must not burn a real reporter's bucket.
  if (String(formData.get("company") || "").trim()) {
    return { status: "success", message: "Thanks — we'll take a look." };
  }

  // Per-IP cap, after the honeypot. Honest error: a venue manager reporting a
  // real cancellation deserves to know the queue said no, not a fake thanks.
  const ip = firstForwardedIp((await headers()).get("x-forwarded-for"));
  const perIp = RATE_LIMITS.reportPerIp;
  if (!(await rateAllow(ipBucket("report", ip), perIp.limit, perIp.windowMinutes))) {
    return {
      status: "error",
      message: "Too many reports from here right now — please try again in a bit.",
    };
  }

  const input: ReportInput = {
    eventId: String(formData.get("eventId") || ""),
    kind: String(formData.get("kind") || ""),
    reason: String(formData.get("reason") || ""),
    evidenceUrl: String(formData.get("evidenceUrl") || ""),
    reporterEmail: String(formData.get("reporterEmail") || ""),
    reporterRole: String(formData.get("reporterRole") || ""),
  };

  const result = validateReport(input);
  if (!result.ok) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      errors: result.errors,
    };
  }

  const outcome = await addReport(result.value);
  if (outcome === "error") {
    return { status: "error", message: "Something went wrong — please try again." };
  }

  return {
    status: "success",
    message:
      "Thanks — a person will check this. If it's cancelled or wrong, we'll fix the listing, usually within a day.",
  };
}
