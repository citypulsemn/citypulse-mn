/**
 * Honouring a deletion request.
 *
 * WHY THIS EXISTS. `/privacy` tells readers, in our own words: "write to us and
 * we'll delete it", and that a subscriber email is kept "until you unsubscribe
 * or ask us to delete it". Until 17 Sep 2026 there was no code behind that
 * sentence. Honouring a request meant somebody remembering to hand-write SQL
 * against production, correctly, under no time pressure but no checklist
 * either. A promise kept by memory is a promise that will eventually be missed.
 *
 * WHERE PERSONAL DATA ACTUALLY LIVES, from db/schema.sql:
 *   subscribers.email          the address itself, plus saver_token
 *   subscribers.saver_token    the bridge to a browser's saved events
 *   saved_events.user_token    pseudonymous, reachable only via that bridge
 *   event_submissions.submitter_email
 *   event_reports.reporter_email
 *
 * `rate_events` holds IP-keyed buckets but ages itself out in days, which is
 * what the policy already describes, so it is not part of a request.
 */

import { createHash } from "node:crypto";

/**
 * The tables a request touches, in the order they must be cleared: saved events
 * hang off the subscriber's token, so that bridge is read before it is cut.
 */
export const DELETION_TABLES = [
  "saved_events",
  "subscribers",
  "event_submissions",
  "event_reports",
] as const;
export type DeletionTable = (typeof DELETION_TABLES)[number];

export interface DeletionCount {
  table: DeletionTable;
  rows: number;
  /** Plain English, for the confirmation the operator reads before applying. */
  what: string;
}

/**
 * Normalise and VALIDATE the address a request names.
 *
 * THIS IS A SAFETY GUARD, NOT A FORMATTER, and the reason is specific:
 * `event_submissions.submitter_email` and `event_reports.reporter_email` are
 * `not null default ''`. An anonymous submission stores the EMPTY STRING. So a
 * deletion keyed on a blank or whitespace-only address would match every
 * anonymous submission and every anonymous report in the table and silently
 * delete the lot.
 *
 * Returns null for anything that is not unambiguously one address. The caller
 * must refuse to run on null — there is no sensible default here.
 */
export function normalizeRequestEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const e = raw.trim().toLowerCase();
  if (e === "") return null;
  if (e.length > 254) return null; // RFC 5321 practical maximum
  // Deliberately strict: one local part, one @, a dotted domain, no spaces, no
  // commas or semicolons that could smuggle a second address past a reader.
  if (!/^[^\s@,;]+@[^\s@,;]+\.[a-z]{2,}$/i.test(e)) return null;
  return e;
}

/**
 * A stable, non-reversing reference for the audit trail.
 *
 * The audit row must not re-create what the deletion removed — writing the
 * address into `admin_audit` would leave the data in the database under a
 * different name, which is not deletion. A salted digest, truncated, is enough
 * to prove a particular request was honoured when the operator still holds the
 * original email in their own inbox, and is useless to anyone who does not.
 */
export function requestReference(email: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${email}`).digest("hex").slice(0, 12);
}

/** Did the request find anything at all? */
export function totalRows(counts: DeletionCount[]): number {
  return counts.reduce((n, c) => n + (Number.isFinite(c.rows) ? c.rows : 0), 0);
}

/**
 * The confirmation an operator reads before typing --apply. Lists every table,
 * including the ones with nothing in them: "subscribers 0" is the useful half
 * of the answer when someone asks whether you still hold their address.
 */
export function describePlan(email: string, counts: DeletionCount[]): string {
  const lines = counts.map((c) => `  ${String(c.rows).padStart(4)}  ${c.table.padEnd(18)} ${c.what}`);
  const total = totalRows(counts);
  return [
    `Deletion request for ${email}`,
    ...lines,
    "",
    total === 0
      ? "Nothing found. We hold no personal data for that address — which is itself the answer to give them."
      : `${total} row(s) will be permanently deleted. This cannot be undone.`,
  ].join("\n");
}
