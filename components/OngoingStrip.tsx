import { EventDayCard } from "./EventDayCard";
import { throughLabel, MIN_ONGOING, type OngoingEvent } from "@/lib/ongoing";

/**
 * "Ongoing" (roadmap 2.2) — the long runs' persistent home: exhibitions,
 * fairs, restaurant weeks. Ending-soonest first ("last chance" is the
 * angle). Self-hides below MIN_ONGOING — the trending honesty rule: no sad
 * placeholders, the homepage stays exactly as it was until there's enough.
 */
export function OngoingStrip({ ongoing, now }: { ongoing: OngoingEvent[]; now: Date }) {
  if (ongoing.length < MIN_ONGOING) return null;

  return (
    <section className="trending" aria-labelledby="ongoing-title">
      <div className="trending-head">
        <h2 id="ongoing-title" className="trending-title">Ongoing</h2>
        <span className="trending-sub">Catch these before they close</span>
        <a className="trending-all" href="/ongoing">See all →</a>
      </div>
      <div className="trending-row">
        {ongoing.slice(0, 6).map(({ event, endDay }) => (
          <div className="trending-card" key={event.id}>
            <div className="ongoing-through">{throughLabel(endDay, now)}</div>
            <EventDayCard event={event} />
          </div>
        ))}
      </div>
    </section>
  );
}
