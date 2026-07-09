import { getPipelineRuns } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminPipelinePage() {
  const runs = await getPipelineRuns(8);

  return (
    <>
      <p className="admin-intro">The last 8 weekly research runs.</p>

      {runs.length === 0 ? (
        <div className="admin-empty">
          No runs recorded yet — the first will appear after the next weekly pipeline run
          (or a manual “Run workflow”).
        </div>
      ) : (
        <ul className="admin-list">
          {runs.map((r) => (
            <li key={r.id} className={`admin-run ${r.ok ? "ok" : "fail"}`}>
              <div className="admin-run-head">
                <span className="admin-run-when">{r.started_label}</span>
                <span className={`admin-pill ${r.ok ? "published" : "cancelled"}`}>
                  {r.ok ? "ok" : r.error ? "failed" : "running…"}
                </span>
              </div>
              <div className="admin-run-stats">
                <span><b>{r.upserted}</b> upserted</span>
                <span><b>{r.cancelled}</b> cancelled</span>
                <span><b>{r.collapsed}</b> collapsed</span>
                <span><b>{r.archived}</b> archived</span>
                {r.duration_s != null && <span>{r.duration_s}s</span>}
              </div>
              {r.bands && (
                <div className="admin-run-bands">
                  {Object.entries(r.bands).map(([band, n]) => (
                    <span key={band} className="admin-band">{band}: {n}</span>
                  ))}
                </div>
              )}
              {r.error && <div className="admin-run-error">{r.error}</div>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
