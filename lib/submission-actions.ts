"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin, logAudit } from "./admin";
import { markSubmissionReviewed } from "./submissions";
import { publishSubmission } from "./submission-publish";

/**
 * Approve from the admin screen, WITH the check's corrections applied.
 *
 * It delegates to the same publishSubmission() the one-tap email link uses, so
 * "approve" means the same thing wherever it is pressed. Before 4 Oct 2026
 * this built the event from the submitter's raw input: approving the craft
 * market would have published "Eastview Education Building" when the school
 * district calls it "Eastview Education Center" and the check had already said
 * so. The card shows exactly which fields this will change.
 */
export async function approveSubmission(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id"));

  const result = await publishSubmission(id, { applyCorrections: true, via: "admin" });
  if (!result.ok) return; // already decided, gone, or the write failed — card stays

  await logAudit("approve_submission", id, {
    title: result.title,
    corrections: result.corrected,
  });

  revalidatePath("/admin/submissions");
  revalidatePath("/");
}

/** Approve ignoring the corrections, when the check got it wrong. */
export async function approveSubmissionAsSent(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id"));

  const result = await publishSubmission(id, { applyCorrections: false, via: "admin:as-sent" });
  if (!result.ok) return;

  await logAudit("approve_submission", id, { title: result.title, corrections: [] });
  revalidatePath("/admin/submissions");
  revalidatePath("/");
}

export async function rejectSubmission(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id"));
  const note = String(formData.get("note") || "").trim() || undefined;

  await markSubmissionReviewed(id, "rejected", note);
  await logAudit("reject_submission", id, {});

  revalidatePath("/admin/submissions");
}
