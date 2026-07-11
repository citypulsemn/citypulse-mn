import { getPendingSubmissions } from "@/lib/submissions";
import { approveSubmission, rejectSubmission } from "@/lib/submission-actions";
import { CATEGORIES } from "@/lib/categories";
import { fmtTime } from "@/lib/dates";
import { longDate } from "@/lib/event-view";

export const dynamic = "force-dynamic";

function whenLabel(startLocal: string, endLocal: string | null): string {
  const day = startLocal.slice(0, 10);
  const base = `${longDate(day)} · ${fmtTime(startLocal)}`;
  return endLocal ? `${base}–${fmtTime(endLocal)}` : base;
}

export default async function AdminSubmissionsPage() {
  const pending = await getPendingSubmissions();

  return (
    <div className="admin-section">
      <p className="admin-note">
        {pending.length === 0
          ? "No pending submissions. New community submissions will appear here for review."
          : `${pending.length} submission${pending.length > 1 ? "s" : ""} awaiting review. Approving creates a published event (geocoded automatically); rejecting hides it.`}
      </p>

      {pending.map((s) => (
        <div key={s.id} className="sub-card">
          <div className="sub-head">
            <span className="catbadge" style={{ color: CATEGORIES[s.category]?.color }}>
              <span className="dot" style={{ background: CATEGORIES[s.category]?.color }} />
              {CATEGORIES[s.category]?.label ?? s.category}
            </span>
            <span className="sub-when">{whenLabel(s.start_local, s.end_local)}</span>
          </div>

          <div className="sub-title">{s.title}</div>
          <div className="sub-meta">
            {[s.venue, s.address, s.city].filter(Boolean).join(" · ")} · {s.price}
          </div>
          {s.description && <p className="sub-desc">{s.description}</p>}
          <div className="sub-links">
            {s.ticket_url && (
              <a href={s.ticket_url} target="_blank" rel="noopener noreferrer">
                Link ↗
              </a>
            )}
            {s.submitter_email && <span className="sub-submitter">from {s.submitter_email}</span>}
            <span className="sub-submitter">submitted {s.created_at}</span>
          </div>

          <div className="sub-actions">
            <form action={approveSubmission}>
              <input type="hidden" name="id" value={s.id} />
              <button type="submit" className="sub-approve">
                Approve &amp; publish
              </button>
            </form>
            <details className="sub-reject">
              <summary>Reject</summary>
              <form action={rejectSubmission} className="sub-reject-form">
                <input type="hidden" name="id" value={s.id} />
                <input name="note" placeholder="Reason (optional, internal)" />
                <button type="submit">Confirm reject</button>
              </form>
            </details>
          </div>
        </div>
      ))}
    </div>
  );
}
