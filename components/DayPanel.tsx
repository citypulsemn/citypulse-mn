"use client";

import { CATEGORIES } from "@/lib/categories";
import { DOW, MONTHS } from "@/lib/dates";
import { splitDayEvents, dayTimeLabel } from "@/lib/day-order";
import { useModalA11y } from "./useModalA11y";
import type { EventRecord } from "@/lib/types";

export function DayPanel({
  dateKey,
  events,
  onPick,
  onClose,
}: {
  dateKey: string;
  events: EventRecord[];
  onPick: (ev: EventRecord) => void;
  onClose: () => void;
}) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dateObj = new Date(y, m - 1, d);
  const dialogRef = useModalA11y<HTMLDivElement>();
  // Same split the /day page renders. `events` arrives already ordered; this
  // only recovers WHERE the boundary is so the leading run of already-running
  // events gets a heading instead of just looking out of clock order.
  const { ongoing, timed } = splitDayEvents(events, dateKey);

  return (
    <div className="overlay" onClick={(ev) => ev.target === ev.currentTarget && onClose()}>
      <div className="marquee" role="dialog" aria-modal="true" aria-labelledby="daypanel-heading" ref={dialogRef}>
        <div className="marquee-head">
          <button className="closebtn" onClick={onClose} aria-label="Close">
            ✕
          </button>
          <div className="dow">{DOW[dateObj.getDay()]}</div>
          <div className="big" id="daypanel-heading">
            {MONTHS[m - 1]} {d}
          </div>
        </div>
        <div className="marquee-body">
          {events.length === 0 ? (
            <div className="empty-day">
              No events match your filters on this day.
              <br />
              Try turning more categories on.
            </div>
          ) : (
            [
              ...(ongoing.length > 0 ? [{ head: "Already running", list: ongoing }] : []),
              ...(timed.length > 0
                ? [{ head: ongoing.length > 0 ? "Starting today" : null, list: timed }]
                : []),
            ].flatMap((group) => [
              group.head ? (
                <h3 className="day-group-head" key={`h-${group.head}`}>
                  {group.head}
                </h3>
              ) : null,
              ...group.list.map((ev) => {
              const c = CATEGORIES[ev.category];
              return (
                <button className="daycard" key={ev.id} onClick={() => onPick(ev)}>
                  <div className="time">
                    {ev.start.slice(0, 10) < dateKey ? (
                      <span className="run-badge">{dayTimeLabel(ev, dateKey)}</span>
                    ) : (
                      dayTimeLabel(ev, dateKey)
                    )}
                  </div>
                  <div className="dc-body">
                    <div className="dc-title">{ev.title}</div>
                    <div className="dc-meta">
                      {ev.venue} · {ev.city} · {ev.price}
                    </div>
                    <span className="catbadge" style={{ color: c.color }}>
                      <span className="dot" style={{ background: c.color }} />
                      {c.label}
                    </span>
                  </div>
                </button>
              );
              }),
            ])
          )}
        </div>
      </div>
    </div>
  );
}
