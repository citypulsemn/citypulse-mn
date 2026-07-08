import { CATEGORIES } from "@/lib/categories";
import { fmtTime } from "@/lib/dates";
import type { EventRecord } from "@/lib/types";

/** A single event as a linked day-card — mirrors the in-app DayPanel card. */
export function EventDayCard({ event }: { event: EventRecord }) {
  const c = CATEGORIES[event.category];
  return (
    <a className="daycard" href={`/event/${event.id}`}>
      <div className="time">{fmtTime(event.start)}</div>
      <div className="dc-body">
        <div className="dc-title">{event.title}</div>
        <div className="dc-meta">
          {event.venue}
          {event.city ? ` · ${event.city}` : ""} · {event.price}
        </div>
        <span className="catbadge" style={{ color: c.color }}>
          <span className="dot" style={{ background: c.color }} />
          {c.label}
        </span>
      </div>
    </a>
  );
}
