import { planListView } from "@/lib/list-view";
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
  const plan = planListView(events, windowStartKey);

  if (plan.ongoing.length === 0 && plan.days.length === 0) {
    return (
      <div className="day-empty">
        Nothing in this range yet. Try a wider range above, or clear a filter.
      </div>
    );
  }

  return (
    <div className="list-view">
      {/* Runs that began before this window and are still on. Capped and
          ending-soonest-first, so a six-month exhibition cannot push the things
          actually starting off the top of the list. Same shape as the /day
          shelf. Each card carries its own span badge ("May 23 – Jan 10"), so the
          dates explain themselves. */}
      {plan.ongoing.length > 0 && (
        <section className="list-day">
          <h2 className="list-day-h">Already running</h2>
          <div className="day-list">
            {plan.ongoing.map((e: EventRecord) => (
              <EventDayCard key={e.id} event={e} />
            ))}
            {plan.ongoingTotal > plan.ongoing.length && (
              <a className="more-day-all" href="/ongoing">
                More ongoing runs →
              </a>
            )}
          </div>
        </section>
      )}
      {plan.days.map((g) => (
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
