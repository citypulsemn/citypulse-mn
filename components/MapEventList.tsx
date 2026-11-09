"use client";

import { timeLabel } from "@/lib/dates";
import { isMultiDay, multiDayLabel } from "@/lib/multiday";
import { soonestFirstThenRuns } from "@/lib/list-view";
import type { EventRecord } from "@/lib/types";

/**
 * The scrollable event list that sits beside the map on desktop (U6b) — "browse the
 * list while seeing the pins." Clicking a row flies the map to that event's pin and
 * highlights it (via the parent's focusId). Compact rows (time · title · venue). Hidden
 * below 1000px, where the map goes full-width and the List view already covers the need.
 *
 * ORDER: the same plan ListView builds from the SAME array. The two are alternative
 * views rather than halves of one screen — you see the list or the map, never both — so
 * the point is that SWITCHING between them cannot change what is coming up. This sorted
 * by start, and
 * eventsInWindow went span-aware on 5 Nov 2026, so every run already underway sorted
 * ahead of everything happening today. Measured 8 Nov 2026 on the live set: the Today
 * view is 40 rows of which 20 began earlier, and the list opened on two exhibitions
 * from 23 May. The label beside them was fixed that week; the order was not.
 */
export function MapEventList({
  events,
  windowStartKey,
  todayKey,
  focusId,
  onFocus,
}: {
  events: EventRecord[];
  /** First day of the active range, as ListView receives it. */
  windowStartKey: string;
  todayKey: string;
  focusId: string | null;
  onFocus: (id: string) => void;
}) {
  if (events.length === 0) return null;
  const sorted = soonestFirstThenRuns(events, windowStartKey, todayKey);

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
          {/* A mid-run event reaching this list since 5 Nov 2026 would otherwise
              show only "9 AM" — its start clock, from a date outside the window.
              Same rule as EventDayCard with no dayKey: a run shows its span. */}
          <span className="mlr-time">
            {isMultiDay(e) ? multiDayLabel(e) : timeLabel(e)}
          </span>
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
