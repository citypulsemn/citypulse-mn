import { sql } from "./db";
import { allFeedSlugs } from "./feeds";

/**
 * FEED ADOPTION (roadmap v5 F2.5) — the sibling of event_stats for the iCal
 * feeds. Someone clicking "Subscribe to this calendar" is the signal that the
 * distribution surface works; nothing measured it until now.
 *
 * PRIVACY BY SCHEMA, same as event_stats: one counter per (slug, source, day),
 * bucketed in America/Chicago. No identifiers — "how many", never "who".
 *
 * INTEGRITY: only ADVERTISED feed slugs and known sources count, the beacon's
 * equivalent of event_stats' foreign key — a bored person with curl can't
 * invent feeds to inflate.
 */

/** The page surfaces that carry a feed button. Kept small and closed so a
 *  typo'd tag can't create a phantom source. */
export const FEED_SOURCES = ["venue", "collection", "neighborhood", "weekend", "category", "other"] as const;
export type FeedSource = (typeof FEED_SOURCES)[number];

export interface FeedBeaconPayload {
  slug: string;
  source: FeedSource;
}

const VALID_SLUGS = new Set(allFeedSlugs());

/**
 * Validate a feed-click beacon body: an advertised slug plus a known source,
 * nothing else. Pure and unit-tested; the beacon route stays a thin shell.
 * `validSlugs` is injectable for tests but defaults to the live namespace.
 */
export function parseFeedBeacon(
  raw: unknown,
  validSlugs: Set<string> = VALID_SLUGS,
): FeedBeaconPayload | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const slug = typeof o.feed === "string" ? o.feed.trim() : "";
  const source = typeof o.source === "string" ? o.source : "";
  if (!validSlugs.has(slug)) return null;
  if (!(FEED_SOURCES as readonly string[]).includes(source)) return null;
  return { slug, source: source as FeedSource };
}

export interface FeedCountRow {
  slug: string;
  source: string;
  n: number;
}

export interface FeedAdoption {
  clicks7: number;
  /** Top feeds by total clicks (summed across sources), most first. */
  top: { label: string; count: number }[];
}

/**
 * Shape raw (slug, source, n) rows into a digest-ready summary: grand total,
 * plus the top `n` feeds by clicks summed across their sources. Pure — the DB
 * read hands it rows, the tests hand it fixtures.
 */
export function summarizeFeedAdoption(rows: FeedCountRow[], top = 3): FeedAdoption {
  let clicks7 = 0;
  const bySlug = new Map<string, number>();
  for (const r of rows) {
    clicks7 += r.n;
    bySlug.set(r.slug, (bySlug.get(r.slug) ?? 0) + r.n);
  }
  const ranked = [...bySlug.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, top);
  return { clicks7, top: ranked };
}

/**
 * Bump a feed-click counter. Fire-and-forget by contract (never-break): every
 * failure is swallowed, exactly like recordStat.
 */
export async function recordFeedClick(slug: string, source: string): Promise<void> {
  if (!sql) return;
  try {
    await sql`
      insert into feed_events (slug, source, day, count)
      values (${slug}, ${source}, (now() at time zone 'America/Chicago')::date, 1)
      on conflict (slug, source, day)
      do update set count = feed_events.count + 1
    `;
  } catch {
    // swallow — see contract above
  }
}

/** Feed adoption over the last `days` days, for the ops digest. */
export async function getFeedAdoption(days: number): Promise<FeedAdoption> {
  if (!sql) return { clicks7: 0, top: [] };
  const window = Math.max(1, Math.min(days, 90));
  const rows = await sql<FeedCountRow[]>`
    select slug, source, sum(count)::int as n
    from feed_events
    where day >= (now() at time zone 'America/Chicago')::date - (${window - 1})::int
    group by slug, source
  `;
  return summarizeFeedAdoption([...rows]);
}
