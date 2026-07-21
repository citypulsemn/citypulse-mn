import { EventDayCard } from "./EventDayCard";
import {
  throughLabel,
  ongoingStripPlan,
  MIN_ONGOING,
  type OngoingEvent,
} from "@/lib/ongoing";

/**
 * "Ongoing" (roadmap 2.2) — the long runs' persistent home: exhibitions,
 * fairs, restaurant weeks. Ending-soonest first ("last chance" is the
 * angle). Self-hides below MIN_ONGOING — the trending honesty rule: no sad
 * placeholders, the homepage stays exactly as it was until there's enough.
 *
 * F2.2 — when at least MIN_LAST_CHANCE runs close within the week, the strip
 * swaps to "Last chance / Ends this week" and shows ONLY those runs (the
 * plan never pads an urgent label with non-urgent items).
 */
export function OngoingStrip({ ongoing, now }: { ongoing: OngoingEvent[]; now: Date }) {
  if (ongoing.length < MIN_ONGOING) return null;
  const plan = ongoingStripPlan(ongoing, now);

  return (
    <section className="trending" aria-labelledby="ongoing-title">
      <div className="trending-head">
        <h2 id="ongoing-title" className="trending-title">
          {plan.lastChance ? "Last chance" : "Ongoing"}
        </h2>
        <span className="trending-sub">
          {plan.lastChance ? "Ends this week" : "Catch these before they close"}
        </span>
        <a className="trending-all" href="/ongoing">See all →</a>
      </div>
      <div className="trending-row">
        {plan.items.map(({ event, endDay }) => (
          <div className="trending-card" key={event.id}>
            <div className="ongoing-through">{throughLabel(endDay, now)}</div>
            <EventDayCard event={event} />
          </div>
        ))}
      </div>
    </section>
  );
}
