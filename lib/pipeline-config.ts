import type { EventStatus } from "./types";

/**
 * Status applied to NEWLY discovered events.
 *
 *   "published" → auto-publish: events go live the moment the pipeline finds
 *                 them, no manual review step.
 *   "draft"     → restore a review gate (you publish each event by hand).
 *
 * Either way, status is STICKY on update (see lib/upsert.ts): the on-conflict
 * UPDATE never touches status. So if you manually move an event to "draft" to
 * hide it from the site, that decision survives every future re-research — the
 * pipeline will not flip it back to published.
 */
export const NEW_EVENT_STATUS: EventStatus = "published";

/**
 * Venue-anchored discovery (roadmap 4.2). Small shards so each sub-agent can
 * actually visit every calendar it's handed within its search budget.
 */
export const VENUES_PER_SHARD = 5;
// Web-search budget per venue-sweep shard (5 venues). Trimmed 12→10 (Aug 2026
// cost pass): the sweeps are the single biggest search consumer (~10 shards ×
// weekly), and 10 still covers a 5-venue shard's calendars. Raise if a sweep
// starts missing shows.
export const VENUE_SWEEP_SEARCHES = 10;
