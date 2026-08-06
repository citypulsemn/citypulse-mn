import { groupEventsByDay } from "@/lib/list-view";
import { longDate } from "@/lib/event-view";
import { EventDayCard } from "./EventDayCard";
import type { EventRecord } from "@/lib/types";

/**
 * The homepage LIST view (UX4) — the windowed, filtered events as a chronological
 * agenda grouped by day, the format that reads on a phone and that the date
 * presets now drive directly (no more tap-each-day). Reuses EventDayCard, so
 * every row carries the UX3 ♡ save overlay.
 */
export function ListView({
  events,
  windowStartKey,
}: {
  events: EventRecord[];
  windowStartKey: string;
}) {
  if (events.length === 0) {
    return (
      <div className="day-empty">
        Nothing in this range yet. Try a wider range above, or clear a filter.
      </div>
    );
  }

  const groups = groupEventsByDay(events, windowStartKey);

  return (
    <div className="list-view">
      {groups.map((g) => (
        <section key={g.key} className="list-day">
          <h2 className="list-day-h">{longDate(g.key)}</h2>
          <div className="day-list">
            {g.events.map((e: EventRecord) => (
              <EventDayCard key={e.id} event={e} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
