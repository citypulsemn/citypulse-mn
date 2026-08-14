import { sql } from "./db";
import type { EventRecord } from "./types";

/**
 * FEATURED PLACEMENTS (Monetization R2.2) — the labeled, capped, no-reorder
 * paid-placement mechanism, built dormant.
 *
 * THE TRUST RULES, IN CODE:
 *  1. LABELED — every featured event renders with a visible "Featured" chip
 *     (FeaturedRow). Never disguised as organic. No dark patterns.
 *  2. CAPPED — at most FEATURED_CAP[surface] per surface (1 collection, 2 home).
 *  3. NO REORDER — featured is an ADDITIVE band shown ABOVE the organic list;
 *     `selectFeatured` returns a SEPARATE array and never touches the events it
 *     was handed. The organic ranking below is byte-for-byte what it was.
 *  4. HONEST — only events that are actually live (present in the pool passed in)
 *     and inside their paid time-window are shown; an archived or expired
 *     placement silently drops rather than 404-ing or showing a ghost.
 *
 * Dormant by default: the `featured` table is empty until a venue buys, so every
 * surface renders exactly as it does today.
 */

/** Per-surface render caps — trust rule #2. */
export const FEATURED_CAP = { home: 2, collection: 1 } as const;
export type FeaturedSurface = keyof typeof FEATURED_CAP;

/** A booking row from the `featured` table. */
export interface FeaturedPlacement {
  eventId: string;
  label: string;
  startsAt: string; // ISO
  endsAt: string; // ISO
}

/** A selected featured item: the live event plus its disclosure label. */
export interface FeaturedItem {
  event: EventRecord;
  label: string;
}

/**
 * Pure selection. Given active placements and the organic event pool, return the
 * featured items to show ABOVE that pool — window-active, capped, deduped, and
 * ONLY events present in the pool (i.e. live/public and, for a collection page,
 * a member of that collection). Input `events` is never mutated or reordered.
 *
 * `placements` is assumed to be in the order the caller wants them considered
 * (the query orders by starts_at); the cap takes the first N that qualify.
 */
export function selectFeatured(
  placements: FeaturedPlacement[],
  events: EventRecord[],
  opts: { now: Date; surface: FeaturedSurface },
): FeaturedItem[] {
  const cap = FEATURED_CAP[opts.surface];
  const nowMs = opts.now.getTime();
  const byId = new Map(events.map((e) => [e.id, e]));
  const seen = new Set<string>();
  const out: FeaturedItem[] = [];

  for (const p of placements) {
    if (out.length >= cap) break;
    const start = Date.parse(p.startsAt);
    const end = Date.parse(p.endsAt);
    if (Number.isNaN(start) || Number.isNaN(end)) continue; // malformed window
    if (nowMs < start || nowMs > end) continue; // outside the paid window
    if (seen.has(p.eventId)) continue; // one placement per event
    const event = byId.get(p.eventId);
    if (!event) continue; // not live / not in this pool → don't show
    seen.add(p.eventId);
    out.push({ event, label: p.label?.trim() || "Featured" });
  }
  return out;
}

interface FeaturedRow {
  event_id: string;
  label: string;
  starts_at: string;
  ends_at: string;
}

/**
 * Featured items for a surface, from the DB. Pass the same event pool the page
 * already fetched (all published events for home; the collection's selected
 * events for a collection page) — that pool doubles as the live/relevance filter
 * (trust rule #4). Never-break contract like the rest of the aux paths: [] on any
 * failure (including the table not existing yet), so a placement query can never
 * take down a page.
 */
export async function getFeatured(
  surface: FeaturedSurface,
  events: EventRecord[],
  now: Date = new Date(),
): Promise<FeaturedItem[]> {
  if (!sql || events.length === 0) return [];
  try {
    const rows = await sql<FeaturedRow[]>`
      select event_id::text, label, starts_at::text, ends_at::text
      from featured
      where now() between starts_at and ends_at
      order by starts_at asc
    `;
    const placements: FeaturedPlacement[] = rows.map((r) => ({
      eventId: r.event_id,
      label: r.label,
      startsAt: r.starts_at,
      endsAt: r.ends_at,
    }));
    return selectFeatured(placements, events, { now, surface });
  } catch (err) {
    console.error("[featured] getFeatured failed (returning empty):", err);
    return [];
  }
}
