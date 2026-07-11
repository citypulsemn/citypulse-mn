import { getEvents } from "@/lib/events";
import { getSubscribedRecipients } from "@/lib/subscribe";
import { digestEvents, renderDigestEmail, digestWeekLabel } from "@/lib/digest";
import { getDigestSends } from "@/lib/digest-send";

export const dynamic = "force-dynamic";

export default async function AdminDigestPage() {
  const now = new Date();
  const events = digestEvents(await getEvents(), now);
  const recipients = await getSubscribedRecipients();
  const sends = await getDigestSends(8);

  const { subject, html } = renderDigestEmail({
    events,
    weekLabel: digestWeekLabel(now),
    unsubscribeUrl: "#preview",
    siteUrl: "https://citypulsemn.com",
  });

  return (
    <div className="admin-section">
      <div className="admin-stat-row">
        <div className="admin-stat">
          <div className="admin-stat-n">{recipients.length}</div>
          <div className="admin-stat-l">Confirmed subscribers</div>
        </div>
        <div className="admin-stat">
          <div className="admin-stat-n">{events.length}</div>
          <div className="admin-stat-l">Events in this week's digest</div>
        </div>
      </div>

      <p className="admin-note">
        The digest sends automatically every <strong>Thursday morning</strong> via the
        <code> weekly-digest</code> GitHub Actions workflow. Subject line this week:
        <br />
        <strong>{subject}</strong>
      </p>

      <h3 className="admin-subhead">Live preview</h3>
      {events.length === 0 ? (
        <p className="admin-note">
          No events fall in the next 7 days right now, so this week's digest would be skipped.
        </p>
      ) : (
        <iframe
          title="Digest preview"
          srcDoc={html}
          className="digest-preview"
          sandbox=""
        />
      )}

      <h3 className="admin-subhead">Recent sends</h3>
      {sends.length === 0 ? (
        <p className="admin-note">No sends recorded yet.</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Sent (CT)</th>
              <th>Recipients</th>
              <th>Status</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {sends.map((s, i) => (
              <tr key={i}>
                <td>{s.sent_at}</td>
                <td>{s.recipients}</td>
                <td>{s.ok ? "ok" : "failed"}</td>
                <td>{s.note ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
