import { sql } from "./db";
import { sampleEvents } from "./sample-events";
import type { EventRecord, CategoryKey, PriceTier } from "./types";

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
    status: "published",
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
