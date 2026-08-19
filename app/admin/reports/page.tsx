import { getPendingReports, REPORT_KIND_LABELS, REPORTER_ROLE_LABELS } from "@/lib/event-reports";
import { cancelReportedEvent, hideReportedEvent, dismissReport } from "@/lib/admin-actions";

export const dynamic = "force-dynamic";

export default async function AdminReportsPage() {
  const pending = await getPendingReports();

  return (
    <div className="admin-section">
      <p className="admin-note">
        {pending.length === 0
          ? "No open reports. Removal and correction requests from the public will appear here for review."
          : `${pending.length} report${pending.length > 1 ? "s" : ""} awaiting review. Nothing here has been applied — every claim is unverified, so check the listing before acting.`}
      </p>

      {pending.map((r) => (
        <div key={r.id} className="sub-card">
          <div className="sub-head">
            <span className="catbadge">{REPORT_KIND_LABELS[r.kind] ?? r.kind}</span>
            <span className="sub-when">
              {r.event_start}
              {r.event_status !== "published" ? ` · already ${r.event_status}` : ""}
            </span>
          </div>

          <div className="sub-title">{r.event_title}</div>
          <div className="sub-meta">{r.event_venue}</div>
          <p className="sub-desc">{r.reason}</p>

          <div className="sub-links">
            <a href={`/event/${r.event_id}`} target="_blank" rel="noopener noreferrer">
              Open listing ↗
            </a>
            {r.evidence_url && (
              <a href={r.evidence_url} target="_blank" rel="noopener noreferrer">
                Evidence ↗
              </a>
            )}
            {r.reporter_role && (
              <span className="sub-submitter">
                {REPORTER_ROLE_LABELS[r.reporter_role as keyof typeof REPORTER_ROLE_LABELS] ??
                  r.reporter_role}
              </span>
            )}
            {r.reporter_email && <span className="sub-submitter">from {r.reporter_email}</span>}
            <span className="sub-submitter">reported {r.created_at}</span>
          </div>

          <div className="sub-actions">
            {/* Primary: the event really was called off. The page stays up, marked
                cancelled, so anyone holding a link (or a calendar entry) learns it. */}
            <form action={cancelReportedEvent}>
              <input type="hidden" name="id" value={r.id} />
              <input type="hidden" name="eventId" value={r.event_id} />
              <button type="submit" className="sub-approve">
                Mark cancelled
              </button>
            </form>

            {/* Secondary: it should never have been listed — hide it outright. */}
            <details className="sub-reject">
              <summary>Other actions</summary>
              <form action={hideReportedEvent} className="sub-reject-form">
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="eventId" value={r.event_id} />
                <button type="submit">Hide the listing (404s)</button>
              </form>
              <form action={dismissReport} className="sub-reject-form">
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="eventId" value={r.event_id} />
                <input name="note" placeholder="Why dismissed (optional, internal)" />
                <button type="submit">Dismiss — no change</button>
              </form>
            </details>
          </div>
        </div>
      ))}
    </div>
  );
}
