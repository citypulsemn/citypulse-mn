import type { EventRecord } from "./types";
import { matchVenueSlug } from "./venue-pages";
import { chiDayKey, chiWallClock } from "./clock";
import { dayOf, spanEnd } from "./multiday";
import { soonestFirstThenRuns } from "./list-view";

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
  // RULE 5 (9 Nov 2026). This asked `e.start >= nowWall` and nothing else — a
  // START question — so a run already underway at this very venue was absent
  // from the strip while the venue page the strip LINKS TO listed it, because
  // that page has used the span-aware isUpcoming since 5 Nov. A page could say
  // there was nothing else on while its own "See all" link said otherwise.
  //
  // The run clause is ADDED to the wall-clock floor rather than replacing it
  // with isUpcoming, which was the first cut here and was wrong. isUpcoming is
  // DAY-granular, so adopting it wholesale would also have brought back this
  // morning's finished concert until midnight — and R1.3 excludes that on
  // purpose ("the morning show is honestly past"), with two tests pinning it.
  // That is a deliberate difference from the venue page, not a bug, and this
  // change leaves it exactly as it was.
  const nowWall = chiWallClock(now);
  const todayKey = chiDayKey(now);
  /** Began earlier and has NOT closed — the reader can still go. */
  const stillRunning = (e: EventRecord) => {
    const end = spanEnd(e);
    return Boolean(end && dayOf(end) >= todayKey);
  };
  const upcoming = (e: EventRecord) =>
    e.status === "published" &&
    e.id !== current.id &&
    (e.start >= nowWall || stillRunning(e));

  const slug = matchVenueSlug(current.venue);
  if (slug) {
    // ORDER: the shared rule, not a start sort. Admitting runs without this
    // would have put a months-old exhibition at the head of the strip on 129
    // of 679 event pages (measured 9 Nov 2026) — only 5 venues and 4
    // neighbourhoods carry an underway run, but they feed that many pages.
    const atVenue = soonestFirstThenRuns(
      all.filter((e) => upcoming(e) && matchVenueSlug(e.venue) === slug),
      todayKey,
    ).slice(0, RELATED_CAP);
    if (atVenue.length > 0) return { kind: "venue", key: slug, events: atVenue };
  }

  if (current.neighborhood) {
    const nearby = soonestFirstThenRuns(
      all.filter((e) => upcoming(e) && e.neighborhood === current.neighborhood),
      todayKey,
    ).slice(0, RELATED_CAP);
    if (nearby.length > 0) return { kind: "neighborhood", key: current.neighborhood, events: nearby };
  }

  return null;
}
