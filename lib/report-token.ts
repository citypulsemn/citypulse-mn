import { createHmac, timingSafeEqual } from "node:crypto";
import { envOr } from "./env";

/**
 * ONE-TAP REPORT DECISIONS FROM THE EMAIL (Sep 2026).
 *
 * Taren reads these on a phone. Opening the admin, finding the report and
 * choosing an outcome is four screens; "take it down" or "keep it" is one tap.
 * The token is an HMAC-SHA256 over the report id AND the action, so a link that
 * hides a listing cannot be edited into a link that keeps it, or vice versa.
 *
 * WHY THE LINK ITSELF NEVER CHANGES ANYTHING. Mail providers follow links in
 * messages — Outlook Safe Links and Gmail's scanners fetch them without a human
 * ever tapping. A GET that hid an event would fire on delivery. So GET only
 * renders a confirmation page and the decision is applied on POST, from a form
 * on that page. One extra tap, and no listing is ever taken down by a spam
 * filter.
 */

export const REPORT_ACTIONS = ["delete", "keep"] as const;
export type ReportAction = (typeof REPORT_ACTIONS)[number];

export function isReportAction(v: unknown): v is ReportAction {
  return v === "delete" || v === "keep";
}

/**
 * The signing secret.
 *
 * Prefers its own `REPORT_ACTION_SECRET`, and falls back to the digest's
 * `UNSUBSCRIBE_SECRET` so the feature works the day it ships rather than waiting
 * on an env var — `REVALIDATE_SECRET` has been unset since the day it was added,
 * and a decision channel that silently does nothing is worse than one sharing a
 * key. Sharing is safe here because the HMAC message is namespaced (`report:`
 * vs `unsub:`), so no unsubscribe token can ever be replayed as a decision.
 */
export function reportActionSecret(): string {
  return envOr("citypulse-dev-report-secret", "REPORT_ACTION_SECRET", "UNSUBSCRIBE_SECRET");
}

export function makeReportToken(id: string, action: ReportAction, secret: string): string {
  return createHmac("sha256", secret).update(`report:${id}:${action}`).digest("base64url");
}

export function verifyReportToken(
  id: string,
  action: string,
  token: string,
  secret: string,
): boolean {
  if (!isReportAction(action)) return false;
  const expected = Buffer.from(makeReportToken(id, action, secret));
  const got = Buffer.from(token ?? "");
  // timingSafeEqual throws on a length mismatch, so compare lengths first.
  if (expected.length !== got.length) return false;
  return timingSafeEqual(expected, got);
}

export function reportActionUrl(
  siteUrl: string,
  id: string,
  action: ReportAction,
  secret: string,
): string {
  const base = siteUrl.replace(/\/+$/, "");
  return `${base}/report-action?id=${encodeURIComponent(id)}&a=${action}&t=${makeReportToken(id, action, secret)}`;
}

/* ──────────────── the same machinery, for submission decisions ───────────── */

/**
 * Submissions get one-tap decisions too, and share this module rather than
 * copying the HMAC into a second file — one signing implementation, one place
 * to get it wrong. The message is namespaced `submission:`, so a report token
 * can never be replayed as a submission decision or the reverse.
 *
 * `publish-corrected` is the one that matters: the check has already done the
 * reading and proposed the fields, so the common case is one tap instead of a
 * quarter of an hour. It still only ever fires from a POST on the confirmation
 * page, for the same reason the report actions do.
 */
export const SUBMISSION_ACTIONS = ["publish-corrected", "publish-as-sent", "reject"] as const;
export type SubmissionAction = (typeof SUBMISSION_ACTIONS)[number];

export function isSubmissionAction(v: unknown): v is SubmissionAction {
  return typeof v === "string" && (SUBMISSION_ACTIONS as readonly string[]).includes(v);
}

export function makeSubmissionToken(id: string, action: SubmissionAction, secret: string): string {
  return createHmac("sha256", secret).update(`submission:${id}:${action}`).digest("base64url");
}

export function verifySubmissionToken(
  id: string,
  action: string,
  token: string,
  secret: string,
): boolean {
  if (!isSubmissionAction(action)) return false;
  const expected = Buffer.from(makeSubmissionToken(id, action, secret));
  const got = Buffer.from(token ?? "");
  if (expected.length !== got.length) return false;
  return timingSafeEqual(expected, got);
}

export function submissionActionUrl(
  siteUrl: string,
  id: string,
  action: SubmissionAction,
  secret: string,
): string {
  const base = siteUrl.replace(/\/+$/, "");
  return `${base}/submission-action?id=${encodeURIComponent(id)}&a=${action}&t=${makeSubmissionToken(id, action, secret)}`;
}
