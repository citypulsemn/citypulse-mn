import { selectRelated } from "@/lib/related";
import { venuePageBySlug } from "@/lib/venue-pages";
import { NEIGHBORHOODS } from "@/lib/neighborhoods";
import { timeLabel } from "@/lib/dates";
import type { EventRecord } from "@/lib/types";

/**
 * "More at this venue" (roadmap 3.2) — the internal-link strip on event
 * pages. Venue first (via the alias machinery), neighborhood fallback,
 * nothing if neither — no sad placeholders.
 */
export function MoreAtVenue({ all, current, now }: { all: EventRecord[]; current: EventRecord; now: Date }) {
  const related = selectRelated(all, current, now);
  if (!related) return null;

  const heading =
    related.kind === "venue"
      ? `More at ${venuePageBySlug(related.key)?.name ?? current.venue}`
      : `More in ${NEIGHBORHOODS.find((n) => n.key === related.key)?.label ?? "the neighborhood"}`;
  const allHref = related.kind === "venue" ? `/venues/${related.key}` : `/neighborhoods/${related.key}`;

  return (
    <section className="more-at" aria-labelledby="more-at-title">
      <div className="more-at-head">
        <h2 id="more-at-title" className="more-at-title">{heading}</h2>
        <a className="more-at-all" href={allHref}>See all →</a>
      </div>
      <ul className="more-at-list">
        {related.events.map((e) => (
          <li key={e.id}>
            <a href={`/event/${e.id}`}>
              <span className="more-at-date">
                {new Date(`${e.start.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })}
              </span>
              <span className="more-at-name">{e.title}</span>
              <span className="more-at-time">{timeLabel(e)}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
