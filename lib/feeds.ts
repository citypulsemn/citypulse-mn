import { CATEGORIES, CATEGORY_KEYS } from "./categories";
import { COLLECTIONS, getCollection, type CollectionSpec } from "./collections";
import { matchesQuery } from "./search";
import { matchesPrice, matchesArea } from "./filters";
import { venuePageBySlug, matchVenueSlug, VENUE_PAGES } from "./venue-pages";
import { neighborhoodByKey, eventNeighborhood, NEIGHBORHOODS } from "./neighborhoods";
import { weekendDays, chiDayKey } from "./weekend";
import { spanEnd, spansDay, dayOf } from "./multiday";
import type { CategoryKey, EventRecord } from "./types";

/**
 * iCAL FEEDS (roadmap 6.1). "Subscribe to Live Music in Minneapolis in your
 * own calendar" — one slug namespace, resolved to a feed spec, selected with
 * a rolling window, emitted by feedICS in lib/ics.ts.
 *
 * Slug namespace (collision-checked by the drift-guard tests):
 *   this-weekend             — the weekend selection
 *   music, arts, unique, …   — categories ("unique" maps to the internal
 *                              "weird" key; the raw key is NOT a valid slug)
 *   live-music, date-night…  — collections (their filters, feed's window)
 *   venue-first-avenue       — venues, "venue-" + registry slug
 *   uptown, como, …          — neighborhoods by registry key
 *
 * Window: rolling FEED_WINDOW_DAYS with TRUE-SPAN intersection (rule 5) — an
 * ongoing festival mid-run belongs in the feed even though it started weeks
 * ago. The one exception is this-weekend, which uses the weekend's own days.
 */

export const FEED_WINDOW_DAYS = 30;
const DAY_MS = 86_400_000;

export type FeedKind = "this-weekend" | "category" | "collection" | "venue" | "neighborhood";

export interface FeedSpec {
  kind: FeedKind;
  /** Registry key (category key, collection/venue slug, neighborhood key). */
  key: string;
  /** Calendar display name (X-WR-CALNAME). */
  name: string;
  slug: string;
}

/** Feed slug for a category key ("weird" is branded "unique" everywhere user-facing). */
export function categoryFeedSlug(key: CategoryKey): string {
  return key === "weird" ? "unique" : key;
}

const CATEGORY_BY_SLUG = new Map<string, CategoryKey>(
  CATEGORY_KEYS.map((k) => [categoryFeedSlug(k), k]),
);

export function resolveFeed(slug: string): FeedSpec | null {
  if (slug === "this-weekend") {
    return { kind: "this-weekend", key: slug, name: "This Weekend — City Pulse MN", slug };
  }

  const cat = CATEGORY_BY_SLUG.get(slug);
  if (cat) {
    return { kind: "category", key: cat, name: `${CATEGORIES[cat].label} — City Pulse MN`, slug };
  }

  const coll = getCollection(slug);
  if (coll) {
    return { kind: "collection", key: coll.slug, name: `${coll.title} — City Pulse MN`, slug };
  }

  if (slug.startsWith("venue-")) {
    const venue = venuePageBySlug(slug.slice("venue-".length));
    if (venue) return { kind: "venue", key: venue.slug, name: `${venue.name} — City Pulse MN`, slug };
    return null;
  }

  const hood = neighborhoodByKey(slug);
  if (hood) {
    return { kind: "neighborhood", key: hood.key, name: `${hood.label} — City Pulse MN`, slug };
  }

  return null;
}

/** Every advertised feed slug (for docs and the drift-guard test). */
export function allFeedSlugs(): string[] {
  return [
    "this-weekend",
    ...CATEGORY_KEYS.map(categoryFeedSlug),
    ...COLLECTIONS.map((c) => c.slug),
    ...VENUE_PAGES.map((v) => `venue-${v.slug}`),
    ...NEIGHBORHOODS.map((n) => n.key),
  ];
}

/** True-span intersection with the rolling window [today, today+N days]. */
function inWindow(ev: EventRecord, startKey: string, endKey: string): boolean {
  const first = dayOf(ev.start);
  const last = dayOf(spanEnd(ev) ?? ev.start);
  return first <= endKey && last >= startKey;
}

function matchesCollection(ev: EventRecord, spec: CollectionSpec): boolean {
  const cats = spec.categories ? new Set(spec.categories) : null;
  if (cats && !cats.has(ev.category)) return false;
  if (!matchesPrice(ev, new Set(spec.prices ?? []))) return false;
  if (!matchesArea(ev, new Set(spec.areas ?? []))) return false;
  if (spec.query && !matchesQuery(ev, spec.query)) return false;
  return true;
}

export function selectFeedEvents(events: EventRecord[], feed: FeedSpec, now: Date): EventRecord[] {
  const published = events.filter((e) => e.status === "published");

  let picked: EventRecord[];
  if (feed.kind === "this-weekend") {
    const days = weekendDays(now);
    picked = published.filter((e) => days.some((d) => spansDay(e, d)));
  } else {
    const startKey = chiDayKey(now);
    const endKey = chiDayKey(new Date(now.getTime() + FEED_WINDOW_DAYS * DAY_MS));
    const windowed = published.filter((e) => inWindow(e, startKey, endKey));
    switch (feed.kind) {
      case "category":
        picked = windowed.filter((e) => e.category === feed.key);
        break;
      case "collection": {
        const spec = getCollection(feed.key);
        picked = spec ? windowed.filter((e) => matchesCollection(e, spec)) : [];
        break;
      }
      case "venue":
        picked = windowed.filter((e) => matchVenueSlug(e.venue) === feed.key);
        break;
      case "neighborhood":
        picked = windowed.filter((e) => eventNeighborhood(e) === feed.key);
        break;
    }
  }

  return [...picked].sort((a, b) => a.start.localeCompare(b.start));
}
