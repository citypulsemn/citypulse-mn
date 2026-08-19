"use server";

import { headers } from "next/headers";
import { validateReport, addReport, type ReportInput } from "./event-reports";
import { rateAllow, ipBucket, firstForwardedIp, RATE_LIMITS } from "./rate-limit";
import { REPORT_KIND_LABELS, type ReportKind, type ReportState } from "./report-types";
import { sendOperatorNotification } from "./notify-send";
import { getEvent } from "./events";

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

  // The report is SAVED. Everything below is best-effort: sendOperatorNotification
  // never throws and its result is logged, not surfaced — a notification outage
  // must not turn a successful report into an error for the reporter (rule 1).
  // The weekly ops-digest Queue section is the backstop if this drops.
  // Look up the title so the alert is triageable at a glance ("Gothic Market"
  // beats "a listing"). Guarded: if this read fails the notification still goes,
  // just less specific — it must never cost the reporter their submission.
  let eventTitle = "";
  try {
    eventTitle = (await getEvent(result.value.event_id))?.title ?? "";
  } catch {
    /* fall through to the generic title */
  }
  const kindLabel = REPORT_KIND_LABELS[result.value.kind as ReportKind] ?? "Listing report";
  const notified = await sendOperatorNotification({
    kind: "report",
    title: eventTitle || kindLabel,
    detail: (kindLabel + " — " + result.value.reason).slice(0, 300),
    adminPath: "/admin/reports",
  });
  if (!notified) console.warn("[report] saved but operator notification did not send");

  return {
    status: "success",
    message:
      "Thanks — a person will check this. If it's cancelled or wrong, we'll fix the listing, usually within a day.",
  };
}
