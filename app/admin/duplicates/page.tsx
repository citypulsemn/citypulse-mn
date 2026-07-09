import { getDuplicatePairs } from "@/lib/admin";
import { archiveDuplicate } from "@/lib/admin-actions";

export const dynamic = "force-dynamic";

export default async function AdminDuplicatesPage() {
  const pairs = await getDuplicatePairs();

  return (
    <>
      <p className="admin-intro">
        Same-day events with similar titles the auto-collapse didn&apos;t catch. Archive the
        stray copy, or leave both if they&apos;re genuinely different events.
      </p>

      {pairs.length === 0 ? (
        <div className="admin-empty">No likely duplicates right now. 🎉</div>
      ) : (
        <ul className="admin-list">
          {pairs.map((p) => (
            <li key={`${p.keep_id}-${p.dup_id}`} className="admin-dup">
              <div className="admin-dup-day">{p.day} · {Math.round(p.sim * 100)}% title match</div>
              <div className="admin-dup-pair">
                <div className="admin-dup-item keep">
                  <div className="admin-dup-tag">Keep</div>
                  <div className="admin-dup-title">{p.keep_title}</div>
                  <div className="admin-dup-venue">{p.keep_venue}</div>
                </div>
                <div className="admin-dup-item">
                  <div className="admin-dup-tag">Duplicate?</div>
                  <div className="admin-dup-title">{p.dup_title}</div>
                  <div className="admin-dup-venue">{p.dup_venue}</div>
                  <form action={archiveDuplicate}>
                    <input type="hidden" name="id" value={p.dup_id} />
                    <button className="admin-btn danger">Archive this copy</button>
                  </form>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
