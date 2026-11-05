import { matchesQuery, type QueryScope } from "./search";
import { matchesPrice, matchesArea } from "./filters";
import { chiWallClock, chiDayKey } from "./clock";
import { weekendDays } from "./weekend";
import { dayOf, spanEnd, spansDay, spansWindow } from "./multiday";
import type { EventRecord, CategoryKey, PriceTier } from "./types";
import type { AreaKey } from "./areas";

/**
 * Collections are curated, shareable views — essentially named filter
 * combinations with their own SEO landing pages. Editorial only (never
 * for sale). The selection logic is pure and unit-tested.
 */

export type CollectionWindow = "weekend" | "week" | "month" | "all";

export interface CollectionSpec {
  slug: string;
  title: string;
  tagline: string;
  /** Optional SEO <title> override — lets the browser-tab/search title carry the
   *  keyword phrase people actually search ("Minnesota Food Truck Festivals")
   *  while the on-page H1 + collection card stay short and clean. Defaults to
   *  `title` when absent. */
  seoTitle?: string;
  categories?: CategoryKey[];
  prices?: PriceTier[];
  areas?: AreaKey[];
  query?: string;
  /** Which fields `query` matches. Defaults to "all" (title+venue+city+description,
   *  the search default). Use "title" for a high-precision topical collection where
   *  a body mention is a false positive — e.g. Food Truck Festivals must not catch a
   *  jazz fest whose description merely says "food trucks on site". */
  queryScope?: QueryScope;
  window?: CollectionWindow;
}

export const COLLECTIONS: CollectionSpec[] = [
  {
    slug: "free-this-week",
    title: "Free This Week",
    tagline: "Great things to do across the metro that cost exactly nothing.",
    prices: ["Free"],
    window: "week",
  },
  {
    slug: "live-music",
    title: "Live Music",
    tagline: "Shows, gigs, and concerts around the Twin Cities this week.",
    categories: ["music"],
    window: "week",
  },
  {
    slug: "family-fun",
    title: "Family Fun",
    tagline: "Kid-friendly outings and events for the whole crew.",
    categories: ["family"],
    window: "week",
  },
  {
    slug: "date-night",
    title: "Date Night Ideas",
    tagline: "Music, arts, and food for a night out this weekend.",
    categories: ["music", "arts", "food"],
    window: "weekend",
  },
  {
    slug: "arts-and-culture",
    title: "Arts & Culture",
    tagline: "Theatre, galleries, and performances across the metro.",
    categories: ["arts"],
    window: "month",
  },
  {
    slug: "festivals-and-markets",
    title: "Festivals & Markets",
    tagline: "Festivals, fairs, and food happenings all month.",
    categories: ["festival", "food"],
    window: "month",
  },
  {
    // Demand-validated by the GSC read (Aug 2026): "mn/minnesota food truck
    // festival" is a repeated, high-CTR, position-1 query cluster. A permanent
    // topical page for it — no year in the title (evergreen, like /this-week).
    // Query "food truck" needs BOTH tokens present (matchesQuery), so it catches
    // the named rallies/festivals without dragging in every brewery mention.
    slug: "food-truck-festivals",
    title: "Food Truck Festivals",
    seoTitle: "Minnesota Food Truck Festivals — Twin Cities Calendar",
    tagline:
      "Every food truck festival, rally, and roundup across the Minneapolis–St. Paul metro — where to find the trucks this season.",
    query: "food truck",
    queryScope: "title", // title-only: a real food-truck festival names itself one; a body mention isn't the topic.
    window: "all",
  },
  {
    slug: "only-in-minnesota",
    title: "Only in Minnesota",
    tagline: "The wonderfully unique events you won't find anywhere else.",
    categories: ["weird"],
    window: "month",
  },
];

export function getCollection(slug: string): CollectionSpec | undefined {
  return COLLECTIONS.find((c) => c.slug === slug);
}

const DAY_MS = 86_400_000;

/**
 * Collection window in the CHICAGO WALL FRAME (rule 10, R1.2). The old
 * version compared fake-UTC epochs from naive wall strings against real
 * `now.getTime()` — on UTC servers every evening event fell out of its
 * collection from ~1–2 PM CT onward, and its weekend math ran `getDay()` in
 * the server-local frame, jumping to NEXT weekend on Sunday evenings.
 *
 * `fromWall` is the "not already past" floor; `days` (weekend kind) or
 * `endKey` (day-granular horizon) bound the far edge. The weekend kind reuses
 * weekendDays(), which owns the "Sunday is still the weekend" philosophy.
 */
export interface CollectionWindowKeys {
  fromWall: string;
  endKey: string;
  days: Set<string> | null;
}

export function collectionWindow(kind: CollectionWindow, now: Date): CollectionWindowKeys {
  const fromWall = chiWallClock(now);
  if (kind === "weekend") {
    const days = weekendDays(now);
    return { fromWall, endKey: days[days.length - 1], days: new Set(days) };
  }
  const ahead = kind === "week" ? 7 : kind === "month" ? 30 : 365;
  return { fromWall, endKey: chiDayKey(new Date(now.getTime() + ahead * DAY_MS)), days: null };
}

export function selectCollection(
  events: EventRecord[],
  spec: CollectionSpec,
  now: Date,
): EventRecord[] {
  const w = collectionWindow(spec.window ?? "all", now);
  const cats = spec.categories ? new Set(spec.categories) : null;
  const prices = new Set(spec.prices ?? []);
  const areas = new Set(spec.areas ?? []);

  // RULE 5, THE FIFTH BREAK (fixed 5 Nov 2026). This asked the START DAY only:
  //
  //     if (e.start < w.fromWall) return false;
  //     const day = e.start.slice(0, 10);
  //     return w.days ? w.days.has(day) : day <= w.endKey;
  //
  // so a run that opened before the window and is open right now was absent from
  // its own collection. The proof it was wrong rather than merely different: the
  // SAME CollectionSpec already got true-span treatment in lib/feeds.ts, which
  // builds its feeds from COLLECTIONS — so /collections/<slug> and
  // /feeds/<slug>.ics answered one question two ways, and the under-reporting
  // one was the indexed HTML page. Both now call multiday's spansWindow/spansDay.
  //
  // R1.2’S FLOOR IS KEPT, and a test pins it: a SINGLE-DAY event that already
  // started today is past, and a collection is what is coming up. A RUN that
  // started earlier is not past — that distinction is the whole change. The
  // floor is why /collections and /feeds still differ on one narrow axis: the
  // feed has no such floor, so this morning’s concert stays in the ICS all day.
  // Deliberate, measured, and recorded in the guide rather than quietly aligned.
  const fromKey = w.fromWall.slice(0, 10);
  return events
    .filter((e) => e.status === "published")
    .filter((e) =>
      spanEnd(e) !== null ||
      // An ALL-DAY row is stored at midnight (lib/time-integrity.ts), so a
      // wall-time floor drops a TBD game or a no-listed-time show from 00:01 on
      // the very day it happens. Everywhere else treats all-day as past only
      // once the DAY has passed (lib/event-view.ts isEnded, lib/dates.ts
      // isUpcoming); this arm matches them. Caught by a review of the first cut.
      (e.allDay ? dayOf(e.start) >= fromKey : e.start >= w.fromWall),
    )
    .filter((e) =>
      w.days
        ? [...w.days].some((d) => spansDay(e, d))
        : spansWindow(e, fromKey, w.endKey),
    )
    .filter((e) => (cats ? cats.has(e.category) : true))
    .filter((e) => matchesPrice(e, prices))
    .filter((e) => matchesArea(e, areas))
    .filter((e) => (spec.query ? matchesQuery(e, spec.query, spec.queryScope ?? "all") : true))
    .sort((a, b) => a.start.localeCompare(b.start));
}
