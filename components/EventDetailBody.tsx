import { CATEGORIES } from "@/lib/categories";
import { DOW, MONTHS, fmtTime } from "@/lib/dates";
import type { EventRecord } from "@/lib/types";
import type { ReactNode } from "react";

export function bgStyle(image: string): string {
  if (!image) return "var(--navy-600)";
  if (image.startsWith("http")) return `url("${image}") center/cover`;
  return image; // CSS gradient (sample data)
}

/**
 * The single source of truth for an event's detail layout. Rendered inside the
 * modal (EventDetail) AND on the shareable page (app/event/[id]) so the two can
 * never drift. `actions` slots in below the ticket CTA (e.g. a Share button).
 */
export function EventDetailBody({
  event,
  actions,
}: {
  event: EventRecord;
  actions?: ReactNode;
}) {
  const cat = CATEGORIES[event.category];
  const d = new Date(event.start);
  const hasRange = Boolean(event.end) && event.end !== event.start;

  return (
    <>
      <div className="detail-img" style={{ background: bgStyle(event.image) }} />
      <div className="detail-body">
        <div className="detail-cat" style={{ color: cat.color }}>
          <span className="cat-dot" style={{ background: cat.color }} />
          {cat.label}
        </div>
        <h1 className="detail-title">{event.title}</h1>
        <div className="detail-rows">
          <div className="drow">
            <div className="ic">◷</div>
            <div>
              <div className="dk">When</div>
              <div className="dv">
                {DOW[d.getDay()]}, {MONTHS[d.getMonth()]} {d.getDate()} · {fmtTime(event.start)}
                {hasRange ? ` – ${fmtTime(event.end)}` : ""}
              </div>
            </div>
          </div>
          <div className="drow">
            <div className="ic">⚲</div>
            <div>
              <div className="dk">Where</div>
              <div className="dv">
                {event.venue}
                <br />
                {event.address}
                {event.city ? `, ${event.city}, MN` : ""}
              </div>
            </div>
          </div>
          <div className="drow">
            <div className="ic">＄</div>
            <div>
              <div className="dk">Price</div>
              <div className="dv">{event.price}</div>
            </div>
          </div>
        </div>
        {event.description && <div className="detail-desc">{event.description}</div>}
        {event.ticketUrl ? (
          <a className="ticket-btn" href={event.ticketUrl} target="_blank" rel="noopener noreferrer">
            Tickets &amp; Info
          </a>
        ) : (
          <span className="ticket-btn" style={{ opacity: 0.5, cursor: "default" }}>
            Details to come
          </span>
        )}
        {actions && <div className="detail-actions">{actions}</div>}
      </div>
    </>
  );
}
