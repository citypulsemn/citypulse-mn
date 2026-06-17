import { requireSql } from "./db";
import type { DbEventInput } from "./types";

/**
 * Idempotent batch upsert. Conflicts on event_key (the dedup key), so an event
 * re-found in a later run UPDATES its row instead of inserting a duplicate.
 * Returns the number of rows written.
 *
 * Note: status is only set on INSERT. On UPDATE we deliberately do NOT touch
 * status, so an event you've already reviewed/published stays published when
 * the agent re-finds it.
 */
export async function upsertEvents(events: DbEventInput[]): Promise<number> {
  if (events.length === 0) return 0;
  const sql = requireSql();

  const rows = events.map((e) => ({
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
