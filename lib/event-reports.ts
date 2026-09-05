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

// ── Automated check on reported listings (Sep 2026) ──────────────────────────
// See lib/report-check.ts for why this exists (the Marley/Fillmore incident).

/** A pending report joined to its listing, ready for the checker. */
export interface UncheckedReportRow extends ReportRow {
  event_city: string;
  event_source_url: string;
  event_ticket_url: string;
}

/** Pending reports that have never been checked, oldest first. */
export async function getUncheckedReports(limit = 12): Promise<UncheckedReportRow[]> {
  if (!sql) return [];
  return await sql<UncheckedReportRow[]>`
    select r.id, r.event_id, r.kind, r.reason, r.evidence_url,
           r.reporter_email, r.reporter_role,
           to_char(r.created_at at time zone 'America/Chicago', 'YYYY-MM-DD HH24:MI') as created_at,
           e.title as event_title, e.venue as event_venue, e.city as event_city,
           to_char(e.start_at at time zone 'America/Chicago', 'YYYY-MM-DD HH24:MI') as event_start,
           e.status as event_status,
           coalesce(e.source_url, '') as event_source_url,
           coalesce(e.ticket_url, '') as event_ticket_url
    from event_reports r
    join events e on e.id = r.event_id
    where r.status = 'pending' and r.checked_at is null
    order by r.created_at asc
    limit ${limit}
  `;
}

/** A pending report WITH its check result — what the digest and the email show. */
export interface CheckedReportRow extends ReportRow {
  check_verdict: string | null;
  check_note: string | null;
  check_evidence: string | null;
  checked_at: string | null;
}

export async function getPendingReportsWithChecks(): Promise<CheckedReportRow[]> {
  if (!sql) return [];
  return await sql<CheckedReportRow[]>`
    select r.id, r.event_id, r.kind, r.reason, r.evidence_url,
           r.reporter_email, r.reporter_role,
           to_char(r.created_at at time zone 'America/Chicago', 'YYYY-MM-DD HH24:MI') as created_at,
           r.check_verdict, r.check_note, r.check_evidence,
           r.checked_at::text as checked_at,
           e.title as event_title, e.venue as event_venue,
           to_char(e.start_at at time zone 'America/Chicago', 'YYYY-MM-DD HH24:MI') as event_start,
           e.status as event_status
    from event_reports r
    join events e on e.id = r.event_id
    where r.status = 'pending'
    order by r.created_at asc
  `;
}

export async function saveReportCheck(
  id: string,
  verdict: string,
  note: string | null,
  evidence: string | null,
): Promise<void> {
  if (!sql) return;
  await sql`
    update event_reports
    set check_verdict = ${verdict}, check_note = ${note},
        check_evidence = ${evidence}, checked_at = now()
    where id::text = ${id}
  `;
}

/**
 * Apply an emailed one-tap decision.
 *
 * Returns what actually happened so the confirmation page can be honest — in
 * particular `already` for a report someone has already decided, which is the
 * normal outcome of tapping the same link twice. Idempotent by construction:
 * the update only matches a report that is still pending.
 */
export type EmailDecision = "delete" | "keep";
export type DecisionOutcome =
  | { kind: "applied"; action: EmailDecision; eventId: string; title: string }
  | { kind: "already"; status: string; title: string }
  | { kind: "unknown" };

export async function applyEmailedDecision(
  id: string,
  action: EmailDecision,
): Promise<DecisionOutcome> {
  if (!sql) return { kind: "unknown" };

  const [row] = await sql<{ status: string; event_id: string; title: string }[]>`
    select r.status, r.event_id::text as event_id, e.title
    from event_reports r join events e on e.id = r.event_id
    where r.id::text = ${id}
  `;
  if (!row) return { kind: "unknown" };
  if (row.status !== "pending") {
    return { kind: "already", status: row.status, title: row.title };
  }

  if (action === "delete") {
    // NEVER a delete, whatever the button says: the listing is archived and can
    // be put back with one click. A false removal must always be undoable.
    await sql`
      update events set status = 'draft'
      where id::text = ${row.event_id} and status = 'published'
    `;
    await sql`
      update event_reports
      set status = 'actioned', outcome = 'hidden', reviewed_at = now(),
          decided_via = 'email',
          review_note = 'Taken down from the ops email after an automated check.'
      where id::text = ${id}
    `;
    await sql`
      insert into admin_audit (action, event_id, patch)
      values ('report_decision_email', ${row.event_id}::uuid,
              ${sql.json({ decision: "delete", status: "draft", report_id: id } as never)})
    `;
  } else {
    await sql`
      update event_reports
      set status = 'declined', outcome = 'none', reviewed_at = now(),
          decided_via = 'email',
          review_note = 'Kept from the ops email after an automated check.'
      where id::text = ${id}
    `;
    await sql`
      insert into admin_audit (action, event_id, patch)
      values ('report_decision_email', ${row.event_id}::uuid,
              ${sql.json({ decision: "keep", report_id: id } as never)})
    `;
  }

  return { kind: "applied", action, eventId: row.event_id, title: row.title };
}
