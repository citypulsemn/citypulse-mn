import { getAdminEvents } from "@/lib/admin";
import { AdminEventRow } from "@/components/admin/AdminEventRow";

export const dynamic = "force-dynamic"; // admin is always live, never cached

export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q ?? "";
  const status = sp.status ?? "all";
  const events = await getAdminEvents({ q, status });

  return (
    <>
      <form className="admin-search" method="get">
        <input name="q" defaultValue={q} placeholder="Search title, venue, city…" aria-label="Search events" />
        <select name="status" defaultValue={status} aria-label="Filter by status">
          <option value="all">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Hidden (draft)</option>
          <option value="cancelled">Cancelled</option>
          <option value="archived">Archived</option>
        </select>
        <button className="admin-btn">Filter</button>
      </form>

      <div className="admin-count">
        {events.length} event{events.length === 1 ? "" : "s"}
        {events.length === 100 ? " (showing newest 100)" : ""}
      </div>

      {events.length === 0 ? (
        <div className="admin-empty">No events match.</div>
      ) : (
        <ul className="admin-list">
          {events.map((e) => (
            <AdminEventRow key={e.id} e={e} />
          ))}
        </ul>
      )}
    </>
  );
}
