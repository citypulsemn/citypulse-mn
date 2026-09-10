/**
 * Is this event's source good enough to publish on?
 *
 * WHY. Twice now the research agent has invented a listing the same way: it
 * read an EVERGREEN ROUNDUP — "the Twin Cities' best Halloween events", "the
 * best concerts this month" — and rewrote last season's contents with this
 * year's dates.
 *
 *   Sep 2026, Damian Marley: one roundup article produced 15 listings for a
 *   show that was not happening. A reader caught it.
 *   Sep 2026, Westwood Hills: "44th Annual Halloween Party" on 17 Oct 2026.
 *   The 44th annual was 17–18 Oct 2025. The title carried its own proof — 2026
 *   would be the 45th — and 18 more listings came off the same article.
 *
 * These URLs are the problem shape: they are stable addresses whose CONTENT is
 * replaced every season, so the page that "supports" a listing today says
 * something different next year. An organizer's own page for a specific event
 * does not do that.
 *
 * A roundup is a fine place to FIND an event. It is not evidence of when that
 * event happens. So an event whose only source is one does not auto-publish;
 * it waits for the verify pass to confirm it against the venue's own calendar,
 * which is the authority (see buildVerifyPrompt).
 *
 * NOT A BLOCKLIST OF BAD SITES. These are good publications. The point is that
 * a third party's seasonal list is second-hand for a specific date and time.
 */

import { hostOf } from "./verify-attribution";

/**
 * News, magazine and aggregator hosts whose event pages are editorial lists
 * rather than an organizer's listing. Add to it freely — a host here only
 * means "verify before publishing", never "ignore".
 */
export const AGGREGATOR_HOSTS: readonly string[] = [
  "axios.com",
  "bringmethenews.com",
  "cbsnews.com",
  "citylakesmag.com",
  "citypages.com",
  "eventbrite.com",
  "exploreminnesota.com",
  "familyfuntwincities.com",
  "festivalguidesandreviews.com",
  "fox9.com",
  "hoodline.com",
  "kare11.com",
  "macaronikid.com",
  "minnesotamonthly.com",
  "mspmag.com",
  "patch.com",
  "racketmn.com",
  "secretmpls.com",
  "startribune.com",
  "thrillist.com",
  "timeout.com",
  "westopolis.org",
  "yahoo.com",
];

const HOSTS = new Set(AGGREGATOR_HOSTS);

/** True when the URL's host is a third-party editorial/aggregator site.
 *  Matches subdomains (www., amp.) but never a suffix collision — "notyahoo.com"
 *  is not yahoo.com. */
export function isAggregatorSource(url: string): boolean {
  const host = hostOf(url);
  if (!host) return false;
  if (HOSTS.has(host)) return true;
  for (const h of HOSTS) if (host.endsWith(`.${h}`)) return true;
  return false;
}

/**
 * The status a newly-found event should land in.
 *
 * Only ever returns "draft" instead of "published" — this gate can hide a real
 * event until someone confirms it, which is recoverable; it can never publish
 * one that would otherwise have been held.
 */
export function statusForNewEvent(sourceUrl: string): "published" | "draft" {
  return isAggregatorSource(sourceUrl) ? "draft" : "published";
}

/** Why an event was held back, for the pipeline log and the ops digest. */
export function heldBackReason(sourceUrl: string): string | null {
  if (!isAggregatorSource(sourceUrl)) return null;
  return `sourced only from ${hostOf(sourceUrl)}, a third-party roundup — held as draft until verified against the venue's own calendar`;
}
