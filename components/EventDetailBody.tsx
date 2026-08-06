import { CATEGORIES } from "@/lib/categories";
import { DOW, MONTHS, fmtTime } from "@/lib/dates";
import { TicketButton } from "./TicketButton";
import { AddToCalendar } from "./AddToCalendar";
import { SaveButton } from "./SaveButton";
import { isMultiDay, multiDayLabel, runLength } from "@/lib/multiday";
import { neighborhoodByKey } from "@/lib/neighborhoods";
import { matchVenueSlug } from "@/lib/venue-pages";
import { eventTimeState, timeStateLabel, isDeadEvent, directionsUrl } from "@/lib/event-view";
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

  // UX1 — the body owns the event's status so the page AND the modal agree
  // (the modal never had a time-state banner before this). A dead event —
  // cancelled, or already ended/archived — must not offer live actions.
  const now = new Date();
  const cancelled = event.status === "cancelled";
  const timeState = cancelled
    ? null
    : event.status === "archived"
      ? ({ kind: "ended" } as const)
      : eventTimeState(event, now);
  const bannerClass =
    timeState?.kind === "ended" ? "ended" : timeState?.kind === "now" ? "live" : "soon";
  const dead = isDeadEvent(event, now);
  const dir = directionsUrl(event); // UX5 — the "get me there" deep-link
  const whereLine = [event.address, event.city ? `${event.city}, MN` : ""].filter(Boolean).join(", ");

  return (
    <>
      {cancelled && (
        <div className="evt-banner cancelled">This event has been cancelled.</div>
      )}
      {timeState && timeStateLabel(timeState) && (
        <div className={`evt-banner ${bannerClass}`}>{timeStateLabel(timeState)}</div>
      )}
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
                {isMultiDay(event) ? (
                  <>
                    {multiDayLabel(event)}{" "}
                    <span className="run-note">
                      · runs {runLength(event)} days
                      {event.allDay ? "" : ` · daily from ${fmtTime(event.start)}`}
                    </span>
                  </>
                ) : event.allDay ? (
                  <>
                    {DOW[d.getDay()]}, {MONTHS[d.getMonth()]} {d.getDate()} · All day
                  </>
                ) : (
                  <>
                    {DOW[d.getDay()]}, {MONTHS[d.getMonth()]} {d.getDate()} · {fmtTime(event.start)}
                    {hasRange ? ` – ${fmtTime(event.end)}` : ""}
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="drow">
            <div className="ic">⚲</div>
            <div>
              <div className="dk">Where</div>
              <div className="dv">
                {matchVenueSlug(event.venue) ? (
                  <a className="venue-link" href={`/venues/${matchVenueSlug(event.venue)}`}>
                    {event.venue}
                  </a>
                ) : (
                  event.venue
                )}
                {event.neighborhood && neighborhoodByKey(event.neighborhood) ? (
                  <span className="nbhd-chip">
                    <a href={`/neighborhoods/${event.neighborhood}`}>
                      {neighborhoodByKey(event.neighborhood)!.label}
                    </a>
                  </span>
                ) : null}
                <br />
                {dir ? (
                  <a className="dir-link" href={dir} target="_blank" rel="noopener noreferrer">
                    {whereLine || "Get directions"}
                    <span className="dir-go"> · Directions ↗</span>
                  </a>
                ) : (
                  whereLine
                )}
              </div>
            </div>
          </div>
          {event.price && (
            <div className="drow">
              <div className="ic">＄</div>
              <div>
                <div className="dk">Price</div>
                <div className="dv">{event.price}</div>
              </div>
            </div>
          )}
        </div>
        {event.description && <div className="detail-desc">{event.description}</div>}
        {/* UX1 — a dead event shows no live CTA; the banner above explains why.
            Share (in `actions`) stays so the page is still useful when shared. */}
        {!dead && <TicketButton event={event} />}
        {!dead && (
          <div className="detail-save-row">
            <SaveButton eventId={event.id} />
            <AddToCalendar event={event} />
          </div>
        )}
        {actions && <div className="detail-actions">{actions}</div>}
      </div>
    </>
  );
}
