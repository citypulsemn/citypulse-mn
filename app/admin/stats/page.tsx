import { getContentStats } from "@/lib/admin";
import { getEngagement, ctr } from "@/lib/stats";
import { getSubscriberStats } from "@/lib/subscribe";
import { CATEGORIES } from "@/lib/categories";
import type { CategoryKey } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const sp = await searchParams;
  const days = sp.days === "30" ? 30 : 7;
  const s = await getContentStats();
  const subs = await getSubscriberStats();
  const eng = await getEngagement(days);

  return (
    <>
      <div className="admin-stats-grid">
        <div className="admin-stat">
          <div className="admin-stat-n">{s.published}</div>
          <div className="admin-stat-l">Published (live)</div>
        </div>
        <div className="admin-stat">
          <div className="admin-stat-n">{s.upcoming}</div>
          <div className="admin-stat-l">Upcoming</div>
        </div>
        <div className="admin-stat">
          <div className="admin-stat-n">{s.addedLast7d}</div>
          <div className="admin-stat-l">Added last 7 days</div>
        </div>
        <div className="admin-stat">
          <div className="admin-stat-n">{s.draft}</div>
          <div className="admin-stat-l">Hidden (draft)</div>
        </div>
        <div className="admin-stat">
          <div className="admin-stat-n">{s.cancelled}</div>
          <div className="admin-stat-l">Cancelled</div>
        </div>
        <div className="admin-stat">
          <div className="admin-stat-n">{s.archived}</div>
          <div className="admin-stat-l">Archived</div>
        </div>
      </div>

      <h3 className="admin-h3">Published by category</h3>
      <ul className="admin-catbars">
        {s.byCategory.map((c) => {
          const meta = CATEGORIES[c.category as CategoryKey];
          const max = s.byCategory[0]?.n || 1;
          return (
            <li key={c.category} className="admin-catbar">
              <span className="admin-catbar-label">{meta?.label ?? c.category}</span>
              <span className="admin-catbar-track">
                <span
                  className="admin-catbar-fill"
                  style={{ width: `${(c.n / max) * 100}%`, background: meta?.color ?? "#888" }}
                />
              </span>
              <span className="admin-catbar-n">{c.n}</span>
            </li>
          );
        })}
      </ul>

      <h3 className="admin-h3">Email subscribers</h3>
      <div className="admin-stats-grid">
        <div className="admin-stat">
          <div className="admin-stat-n">{subs.total}</div>
          <div className="admin-stat-l">Subscribers</div>
        </div>
        <div className="admin-stat">
          <div className="admin-stat-n">{subs.last7d}</div>
          <div className="admin-stat-l">New last 7 days</div>
        </div>
        <div className="admin-stat admin-stat-action">
          <a className="admin-btn" href="/admin/subscribers/export">Download CSV</a>
        </div>
      </div>

      <h3 className="admin-h3">
        Engagement — last {days} days{" "}
        <span className="admin-h3-links">
          <a href="/admin/stats?days=7" className={days === 7 ? "active" : ""}>7d</a>
          {" · "}
          <a href="/admin/stats?days=30" className={days === 30 ? "active" : ""}>30d</a>
        </span>
      </h3>
      <div className="admin-stats-grid stats-grid-5">
        <div className="admin-stat">
          <div className="admin-stat-n">{eng.totals.view}</div>
          <div className="admin-stat-l">Event views</div>
        </div>
        <div className="admin-stat">
          <div className="admin-stat-n">{eng.totals.ticket_click}</div>
          <div className="admin-stat-l">Ticket clicks</div>
        </div>
        <div className="admin-stat">
          <div className="admin-stat-n">{ctr(eng.totals.view, eng.totals.ticket_click)}%</div>
          <div className="admin-stat-l">View → ticket CTR</div>
        </div>
        <div className="admin-stat">
          <div className="admin-stat-n">{eng.totals.save}</div>
          <div className="admin-stat-l">Saves</div>
        </div>
        <div className="admin-stat">
          <div className="admin-stat-n">{eng.totals.calendar}</div>
          <div className="admin-stat-l">Calendar adds</div>
        </div>
      </div>

      {eng.top.length === 0 ? (
        <div className="admin-note">
          No engagement recorded yet. Counters start the moment this deploy is live —
          views, ticket clicks, saves, and calendar adds, first-party in <code>event_stats</code>.
        </div>
      ) : (
        <>
          <h3 className="admin-h3">Top events</h3>
          <div className="cov-scroll">
            <table className="cov-table">
              <thead>
                <tr>
                  <th>Event</th><th>When</th><th>Views</th><th>Tickets</th>
                  <th>CTR</th><th>Saves</th><th>Cal</th>
                </tr>
              </thead>
              <tbody>
                {eng.top.map((t) => (
                  <tr key={t.id}>
                    <td><a href={`/event/${t.id}`}>{t.title}</a></td>
                    <td>{t.start.slice(0, 10)}</td>
                    <td>{t.view}</td>
                    <td>{t.ticket_click}</td>
                    <td>{ctr(t.view, t.ticket_click)}%</td>
                    <td>{t.save}</td>
                    <td>{t.calendar}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="admin-h3">By day</h3>
          <div className="cov-scroll">
            <table className="cov-table">
              <thead>
                <tr><th>Day</th><th>Views</th><th>Tickets</th><th>Saves</th><th>Cal</th></tr>
              </thead>
              <tbody>
                {eng.daily.map((d) => (
                  <tr key={d.day}>
                    <td>{d.day}</td>
                    <td>{d.view}</td>
                    <td>{d.ticket_click}</td>
                    <td>{d.save}</td>
                    <td>{d.calendar}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="admin-note">
        First-party and aggregate-only: one counter per event, day, and action — no user
        identifiers, no IPs, no cookies. Site-wide vitals still live in{" "}
        <a href="https://vercel.com/dashboard" target="_blank" rel="noopener noreferrer">Vercel → Analytics</a>.
      </div>
    </>
  );
}
