import { unstable_cache } from "next/cache";
import { sql } from "./db";
import { sampleEvents } from "./sample-events";
import { isPublicStatus, dayKeyOf } from "./event-view";
import { cleanEventTitle, displayCity } from "./title-hygiene";
import { eventNeighborhood } from "./neighborhoods";
import type { EventRecord, EventStatus, CategoryKey, PriceTier } from "./types";

/**
 * Shared-cache config for the events read layer (Supabase egress reduction).
 *
 * THE PROBLEM: nearly every route calls getEvents() — the full published table —
 * and filters it in JS. The home page, this-weekend, ongoing, and the per-city /
 * per-neighborhood / per-collection / per-venue pages all do it, and so does
 * EVERY /event/[id] page (for its "more at this venue" strip). Without a shared
 * cache the DB re-shipped the whole table once per route per visitor: one crawler
 * sweep of the ~950 event pages alone moved ~0.7 GB. That drove the Supabase
 * fair-use egress alert (12.58 GB vs a 5.5 GB cap).
 *
 * THE FIX: wrap the reads in unstable_cache. The DB is now hit at most once per
 * TTL window, GLOBALLY shared across all routes and requests, instead of once per
 * route per request. The full payload is ~0.7 MB for 953 events — comfortably
 * under Vercel's 2 MB data-cache-entry ceiling, so it caches for real.
 *
 * Freshness: admin edits bust EVENTS_TAG immediately (lib/admin-actions.ts). The
 * weekly pipeline writes straight to Postgres out-of-band, so its changes appear
 * on the next TTL refresh — same behaviour as the old per-route ISR, just a wider
 * window. Non-request callers (the digest script, unit tests) use the *Uncached
 * reads below, which never touch the Next cache and are always fresh.
 */
export const EVENTS_TAG = "events";
const EVENTS_TTL_SECONDS = 3600; // 1 hr — the Supabase egress knob. Content is
// weekly (the Monday pipeline) and admin edits bust EVENTS_TAG immediately, so a
// wider window costs no real freshness and halves the shared full-table DB reads.

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
  multi_day_end: string | null;
  all_day: boolean;
  status: string;
}

function rowToEvent(r: Row): EventRecord {
  return {
    id: r.id,
    // ROADMAP 4.7 — titles/cities are cleaned at the read path, in this one
    // place, so every consumer (cards, detail, digest, .ics, JSON-LD, OG
    // images) inherits it. The RAW title stays in the database: it feeds the
    // dedup key (mid-title parens are hashed as-is, so rewriting stored titles
    // would change keys and duplicate events on re-find) and the admin shows
    // it as provenance.
    title: cleanEventTitle(r.title, r.venue, r.city),
    category: r.category,
    venue: r.venue,
    address: r.address,
    city: displayCity(r.city),
    neighborhood: eventNeighborhood({ lat: r.lat, lng: r.lng }),
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
    multiDayEnd: r.multi_day_end ?? null,
    allDay: r.all_day ?? false,
  };
}

async function readAllPublished(): Promise<EventRecord[]> {
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
        price, price_tier, ticket_url, description, image, source_url, status,
      to_char(multi_day_end at time zone 'America/Chicago', 'YYYY-MM-DD"T"HH24:MI') as multi_day_end,
      all_day
      from events
      where status = 'published'
      order by start_at asc
    `;
    // A configured, reachable DB is the source of truth — even 0 rows (an empty
    // published table) returns [] honestly, NOT the June demo data. Sample events
    // are only for the no-DB case above.
    return rows.map(rowToEvent);
  } catch (err) {
    // The DB is configured but the read FAILED (e.g. a transient Supabase egress /
    // connection error). Do NOT fall back to sample data here: getEvents wraps this
    // in unstable_cache and it runs during ISR page renders, so returning the June
    // sample events would bake a wrong "no events in August" homepage into the page
    // cache and serve it to every visitor until the next deploy — the Aug 15 2026
    // incident. Re-throwing instead makes Next keep serving the LAST-GOOD cached page
    // and never cache the degraded render: graceful degradation without poisoning.
    console.error("[events] DB read failed (NOT serving sample data with a DB configured):", err);
    throw err;
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
        price, price_tier, ticket_url, description, image, source_url, status,
      to_char(multi_day_end at time zone 'America/Chicago', 'YYYY-MM-DD"T"HH24:MI') as multi_day_end,
      all_day
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
async function readEventsForDay(dayKey: string): Promise<EventRecord[]> {
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
        price, price_tier, ticket_url, description, image, source_url, status,
      to_char(multi_day_end at time zone 'America/Chicago', 'YYYY-MM-DD"T"HH24:MI') as multi_day_end,
      all_day
      from events
      where status = 'published'
        and (
          to_char(start_at at time zone 'America/Chicago', 'YYYY-MM-DD') = ${dayKey}
          -- A multi-day festival is happening on every day it spans, so it must
          -- surface in "what's on today" — not only on its opening day (4.4).
          -- The span can come from the collapse (multi_day_end) OR from an event
          -- stored as one row whose end_at lands on a later date.
          or (
            coalesce(multi_day_end, case
              when to_char(end_at at time zone 'America/Chicago', 'YYYY-MM-DD')
                 > to_char(start_at at time zone 'America/Chicago', 'YYYY-MM-DD')
               and not (
                 -- late-night rule: ending before 6 AM the very next day is a
                 -- late show, not a two-day span
                 (end_at at time zone 'America/Chicago')::date
                   = (start_at at time zone 'America/Chicago')::date + 1
                 and extract(hour from end_at at time zone 'America/Chicago') < 6
               )
              then end_at end) is not null
            and to_char(start_at at time zone 'America/Chicago', 'YYYY-MM-DD') <= ${dayKey}
            and to_char(coalesce(multi_day_end, end_at) at time zone 'America/Chicago', 'YYYY-MM-DD') >= ${dayKey}
            -- Same cap as the client (EXPAND_MAX_DAYS = 14 days INCLUSIVE of
            -- the start day, so the date DIFF is <= 13). R1.7b: this was
            -- <= 14, letting 15-day spans onto server day pages while the
            -- SPA day panel (daysSpanned) refused them — the two disagreed.
            and (coalesce(multi_day_end, end_at) at time zone 'America/Chicago')::date
              - (start_at at time zone 'America/Chicago')::date <= 13
          )
        )
      order by start_at asc
    `;
    return rows.map(rowToEvent);
  } catch (err) {
    // Same policy as readAllPublished: a configured-DB read failure must not bake a
    // degraded (empty) day page into the ISR cache — throw so Next keeps serving the
    // last-good cached page instead of caching "no events" for this day.
    console.error("[events] getEventsForDay failed:", err);
    throw err;
  }
}

/**
 * The page-facing reads: cached and shared across every route and request. See
 * the EVENTS_TAG note above for why. unstable_cache keys getEventsForDay by its
 * dayKey argument automatically, so each day caches independently.
 */
export const getEvents = unstable_cache(readAllPublished, ["events:all-published"], {
  revalidate: EVENTS_TTL_SECONDS,
  tags: [EVENTS_TAG],
});

export const getEventsForDay = unstable_cache(readEventsForDay, ["events:for-day"], {
  revalidate: EVENTS_TTL_SECONDS,
  tags: [EVENTS_TAG],
});

/**
 * Uncached direct reads — for contexts that run OUTSIDE a Next request (the
 * weekly digest script) or must never see a cached value (unit tests). Always
 * hit the DB (or sample fallback) fresh.
 */
export const getEventsUncached = readAllPublished;
export const getEventsForDayUncached = readEventsForDay;

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
      price, price_tier, ticket_url, description, image, source_url, status,
      to_char(multi_day_end at time zone 'America/Chicago', 'YYYY-MM-DD"T"HH24:MI') as multi_day_end,
      all_day
    from events
    where id::text in ${sql(ids)}
      and status in ('published', 'archived', 'cancelled')
  `;
  const order = new Map(ids.map((id, i) => [id, i]));
  return rows.map(rowToEvent).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}
