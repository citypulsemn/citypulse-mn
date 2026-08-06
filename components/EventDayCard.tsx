import { CATEGORIES } from "@/lib/categories";
import { timeLabel } from "@/lib/dates";
import { isMultiDay, multiDayLabel } from "@/lib/multiday";
import { SaveButton } from "./SaveButton";
import type { EventRecord } from "@/lib/types";

/**
 * A single event as a linked day-card — mirrors the in-app DayPanel card.
 *
 * UX3 — a compact ♡ save overlay lets people build their list WHILE browsing,
 * not just from the detail page (the retention bottleneck the audit found). The
 * save button is a SIBLING of the anchor (not nested — a button inside an <a>
 * is invalid and would hijack the tap), positioned over the top-right corner.
 * `showSave={false}` on the /saved page, where the row has its own ✕ remove.
 */
export function EventDayCard({
  event,
  showSave = true,
}: {
  event: EventRecord;
  showSave?: boolean;
}) {
  const c = CATEGORIES[event.category];
  const card = (
    <a className="daycard" href={`/event/${event.id}`}>
      <div className="time">
        {isMultiDay(event) ? (
          <span className="run-badge">{multiDayLabel(event)}</span>
        ) : (
          timeLabel(event)
        )}
      </div>
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

  if (!showSave) return card;

  return (
    <div className="daycard-wrap">
      {card}
      <SaveButton eventId={event.id} variant="compact" />
    </div>
  );
}
