import type { VenueStatRow } from "./stats";
import { matchVenueSlug, slugifyVenue, venuePageBySlug } from "./venue-pages";

/**
 * VENUE REPORTS (Monetization C1) — the pure half.
 *
 * What a venue gets is one question answered honestly: how many people looked
 * at your listings on our site, and how many clicked through to your tickets.
 * This module turns per-venue-string stat rows into one row per BUSINESS.
 *
 * WHY THE KEY IS NOT THE REGISTRY SLUG, which is what the roadmap spec said.
 * The registry (lib/venues.ts) is pipeline config — the 47 rooms the weekly
 * sweep visits. Measured against 30 days of live stats, 381 distinct venue
 * strings earned views or clicks and only 82 of them are registry venues. Nine
 * of the top ten click earners are NOT in the registry: Ferguson's Orchard,
 * Trail of Terror, Scream Town, Pryes Brewing, county fairgrounds, rec centers.
 * A dashboard keyed on the registry would have covered the arenas, which have
 * the most listings and almost none of the clicks — the same supply-is-not-
 * demand mistake that finding 1 of ROADMAP-MONETIZATION.md is a monument to.
 *
 * So the key is the registry slug WHEN THERE IS ONE, and the slugified venue
 * name otherwise. Registry first matters: its alias table is the only thing
 * that knows "7th St Entry" is First Avenue and "Grand Casino Arena" is the
 * building formerly called Xcel. Slugify alone still does most of the merging,
 * because normalizeVenueName drops parentheticals — four spellings of
 * "Minnesota Zoo (departure point)" collapse without any hand-maintained list.
 *
 * Merging matters for the sales pitch, not just for tidiness. Three Rivers Park
 * District's clicks were spread across four spellings, so the per-string table
 * showed it at 39 when the business had more. Quoting the fragment to a buyer
 * understates us; quoting the sum is simply the true number.
 */

/** The report key for a free-text venue string, or null if there is no name. */
export function venueReportKey(venue: string): string | null {
  const registry = matchVenueSlug(venue);
  if (registry) return registry;
  const slug = slugifyVenue(venue ?? "");
  return slug === "" ? null : slug;
}

export interface VenueReportRow {
  /** The key the magic link is signed over. */
  key: string;
  /** What to call this business on the page. */
  name: string;
  /** True when /venues/<key> is a real public page we can link to. */
  registry: boolean;
  views: number;
  clicks: number;
  /** Every raw venue spelling merged into this row, most-clicked first. */
  spellings: string[];
}

/**
 * Group stat rows into one row per business, clicks first.
 *
 * The display name is the registry's curated name when the key is a registry
 * venue, and otherwise the most-clicked raw spelling VERBATIM — including any
 * parenthetical. We print what we wrote rather than a prettier string we
 * derived, because a venue reading its own report should recognise the words.
 */
export function aggregateVenueStats(rows: VenueStatRow[]): VenueReportRow[] {
  const byKey = new Map<string, { views: number; clicks: number; raw: VenueStatRow[] }>();

  for (const r of rows) {
    const key = venueReportKey(r.venue);
    if (!key) continue; // a venue with no name is not a business we can report to
    const acc = byKey.get(key) ?? { views: 0, clicks: 0, raw: [] };
    acc.views += r.views;
    acc.clicks += r.clicks;
    acc.raw.push(r);
    byKey.set(key, acc);
  }

  const out: VenueReportRow[] = [];
  for (const [key, acc] of byKey) {
    const spellings = [...acc.raw]
      .sort((a, b) => b.clicks - a.clicks || b.views - a.views || a.venue.localeCompare(b.venue))
      .map((r) => r.venue);
    const page = venuePageBySlug(key);
    out.push({
      key,
      name: page?.name ?? spellings[0],
      registry: page !== null,
      views: acc.views,
      clicks: acc.clicks,
      spellings,
    });
  }

  return out.sort((a, b) => b.clicks - a.clicks || b.views - a.views || a.name.localeCompare(b.name));
}

/** One business's row out of the set, or null when it earned nothing. */
export function findVenueReport(rows: VenueReportRow[], key: string): VenueReportRow | null {
  return rows.find((r) => r.key === key) ?? null;
}
