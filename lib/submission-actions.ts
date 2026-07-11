"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin, logAudit } from "./admin";
import {
  getSubmissionById,
  markSubmissionReviewed,
  submissionToDbEvent,
} from "./submissions";
import { upsertEvents } from "./upsert";
import { geocode } from "./geocode";

export async function approveSubmission(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id"));

  const sub = await getSubmissionById(id);
  if (!sub) return; // already handled or gone

  // Geocode the venue/address so the event gets a map pin (fallback = metro center).
  const geo = await geocode(sub.address || sub.venue, sub.city);
  const event = submissionToDbEvent(sub, geo);
  await upsertEvents([event]);

  await markSubmissionReviewed(id, "approved");
  await logAudit("approve_submission", id, { title: sub.title });

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
