import { EventDayCard } from "./EventDayCard";
import type { ScoredEvent } from "@/lib/trending";

/**
 * "Trending now" (roadmap 5.2) — the first public surface fed by the 5.1
 * feedback loop. Renders NOTHING unless trending has earned its place: the
 * all-or-nothing minimum lives in rankTrending, so an empty array here simply
 * means the section doesn't exist yet. No sad placeholders, no "check back
 * soon" — the homepage stays exactly as it was until the data is real.
 */
export function TrendingStrip({ trending }: { trending: ScoredEvent[] }) {
  if (trending.length === 0) return null;

  return (
    <section className="trending" aria-labelledby="trending-title">
      <div className="trending-head">
        <h2 id="trending-title" className="trending-title">Trending now</h2>
        <span className="trending-sub">What the Twin Cities is clicking on this week</span>
        <a className="trending-all" href="/collections/trending">See all →</a>
      </div>
      <div className="trending-row">
        {trending.slice(0, 6).map(({ event }) => (
          <div className="trending-card" key={event.id}>
            <EventDayCard event={event} />
          </div>
        ))}
      </div>
    </section>
  );
}
