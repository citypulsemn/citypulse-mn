import { EventDayCard } from "./EventDayCard";
import type { FeaturedItem } from "@/lib/featured";

/**
 * Featured placements (Monetization R2.2). A clearly-LABELED band shown ABOVE the
 * organic list — never mixed into it. Renders NOTHING when there are no active
 * placements (the dormant default), so every surface looks exactly as it does
 * today until a venue buys. Each card carries a visible "Featured" chip: honest
 * disclosure of paid placement, the house's no-dark-patterns rule made literal.
 */
export function FeaturedRow({ items }: { items: FeaturedItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className="featured" aria-labelledby="featured-title">
      <div className="featured-head">
        <h2 id="featured-title" className="featured-title">Featured</h2>
        <span className="featured-sub">Paid placement — kept separate from the listings below.</span>
      </div>
      <div className="featured-row">
        {items.map(({ event, label }) => (
          <div className="featured-card" key={event.id}>
            <span className="featured-tag">{label}</span>
            <EventDayCard event={event} />
          </div>
        ))}
      </div>
    </section>
  );
}
