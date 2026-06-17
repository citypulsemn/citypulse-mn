"use client";

import { CATEGORIES } from "@/lib/categories";
import { DOW, MONTHS, fmtTime } from "@/lib/dates";
import type { EventRecord } from "@/lib/types";

function bgStyle(image: string): string {
  if (!image) return "var(--navy-600)";
  if (image.startsWith("http")) return `url("${image}") center/cover`;
  return image; // CSS gradient (sample data)
}

export function EventDetail({
  event,
  onClose,
}: {
  event: EventRecord;
  onClose: () => void;
}) {
  const cat = CATEGORIES[event.category];
  const d = new Date(event.start);
  const e = new Date(event.end);

  return (
    <div className="overlay" onClick={(ev) => ev.target === ev.currentTarget && onClose()}>
      <div className="marquee" role="dialog" aria-modal="true" aria-label={event.title}>
        <button className="closebtn" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <div className="detail-img" style={{ background: bgStyle(event.image) }} />
        <div className="detail-body">
          <div className="detail-cat" style={{ color: cat.color }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: cat.color,
                display: "inline-block",
              }}
            />
            {cat.label}
          </div>
          <div className="detail-title">{event.title}</div>
          <div className="detail-rows">
            <div className="drow">
              <div className="ic">◷</div>
              <div>
                <div className="dk">When</div>
                <div className="dv">
                  {DOW[d.getDay()]}, {MONTHS[d.getMonth()]} {d.getDate()} · {fmtTime(event.start)} – {fmtTime(event.end)}
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
        </div>
      </div>
    </div>
  );
}
