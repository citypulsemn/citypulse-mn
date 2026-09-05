import {
  FIRST_AVENUE_VENUES,
  PROMOTED_ELSEWHERE,
  MPLS_PARKS_VENUES,
  MUSEUM_SOURCES,
  MUSIC_SOURCES,
} from "./music-sources";
import { SPORTS_SOURCES } from "./sports-sources";
import { canonicalizeVenue } from "./canonicalize";

/**
 * WHO STAMPED `verified_at`?
 *
 * Two very different things write that column:
 *
 *   - a PRIMARY-SOURCE IMPORTER reading a league API or a venue's own calendar;
 *   - the freshness verify pass, i.e. a model.
 *
 * Only the second was affected by the pre-5-Sep-2026 prompt bug, and telling
 * them apart is the whole safety of `scripts/resweep-verified.ts`. Get it wrong
 * in one direction and you leave false confidence in place; get it wrong in the
 * other and you throw away good evidence from a feed and replace it with a
 * weaker agent opinion.
 *
 * This lives in `lib/` with tests because the first version got it wrong: it
 * read `MUSEUM_SOURCES[].host` and `FIRST_AVENUE_VENUES[].url`, neither of which
 * exists, so every museum source contributed nothing and fifteen Bell Museum and
 * Science Museum listings were one keystroke from having feed-made stamps
 * cleared. A registry shape you guessed at is not a registry you read.
 */

/** League API hosts. Their URLs are built per team, so naming them is simpler
 *  than instantiating every source just to read a hostname. */
const LEAGUE_HOSTS = ["statsapi.mlb.com", "api-web.nhle.com", "site.api.espn.com"] as const;

const stripWww = (h: string) => h.replace(/^www\./, "");

export function hostOf(url: string): string {
  try {
    return stripWww(new URL(url).host);
  } catch {
    return "";
  }
}

/**
 * Hosts an importer actually fetches — derived by ASKING each source for its own
 * URLs, so a new importer is covered the day it ships rather than the day
 * somebody remembers to update a list here.
 */
export function feedHosts(): Set<string> {
  const hosts = new Set<string>(LEAGUE_HOSTS);
  for (const source of MUSIC_SOURCES) {
    for (const url of source.urls("2000-01-01", "2100-01-01")) {
      const h = hostOf(url);
      if (h) hosts.add(h);
    }
  }
  return hosts;
}

/** Venues an importer is authoritative for, canonicalized for comparison. */
export function feedVenues(): Set<string> {
  const out = new Set<string>();
  for (const v of [...FIRST_AVENUE_VENUES, ...PROMOTED_ELSEWHERE, ...MPLS_PARKS_VENUES]) {
    out.add(canonicalizeVenue(v.name));
  }
  // NOTE: `venues` (plural). There is no `venue` on these entries.
  for (const m of MUSEUM_SOURCES as { venues?: { name: string }[] }[]) {
    for (const v of m.venues ?? []) out.add(canonicalizeVenue(v.name));
  }
  for (const s of SPORTS_SOURCES) out.add(canonicalizeVenue(s.venue.name));
  return out;
}

export interface AttributableRow {
  venue: string;
  sourceUrl: string;
}

/**
 * Did a feed stamp this row?
 *
 * Either signal is enough, deliberately. A Park Board event at a park that is
 * not in the pinned list still carries a `minneapolisparks.org` source, and a
 * First Avenue show whose source URL has drifted is still at a room First
 * Avenue programmes. Requiring BOTH would have mis-sorted 49 park listings.
 */
export function isFeedStamped(
  row: AttributableRow,
  venues: Set<string> = feedVenues(),
  hosts: Set<string> = feedHosts(),
): boolean {
  return venues.has(canonicalizeVenue(row.venue)) || hosts.has(hostOf(row.sourceUrl));
}
