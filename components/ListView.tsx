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
  todayKey,
}: {
  events: EventRecord[];
  windowStartKey: string;
  /** Chicago's today. "Already running" is decided from this, not from the
   *  window — see lib/list-view planListView for what happens when it is not. */
  todayKey: string;
}) {
  const plan = planListView(events, windowStartKey, todayKey);

  if (plan.ongoingTotal === 0 && plan.days.length === 0) {
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
            {/* A count, not a link. /ongoing cannot deliver what the cap drops:
                it requires a run LONGER than 3 days (MIN_RUN_DAYS), anchors on
                today rather than this window, and caps at 12 itself — and the
                headline case for this group is a three-day run. So say the
                number and stop, rather than point somewhere that will not have
                them. This also keeps an anchor out of a CSS grid container,
                where .more-day-all would stretch the full column width. */}
            {plan.ongoingTotal > plan.ongoing.length && (
              <p className="list-ongoing-more">
                + {plan.ongoingTotal - plan.ongoing.length} more running
              </p>
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
