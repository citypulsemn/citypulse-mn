import { getContentStats } from "@/lib/admin";
import { getSubscriberStats } from "@/lib/subscribe";
import { CATEGORIES } from "@/lib/categories";
import type { CategoryKey } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminStatsPage() {
  const s = await getContentStats();
  const subs = await getSubscriberStats();

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

      <div className="admin-note">
        <strong>Engagement metrics</strong> (page views, ticket clicks, searches, Web Vitals)
        live in your <a href="https://vercel.com/dashboard" target="_blank" rel="noopener noreferrer">Vercel dashboard → Analytics</a>.
        An on-site engagement snapshot arrives with roadmap 5.4 (first-party <code>event_stats</code>).
      </div>
    </>
  );
}
