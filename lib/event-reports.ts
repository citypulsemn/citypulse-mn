import { sql } from "./db";
import { isValidEmail } from "./subscribe";
import { normalizeUrl } from "./submissions";
import { REPORT_KINDS, REPORTER_ROLES, type ReportKind, type ReporterRole } from "./report-types";

// Re-exported so server-side callers can keep a single import site; the values
// themselves live in the client-safe module (this file imports lib/db).
export { REPORT_KINDS, REPORTER_ROLES, REPORT_KIND_LABELS, REPORTER_ROLE_LABELS } from "./report-types";
export type { ReportKind, ReporterRole } from "./report-types";

/**
 * Listing removal / correction requests — the public "something's wrong with this
 * listing" channel (Taren item 2). Before this the site had no contact, report, or
 * takedown path of any kind: a venue that cancelled an event had literally no way
 * to tell us, and a stale listing could only be caught by the weekly verify pass.
 *
 * The honesty contract, and it is the whole point of this module:
 *   - A report is a TIP, never an instruction. Event ids are public and
 *     "I'm the organizer" is a text field, so nothing here is verified and
 *     nothing is ever applied automatically. A person reads each one and decides.
 *   - Honoring a report is an ordinary status change on the event
 *     ('cancelled' or 'draft') — no new event status, no new lifecycle.
 *   - `outcome` stays NULL until reviewed so "not yet decided" is distinguishable
 *     from "decided: no change" (rule 6 — honest emptiness in the data layer too).
 *
 * Pure validation here, golden-tested; the DB helpers guard on `sql` and degrade
 * to a dev no-op exactly like lib/submissions.ts.
 */

const KIND_SET = new Set<string>(REPORT_KINDS);
const ROLE_SET = new Set<string>(REPORTER_ROLES);

export interface ReportInput {
  eventId: string;
  kind: string;
  reason: string;
  evidenceUrl: string;
  reporterEmail: string;
  reporterRole: string;
}

export interface CleanReport {
  event_id: string;
  kind: ReportKind;
  reason: string;
  evidence_url: string;
  reporter_email: string;
  reporter_role: ReporterRole;
}

export type ValidateReportResult =
  | { ok: true; value: CleanReport }
  | { ok: false; errors: Record<string, string> };

const MAX_REASON = 1000;

/** A v4-shaped UUID, the id format events carry. Keeps junk out of the query. */
const isUuid = (s: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim());

/**
 * Validate a public report. Strict about the two things that matter (a real event
 * id, a reason someone can act on) and forgiving about the rest — a person telling
 * us an event is cancelled should not be turned away over a malformed URL.
 */
export function validateReport(input: ReportInput): ValidateReportResult {
  const errors: Record<string, string> = {};

  const eventId = String(input.eventId ?? "").trim();
  if (!eventId) errors.eventId = "Missing the event this is about.";
  else if (!isUuid(eventId)) errors.eventId = "That doesn't look like a valid listing.";

  const kind = String(input.kind ?? "").trim();
  if (!kind) errors.kind = "Tell us what's wrong.";
  else if (!KIND_SET.has(kind)) errors.kind = "Pick one of the options.";

  const reason = String(input.reason ?? "").trim();
  if (!reason) errors.reason = "A sentence about what's wrong helps us check it.";
  else if (reason.length > MAX_REASON) errors.reason = "Please keep this under 1000 characters.";

  const role = String(input.reporterRole ?? "").trim();
  const reporter_role = (ROLE_SET.has(role) ? role : "") as ReporterRole;

  // Optional. Only rejected when present AND clearly wrong — never a barrier to
  // reporting, since the email is for our follow-up, not for their access.
  const email = String(input.reporterEmail ?? "").trim();
  if (email && !isValidEmail(email)) errors.reporterEmail = "That email doesn't look right.";

  const evidence = String(input.evidenceUrl ?? "").trim();
  const evidence_url = evidence ? normalizeUrl(evidence) : "";

  if (Object.keys(errors).length) return { ok: false, errors };

  return {
    ok: true,
    value: {
      event_id: eventId,
      kind: kind as ReportKind,
      reason,
      evidence_url,
      reporter_email: email,
      reporter_role,
    },
  };
}

// ── DB layer (owner connection; the table is sealed from the public API) ─────

export type AddReportResult = "added" | "error";

export interface ReportRow {
  id: string;
  event_id: string;
  kind: ReportKind;
  reason: string;
  evidence_url: string;
  reporter_email: string;
  reporter_role: ReporterRole;
  created_at: string;
  /** Joined from events so the queue reads as "what is this about?" at a glance. */
  event_title: string;
  event_venue: string;
  event_start: string;
  event_status: string;
}

export async function addReport(clean: CleanReport): Promise<AddReportResult> {
  if (!sql) {
    console.warn("[report] no DATABASE_URL — dev no-op");
    return "added";
  }
  try {
    await sql`
      insert into event_reports
        (event_id, kind, reason, evidence_url, reporter_email, reporter_role)
      values
        (${clean.event_id}::uuid, ${clean.kind}, ${clean.reason},
         ${clean.evidence_url}, ${clean.reporter_email}, ${clean.reporter_role})
    `;
    return "added";
  } catch (err) {
    console.error("[report] insert failed:", err);
    return "error";
  }
}

export async function getPendingReports(): Promise<ReportRow[]> {
  if (!sql) return [];
  return await sql<ReportRow[]>`
    select r.id, r.event_id, r.kind, r.reason, r.evidence_url,
           r.reporter_email, r.reporter_role,
           to_char(r.created_at at time zone 'America/Chicago', 'YYYY-MM-DD HH24:MI') as created_at,
           e.title as event_title, e.venue as event_venue,
           to_char(e.start_at at time zone 'America/Chicago', 'YYYY-MM-DD HH24:MI') as event_start,
           e.status as event_status
    from event_reports r
    join events e on e.id = r.event_id
    where r.status = 'pending'
    order by r.created_at asc
  `;
}

/** Open-report count for the ops digest's pending-items block. */
export async function getPendingReportCount(): Promise<number> {
  if (!sql) return 0;
  const [row] = await sql<{ n: number }[]>`
    select count(*)::int as n from event_reports where status = 'pending'
  `;
  return row?.n ?? 0;
}

/** Age in days of the oldest open report, or null when the queue is empty.
 *  Drives the ops digest's "something has been sitting too long" alert. */
export async function getOldestPendingReportDays(): Promise<number | null> {
  if (!sql) return null;
  const [row] = await sql<{ days: number | null }[]>`
    select floor(extract(epoch from (now() - min(created_at))) / 86400)::int as days
    from event_reports where status = 'pending'
  `;
  return row?.days ?? null;
}

export async function markReportReviewed(
  id: string,
  status: "actioned" | "declined",
  outcome: "cancelled" | "hidden" | "edited" | "none",
  note?: string,
): Promise<void> {
  if (!sql) return;
  await sql`
    update event_reports
    set status = ${status}, outcome = ${outcome}, reviewed_at = now(),
        review_note = ${note ?? null}
    where id::text = ${id}
  `;
}
