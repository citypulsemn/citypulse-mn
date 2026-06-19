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
