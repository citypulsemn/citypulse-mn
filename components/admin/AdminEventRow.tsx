import { CATEGORIES } from "@/lib/categories";
import { DOW, MONTHS, fmtTime } from "@/lib/dates";
import {
  hideEvent,
  restoreEvent,
  archiveEvent,
  updateEvent,
} from "@/lib/admin-actions";
import type { AdminEvent } from "@/lib/admin";

function whenLabel(e: AdminEvent): string {
  const d = new Date(e.start);
  return `${DOW[d.getDay()].slice(0, 3)} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()} · ${fmtTime(e.start)}`;
}

export function AdminEventRow({ e }: { e: AdminEvent }) {
  const cat = CATEGORIES[e.category];
  return (
    <li className="admin-row">
      <div className="admin-row-head">
        <div className="admin-row-main">
          <div className="admin-row-title">
            <span className="admin-catdot" style={{ background: cat.color }} />
            {e.title}
          </div>
          <div className="admin-row-meta">
            {whenLabel(e)} · {e.venue}
            {e.city ? ` · ${e.city}` : ""} · {e.price}
          </div>
        </div>
        <span className={`admin-pill ${e.status}`}>{e.status}</span>
      </div>

      <div className="admin-actions">
        {e.status === "published" ? (
          <form action={hideEvent}>
            <input type="hidden" name="id" value={e.id} />
            <button className="admin-btn">Hide</button>
          </form>
        ) : (
          <form action={restoreEvent}>
            <input type="hidden" name="id" value={e.id} />
            <button className="admin-btn">Publish</button>
          </form>
        )}

        <details className="admin-disclosure">
          <summary className="admin-btn">Edit</summary>
          <form action={updateEvent} className="admin-form">
            <input type="hidden" name="id" value={e.id} />
            <label>Title<input name="title" defaultValue={e.title} maxLength={200} /></label>
            <label>Venue<input name="venue" defaultValue={e.venue} maxLength={160} /></label>
            <label>City<input name="city" defaultValue={e.city} maxLength={80} /></label>
            <div className="admin-form-row">
              <label>Start<input type="datetime-local" name="start" defaultValue={e.start} /></label>
              <label>End<input type="datetime-local" name="end" defaultValue={e.end} /></label>
            </div>
            <label>Price<input name="price" defaultValue={e.price} maxLength={40} /></label>
            <label>Ticket URL<input name="ticket_url" type="url" defaultValue={e.ticketUrl} /></label>
            <label>Description<textarea name="description" defaultValue={e.description} rows={3} /></label>
            <button className="admin-btn primary">Save changes</button>
          </form>
        </details>

        <details className="admin-disclosure">
          <summary className="admin-btn danger">Archive</summary>
          <form action={archiveEvent} className="admin-confirm">
            <input type="hidden" name="id" value={e.id} />
            <span>Remove from the site?</span>
            <button className="admin-btn danger">Confirm archive</button>
          </form>
        </details>
      </div>
    </li>
  );
}
