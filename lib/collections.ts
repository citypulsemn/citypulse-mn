import { matchesQuery } from "./search";
import { matchesPrice, matchesArea } from "./filters";
import { chiWallClock, chiDayKey } from "./clock";
import { weekendDays } from "./weekend";
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
  categories?: CategoryKey[];
  prices?: PriceTier[];
  areas?: AreaKey[];
  query?: string;
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

  return events
    .filter((e) => e.status === "published")
    .filter((e) => {
      if (e.start < w.fromWall) return false; // walls to walls, never epochs
      const day = e.start.slice(0, 10);
      return w.days ? w.days.has(day) : day <= w.endKey;
    })
    .filter((e) => (cats ? cats.has(e.category) : true))
    .filter((e) => matchesPrice(e, prices))
    .filter((e) => matchesArea(e, areas))
    .filter((e) => (spec.query ? matchesQuery(e, spec.query) : true))
    .sort((a, b) => a.start.localeCompare(b.start));
}
