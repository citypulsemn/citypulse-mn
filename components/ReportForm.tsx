"use client";

import { useActionState } from "react";
import { submitReportAction } from "@/lib/report-actions";
import {
  initialReportState,
  REPORT_KINDS,
  REPORT_KIND_LABELS,
  REPORTER_ROLE_LABELS,
} from "@/lib/report-types";

/**
 * The public "something's wrong with this listing" form. Mirrors SubmitForm's
 * shape (useActionState + the .submit-form / .sf-field / .sf-err CSS) so it needs
 * no new styles and behaves identically — including the hidden honeypot.
 *
 * The event id rides in a hidden field, populated by the page from ?event=. It is
 * a claim like any other: the server re-validates it and nothing is applied
 * without a person looking.
 */
export function ReportForm({ eventId }: { eventId: string }) {
  const [state, action, pending] = useActionState(submitReportAction, initialReportState);
  const done = state.status === "success";
  const err = (f: string) => state.errors?.[f];

  if (done) {
    return (
      <div className="submit-done" role="status">
        <div className="submit-done-check">✓</div>
        <p>{state.message}</p>
        <a className="more-day-all" href="/">
          Back to events →
        </a>
      </div>
    );
  }

  return (
    <form action={action} className="submit-form">
      {/* Honeypot */}
      <input type="text" name="company" className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <input type="hidden" name="eventId" value={eventId} />

      <label className="sf-field">
        <span>What&apos;s wrong? *</span>
        <select name="kind" required defaultValue="">
          <option value="" disabled>
            Choose one…
          </option>
          {REPORT_KINDS.map((k) => (
            <option key={k} value={k}>
              {REPORT_KIND_LABELS[k]}
            </option>
          ))}
        </select>
        {err("kind") && <em className="sf-err">{err("kind")}</em>}
      </label>

      <label className="sf-field">
        <span>Tell us a bit more *</span>
        <textarea
          name="reason"
          required
          rows={4}
          maxLength={1000}
          placeholder="e.g. The venue cancelled this on Friday — it's off their calendar now."
        />
        {err("reason") && <em className="sf-err">{err("reason")}</em>}
      </label>

      <label className="sf-field">
        <span>Link that shows it (optional)</span>
        <input name="evidenceUrl" placeholder="A venue page or post confirming the change" />
        {err("evidenceUrl") && <em className="sf-err">{err("evidenceUrl")}</em>}
      </label>

      <div className="sf-row">
        <label className="sf-field">
          <span>You are (optional)</span>
          <select name="reporterRole" defaultValue="">
            <option value="">Prefer not to say</option>
            {(Object.keys(REPORTER_ROLE_LABELS) as (keyof typeof REPORTER_ROLE_LABELS)[]).map((r) => (
              <option key={r} value={r}>
                {REPORTER_ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </label>
        <label className="sf-field">
          <span>Your email (optional)</span>
          <input name="reporterEmail" type="email" placeholder="Only if we may follow up" />
          {err("reporterEmail") && <em className="sf-err">{err("reporterEmail")}</em>}
        </label>
      </div>

      {state.status === "error" && state.message && (
        <p className="sf-err" role="alert">
          {state.message}
        </p>
      )}

      <button type="submit" className="sf-submit" disabled={pending}>
        {pending ? "Sending…" : "Send report"}
      </button>
    </form>
  );
}
