import { sql } from "./db";
import { sampleEvents } from "./sample-events";
import { isPublicStatus, dayKeyOf } from "./event-view";
import type { EventRecord, EventStatus, CategoryKey, PriceTier } from "./types";

/**
 * The events data layer — the single boundary between the pipeline (which
 * writes to Postgres) and the website (which reads it).
 *
 *   agents ──► normalize/geocode ──► UPSERT ──► Postgres ──► getEvents() ──► UI
 *
 * If DATABASE_URL is unset (or the DB is empty/unreachable), the bundled
 * sample events are served so the app always runs.
 */

interface Row {
  id: string;
  title: string;
  category: CategoryKey;
  venue: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
  start: string;
  end: string;
  price: string;
  price_tier: PriceTier;
  ticket_url: string;
  description: string;
  image: string;
  source_url: string;
  status: string;
}

function rowToEvent(r: Row): EventRecord {
  return {
    id: r.id,
    title: r.title,
    category: r.category,
    venue: r.venue,
    address: r.address,
    city: r.city,
    lat: Number(r.lat),
    lng: Number(r.lng),
    start: r.start,
    end: r.end ?? r.start,
    price: r.price,
    priceTier: r.price_tier,
    ticketUrl: r.ticket_url,
    description: r.description,
    image: r.image,
    sourceUrl: r.source_url,
    status: (r.status as EventStatus) ?? "published",
  };
}

export async function getEvents(): Promise<EventRecord[]> {
  if (!sql) return sampleEvents;

  try {
    // Render timestamps as Central wall-clock strings so the UI (which treats
    // event times as local) shows the correct local time regardless of server TZ.
    const rows = await sql<Row[]>`
      select
        id::text                                                            as id,
        title, category, venue, address, city, lat, lng,
        to_char(start_at at time zone 'America/Chicago', 'YYYY-MM-DD"T"HH24:MI') as start,
        to_char(end_at   at time zone 'America/Chicago', 'YYYY-MM-DD"T"HH24:MI') as end,
        price, price_tier, ticket_url, description, image, source_url, status
      from events
      where status = 'published'
      order by start_at asc
    `;
    if (rows.length === 0) return sampleEvents;
    return rows.map(rowToEvent);
  } catch (err) {
    console.error("[events] DB read failed, using sample data:", err);
    return sampleEvents;
  }
}

/**
 * A single event by id for its shareable page. Returns published, archived, or
 * cancelled events (so old links degrade gracefully); returns null for drafts
 * (hidden) and unknown ids (→ 404). Falls back to sample data with no DB.
 */
export async function getEvent(id: string): Promise<EventRecord | null> {
  if (!sql) {
    const ev = sampleEvents.find((e) => e.id === id);
    return ev && isPublicStatus(ev.status) ? ev : null;
  }
  try {
    const rows = await sql<Row[]>`
      select
        id::text                                                            as id,
        title, category, venue, address, city, lat, lng,
        to_char(start_at at time zone 'America/Chicago', 'YYYY-MM-DD"T"HH24:MI') as start,
        to_char(end_at   at time zone 'America/Chicago', 'YYYY-MM-DD"T"HH24:MI') as end,
        price, price_tier, ticket_url, description, image, source_url, status
      from events
      where id::text = ${id} and status <> 'draft'
      limit 1
    `;
    return rows.length ? rowToEvent(rows[0]) : null;
  } catch (err) {
    console.error("[events] getEvent failed:", err);
    return null;
  }
}

/** Published events on a given Central-time day (YYYY-MM-DD), earliest first. */
export async function getEventsForDay(dayKey: string): Promise<EventRecord[]> {
  if (!sql) {
    return sampleEvents.filter(
      (e) => isPublicStatus(e.status) && dayKeyOf(e) === dayKey,
    );
  }
  try {
    const rows = await sql<Row[]>`
      select
        id::text                                                            as id,
        title, category, venue, address, city, lat, lng,
        to_char(start_at at time zone 'America/Chicago', 'YYYY-MM-DD"T"HH24:MI') as start,
        to_char(end_at   at time zone 'America/Chicago', 'YYYY-MM-DD"T"HH24:MI') as end,
        price, price_tier, ticket_url, description, image, source_url, status
      from events
      where status = 'published'
        and to_char(start_at at time zone 'America/Chicago', 'YYYY-MM-DD') = ${dayKey}
      order by start_at asc
    `;
    return rows.map(rowToEvent);
  } catch (err) {
    console.error("[events] getEventsForDay failed:", err);
    return [];
  }
}

/**
 * Fetch events by id (used by saved events, roadmap 3.3). Returns records in the
 * SAME order as the input ids, and only ones that are still visible
 * (published/archived/cancelled — a saved draft resolves to nothing).
 */
export async function getEventsByIds(ids: string[]): Promise<EventRecord[]> {
  if (ids.length === 0) return [];
  if (!sql) {
    const byId = new Map(sampleEvents.map((e) => [e.id, e]));
    return ids.map((id) => byId.get(id)).filter(Boolean) as EventRecord[];
  }
  const rows = await sql<Row[]>`
    select
      id::text                                                            as id,
      title, category, venue, address, city, lat, lng,
      to_char(start_at at time zone 'America/Chicago', 'YYYY-MM-DD"T"HH24:MI') as start,
      to_char(end_at   at time zone 'America/Chicago', 'YYYY-MM-DD"T"HH24:MI') as end,
      price, price_tier, ticket_url, description, image, source_url, status
    from events
    where id::text in ${sql(ids)}
      and status in ('published', 'archived', 'cancelled')
  `;
  const order = new Map(ids.map((id, i) => [id, i]));
  return rows.map(rowToEvent).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}
