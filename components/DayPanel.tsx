"use client";

import { CATEGORIES } from "@/lib/categories";
import { DOW, MONTHS, fmtTime } from "@/lib/dates";
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

  return (
    <div className="overlay" onClick={(ev) => ev.target === ev.currentTarget && onClose()}>
      <div className="marquee" role="dialog" aria-modal="true">
        <div className="marquee-head">
          <button className="closebtn" onClick={onClose} aria-label="Close">
            ✕
          </button>
          <div className="dow">{DOW[dateObj.getDay()]}</div>
          <div className="big">
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
            events.map((ev) => {
              const c = CATEGORIES[ev.category];
              return (
                <button className="daycard" key={ev.id} onClick={() => onPick(ev)}>
                  <div className="time">{fmtTime(ev.start)}</div>
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
            })
          )}
        </div>
      </div>
    </div>
  );
}
