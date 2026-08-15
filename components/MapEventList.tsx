"use client";

import { timeLabel } from "@/lib/dates";
import type { EventRecord } from "@/lib/types";

/**
 * The scrollable event list that sits beside the map on desktop (U6b) — "browse the
 * list while seeing the pins." Clicking a row flies the map to that event's pin and
 * highlights it (via the parent's focusId). Compact rows (time · title · venue), sorted
 * chronologically. Hidden below 1000px, where the map goes full-width and the List
 * view already covers the need.
 */
export function MapEventList({
  events,
  focusId,
  onFocus,
}: {
  events: EventRecord[];
  focusId: string | null;
  onFocus: (id: string) => void;
}) {
  if (events.length === 0) return null;
  const sorted = [...events].sort((a, b) => a.start.localeCompare(b.start));

  return (
    <div className="map-list" role="list" aria-label="Events on the map">
      {sorted.map((e) => (
        <button
          key={e.id}
          type="button"
          role="listitem"
          className={`map-list-row ${focusId === e.id ? "on" : ""}`}
          onClick={() => onFocus(e.id)}
          aria-pressed={focusId === e.id}
        >
          <span className="mlr-time">{timeLabel(e)}</span>
          <span className="mlr-body">
            <span className="mlr-title">{e.title}</span>
            <span className="mlr-meta">
              {e.venue} · {e.city}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
