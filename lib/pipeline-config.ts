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
export const VENUE_SWEEP_SEARCHES = 12;
