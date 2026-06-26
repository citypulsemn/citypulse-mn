import { requireSql } from "./db";
import type { DbEventInput } from "./types";

/** Count populated optional fields — a rough "richness" score for a row. */
function richness(e: DbEventInput): number {
  let n = 0;
  if (e.description) n++;
  if (e.ticket_url) n++;
  if (e.image) n++;
  if (e.address) n++;
  if (e.end_at) n++;
  if (e.source_url) n++;
  return n;
}

/**
 * Collapse rows that share an event_key BEFORE the SQL upsert (Layer 1).
 * Two agents can return the same event in one run (e.g. a food festival found
 * by both the "food" and "festival" agents); without this, Postgres rejects the
 * batch with "ON CONFLICT DO UPDATE cannot affect row a second time". When keys
 * collide we keep the richer row (more populated fields), tie → the later one.
 * Pure function — no database needed.
 */
export function dedupeByKey(events: DbEventInput[]): DbEventInput[] {
  const byKey = new Map<string, DbEventInput>();
  for (const e of events) {
    const existing = byKey.get(e.event_key);
    if (!existing || richness(e) >= richness(existing)) {
      byKey.set(e.event_key, e);
    }
  }
  return [...byKey.values()];
}

/**
 * Idempotent batch upsert. Conflicts on event_key (the dedup key), so an event
 * re-found in a later run UPDATES its row instead of inserting a duplicate.
 * Returns the number of rows written.
 *
 * Note: status is set only on INSERT. On UPDATE we deliberately do NOT touch
 * status. New events auto-publish; if you later move one to 'draft' to hide it,
 * that decision sticks — a re-found event keeps your status, never reverting.
 */
export async function upsertEvents(events: DbEventInput[]): Promise<number> {
  const deduped = dedupeByKey(events);
  if (deduped.length === 0) return 0;
  const sql = requireSql();

  const rows = deduped.map((e) => ({
    event_key: e.event_key,
    title: e.title,
    category: e.category,
    venue: e.venue,
    address: e.address,
    city: e.city,
    lat: e.lat,
    lng: e.lng,
    start_at: e.start_at,
    end_at: e.end_at,
    price: e.price,
    price_tier: e.priceTier,
    ticket_url: e.ticket_url,
    description: e.description,
    image: e.image,
    source_url: e.source_url,
    status: e.status,
  }));

  const cols = [
    "event_key", "title", "category", "venue", "address", "city",
    "lat", "lng", "start_at", "end_at", "price", "price_tier",
    "ticket_url", "description", "image", "source_url", "status",
  ] as const;

  await sql`
    insert into events ${sql(rows, ...cols)}
    on conflict (event_key) do update set
      title       = excluded.title,
      category    = excluded.category,
      venue       = excluded.venue,
      address     = excluded.address,
      city        = excluded.city,
      lat         = excluded.lat,
      lng         = excluded.lng,
      start_at    = excluded.start_at,
      end_at      = excluded.end_at,
      price       = excluded.price,
      price_tier  = excluded.price_tier,
      ticket_url  = excluded.ticket_url,
      description = excluded.description,
      image       = excluded.image,
      source_url  = excluded.source_url,
      last_seen_at = now()
  `;

  return rows.length;
}

/** Archive published events that have already ended. Returns rows changed. */
export async function archivePastEvents(): Promise<number> {
  const sql = requireSql();
  const res = await sql`
    update events
    set status = 'archived'
    where status = 'published'
      and coalesce(end_at, start_at) < now()
  `;
  return res.count;
}

/**
 * Mark events as cancelled (removes them from the site). Overrides status even
 * if published — a confirmed cancellation should always come down. No-op for
 * keys we don't have. Returns rows changed.
 */
export async function markCancelled(eventKeys: string[]): Promise<number> {
  if (eventKeys.length === 0) return 0;
  const sql = requireSql();
  const res = await sql`
    update events
    set status = 'cancelled'
    where event_key in ${sql(eventKeys)}
      and status <> 'cancelled'
  `;
  return res.count;
}

/**
 * Collapse near-duplicates that string-based keys miss — the same real event
 * listed with a slightly different title or venue spelling ("Como Park" vs
 * "Como Regional Park", "Fest" vs "Fest 2026"). Two live events on the SAME day,
 * within ~250m of each other, with similar titles are treated as one: the
 * earliest-seen row is kept and the others archived (recoverable, not deleted).
 *
 * Uses coordinates (which don't lie about location) plus pg_trgm title
 * similarity, so it catches what normalization can't — without re-keying data.
 * Requires the pg_trgm extension (in db/schema.sql). Returns rows archived.
 */
export async function dedupeNearDuplicates(): Promise<number> {
  const sql = requireSql();
  const res = await sql`
    with extras as (
      select b.id as dup_id
      from events a
      join events b
        on a.id < b.id
       and a.status in ('published', 'draft')
       and b.status in ('published', 'draft')
       and a.start_at::date = b.start_at::date
       and similarity(a.title, b.title) > 0.6
       and (
         6371000 * acos(greatest(-1, least(1,
           cos(radians(a.lat)) * cos(radians(b.lat)) * cos(radians(b.lng) - radians(a.lng))
           + sin(radians(a.lat)) * sin(radians(b.lat))
         ))) < 250
       )
    )
    update events
    set status = 'archived'
    where id in (select dup_id from extras)
      and status in ('published', 'draft')
  `;
  return res.count;
}
