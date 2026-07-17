import type { EventRecord } from "./types";
import { matchVenueSlug } from "./venue-pages";

/**
 * "MORE AT THIS VENUE" (roadmap 3.2) — internal links that earn their place.
 *
 * On an event page: the next few upcoming events at the same venue (matched
 * through the SAME alias machinery the venue pages use — "First Ave" and
 * "7th St Entry" both resolve to first-avenue). If the venue has nothing
 * else coming up, fall back to the event's neighborhood. If neither, render
 * nothing — the honest-emptiness rule.
 */

export const RELATED_CAP = 4;

export interface Related {
  kind: "venue" | "neighborhood";
  /** Venue slug or neighborhood key, for the "see all" link. */
  key: string;
  events: EventRecord[];
}

export function selectRelated(all: EventRecord[], current: EventRecord, now: Date): Related | null {
  const nowMs = now.getTime();
  const upcoming = (e: EventRecord) =>
    e.status === "published" &&
    e.id !== current.id &&
    new Date(e.start).getTime() >= nowMs;

  const slug = matchVenueSlug(current.venue);
  if (slug) {
    const atVenue = all
      .filter((e) => upcoming(e) && matchVenueSlug(e.venue) === slug)
      .sort((a, b) => a.start.localeCompare(b.start))
      .slice(0, RELATED_CAP);
    if (atVenue.length > 0) return { kind: "venue", key: slug, events: atVenue };
  }

  if (current.neighborhood) {
    const nearby = all
      .filter((e) => upcoming(e) && e.neighborhood === current.neighborhood)
      .sort((a, b) => a.start.localeCompare(b.start))
      .slice(0, RELATED_CAP);
    if (nearby.length > 0) return { kind: "neighborhood", key: current.neighborhood, events: nearby };
  }

  return null;
}
