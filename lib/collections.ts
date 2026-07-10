import { matchesQuery } from "./search";
import { matchesPrice, matchesArea } from "./filters";
import { evDate } from "./dates";
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
    slug: "this-weekend",
    title: "This Weekend in the Twin Cities",
    tagline: "Everything worth leaving the house for, Friday through Sunday.",
    window: "weekend",
  },
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

/** Time window (ms) for a collection kind, relative to `now`. */
export function collectionWindow(kind: CollectionWindow, now: Date): { start: number; end: number } {
  const start = now.getTime();
  if (kind === "week") return { start, end: start + 7 * DAY_MS };
  if (kind === "month") return { start, end: start + 30 * DAY_MS };
  if (kind === "all") return { start, end: start + 365 * DAY_MS };

  // weekend: from Friday 00:00 through Sunday 23:59 of the coming weekend.
  const d = new Date(now);
  const dow = d.getDay(); // 0 Sun … 6 Sat
  const daysToSun = dow === 0 ? 0 : 7 - dow;
  const sun = new Date(d);
  sun.setDate(d.getDate() + daysToSun);
  sun.setHours(23, 59, 59, 999);
  const fri = new Date(sun);
  fri.setDate(sun.getDate() - 2);
  fri.setHours(0, 0, 0, 0);
  return { start: Math.max(start, fri.getTime()), end: sun.getTime() };
}

export function selectCollection(
  events: EventRecord[],
  spec: CollectionSpec,
  now: Date,
): EventRecord[] {
  const { start, end } = collectionWindow(spec.window ?? "all", now);
  const cats = spec.categories ? new Set(spec.categories) : null;
  const prices = new Set(spec.prices ?? []);
  const areas = new Set(spec.areas ?? []);

  return events
    .filter((e) => e.status === "published")
    .filter((e) => {
      const t = evDate(e).getTime();
      return t >= start && t <= end;
    })
    .filter((e) => (cats ? cats.has(e.category) : true))
    .filter((e) => matchesPrice(e, prices))
    .filter((e) => matchesArea(e, areas))
    .filter((e) => (spec.query ? matchesQuery(e, spec.query) : true))
    .sort((a, b) => evDate(a).getTime() - evDate(b).getTime());
}
