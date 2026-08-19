/**
 * Client-safe shared module for the report feature. No "use server", and — the
 * load-bearing part — **no database import**. `lib/event-reports.ts` imports
 * `sql` from lib/db, so a client component pulling its constants from there
 * drags `postgres` into the browser bundle and the build fails on `Can't resolve
 * 'net'`. The form, the admin queue, and the server action all read the vocabulary
 * from here instead.
 */

export interface ReportState {
  status: "idle" | "success" | "error";
  message: string;
  errors?: Record<string, string>;
}

export const initialReportState: ReportState = { status: "idle", message: "" };

export const REPORT_KINDS = ["cancelled", "wrong_details", "duplicate", "removal", "other"] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export const REPORTER_ROLES = ["", "organizer", "venue", "attendee", "other"] as const;
export type ReporterRole = (typeof REPORTER_ROLES)[number];

/** Human labels for the form and the admin queue — one source, so they can't drift. */
export const REPORT_KIND_LABELS: Record<ReportKind, string> = {
  cancelled: "It was cancelled",
  wrong_details: "The details are wrong",
  duplicate: "It's a duplicate",
  removal: "Please remove this listing",
  other: "Something else",
};

export const REPORTER_ROLE_LABELS: Record<Exclude<ReporterRole, "">, string> = {
  organizer: "I'm the organizer",
  venue: "I work at the venue",
  attendee: "I was going to attend",
  other: "Other",
};
