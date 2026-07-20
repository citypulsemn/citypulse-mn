import { headers } from "next/headers";
import { sql } from "./db";
import { sampleEvents } from "./sample-events";
import { searchEvents } from "./search";
import { parseBasicAuth, safeEqual } from "./admin-auth";
import type { EventRecord, EventStatus } from "./types";
import type { CoverageInput } from "./coverage";

export type AdminEvent = EventRecord & { createdLabel?: string };

export interface DupPair {
  keep_id: string;
  dup_id: string;
  keep_title: string;
  dup_title: string;
  keep_venue: string;
  dup_venue: string;
  day: string;
  sim: number;
}

export interface PipelineRun {
  id: string;
  started_label: string;
  duration_s: number | null;
  ok: boolean;
  upserted: number;
  cancelled: number;
  archived: number;
  collapsed: number;
  bands: Record<string, number> | null;
  error: string | null;
}

export interface ContentStats {
  published: number;
  draft: number;
  cancelled: number;
  archived: number;
  upcoming: number;
  addedLast7d: number;
  byCategory: { category: string; n: number }[];
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/** Throws unless the request carries valid admin Basic-auth. Defense in depth
 *  behind the middleware — every mutation re-checks. */
export async function assertAdmin(): Promise<void> {
  const pass = process.env.ADMIN_PASSWORD;
  const user = process.env.ADMIN_USER || "admin";
  if (!pass) throw new Error("Admin is not configured");
  const creds = parseBasicAuth((await headers()).get("authorization"));
  if (!creds || !safeEqual(creds.user, user) || !safeEqual(creds.pass, pass)) {
    throw new Error("Unauthorized");
  }
}

/** Record an admin mutation. Never throws (audit must not block the action). */
export async function logAudit(
  action: string,
  eventId: string | null,
  patch?: Record<string, unknown>,
): Promise<void> {
  if (!sql) return;
  try {
    await sql`
      insert into admin_audit (action, event_id, patch)
      values (${action}, ${eventId}, ${patch ? sql.json(patch as never) : null})
    `;
  } catch (err) {
    console.error("[admin] audit write failed:", err);
  }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

interface AdminRow {
  id: string;
  title: string;
  category: EventRecord["category"];
  venue: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
  start: string;
  end: string | null;
  price: string;
  price_tier: EventRecord["priceTier"];
  ticket_url: string;
  description: string;
  image: string;
  source_url: string;
  status: EventStatus;
  created_label: string;
}

function adminRowToEvent(r: AdminRow): AdminEvent {
  return {
    id: r.id,
    title: r.title,
    category: r.category,
    venue: r.venue,
    address: r.address,
    city: r.city,
    lat: r.lat,
    lng: r.lng,
    start: r.start,
    end: r.end ?? "",
    price: r.price,
    priceTier: r.price_tier,
    ticketUrl: r.ticket_url,
    description: r.description,
    image: r.image,
    sourceUrl: r.source_url,
    status: r.status,
    createdLabel: r.created_label,
  };
}

export async function getAdminEvents(opts: {
  q?: string;
  status?: string;
  limit?: number;
}): Promise<AdminEvent[]> {
  const q = (opts.q ?? "").trim();
  const status = opts.status && opts.status !== "all" ? opts.status : null;
  const limit = opts.limit ?? 100;

  if (!sql) {
    let list: AdminEvent[] = sampleEvents.map((e) => ({ ...e }));
    if (q) list = searchEvents(list, q);
    if (status) list = list.filter((e) => e.status === status);
    return list.slice(0, limit);
  }

  const like = `%${q}%`;
  const rows = await sql<AdminRow[]>`
    select
      id::text as id, title, category, venue, address, city, lat, lng,
      to_char(start_at at time zone 'America/Chicago', 'YYYY-MM-DD"T"HH24:MI') as start,
      to_char(end_at   at time zone 'America/Chicago', 'YYYY-MM-DD"T"HH24:MI') as end,
      price, price_tier, ticket_url, description, image, source_url, status,
      to_char(created_at at time zone 'America/Chicago', 'Mon DD, HH24:MI') as created_label
    from events
    where ${status ? sql`status = ${status}` : sql`true`}
      and ${q ? sql`(title ilike ${like} or venue ilike ${like} or city ilike ${like})` : sql`true`}
    order by created_at desc
    limit ${limit}
  `;
  return rows.map(adminRowToEvent);
}

export async function getDuplicatePairs(): Promise<DupPair[]> {
  if (!sql) return [];
  return await sql<DupPair[]>`
    select
      a.id::text as keep_id, b.id::text as dup_id,
      a.title as keep_title, b.title as dup_title,
      a.venue as keep_venue, b.venue as dup_venue,
      to_char(a.start_at at time zone 'America/Chicago', 'Mon DD') as day,
      round(similarity(a.title, b.title)::numeric, 2)::float8 as sim
    from events a
    join events b
      on (a.created_at, a.id) < (b.created_at, b.id)
     and a.status in ('published','draft') and b.status in ('published','draft')
     -- R0.3: same-day means the same CHICAGO day (bare ::date casts in the
     -- session zone, UTC — evening games paired across real days).
     and (a.start_at at time zone 'America/Chicago')::date
         = (b.start_at at time zone 'America/Chicago')::date
     and similarity(a.title, b.title) > 0.4
    order by a.start_at asc
    limit 100
  `;
}

export async function getPipelineRuns(limit = 8): Promise<PipelineRun[]> {
  if (!sql) return [];
  return await sql<PipelineRun[]>`
    select
      id::text as id,
      to_char(started_at at time zone 'America/Chicago', 'Mon DD, HH24:MI') as started_label,
      case when finished_at is not null
        then round(extract(epoch from (finished_at - started_at)))::int
        else null end as duration_s,
      ok, upserted, cancelled, archived, collapsed, bands, error
    from pipeline_runs
    order by started_at desc
    limit ${limit}
  `;
}

export async function getContentStats(): Promise<ContentStats> {
  if (!sql) {
    const now = Date.now();
    const pub = sampleEvents.filter((e) => e.status === "published");
    const byCat = new Map<string, number>();
    for (const e of pub) byCat.set(e.category, (byCat.get(e.category) ?? 0) + 1);
    return {
      published: pub.length,
      draft: 0,
      cancelled: 0,
      archived: 0,
      upcoming: pub.filter((e) => new Date(e.start).getTime() >= now).length,
      addedLast7d: 0,
      byCategory: [...byCat.entries()]
        .map(([category, n]) => ({ category, n }))
        .sort((a, b) => b.n - a.n),
    };
  }

  const [totals] = await sql<
    {
      published: number;
      draft: number;
      cancelled: number;
      archived: number;
      upcoming: number;
      added_last7d: number;
    }[]
  >`
    select
      count(*) filter (where status='published')::int as published,
      count(*) filter (where status='draft')::int as draft,
      count(*) filter (where status='cancelled')::int as cancelled,
      count(*) filter (where status='archived')::int as archived,
      count(*) filter (where status='published' and start_at >= now())::int as upcoming,
      count(*) filter (where created_at >= now() - interval '7 days')::int as added_last7d
    from events
  `;
  const byCategory = await sql<{ category: string; n: number }[]>`
    select category, count(*)::int as n
    from events where status='published'
    group by category order by n desc
  `;
  return {
    published: totals.published,
    draft: totals.draft,
    cancelled: totals.cancelled,
    archived: totals.archived,
    upcoming: totals.upcoming,
    addedLast7d: totals.added_last7d,
    byCategory,
  };
}

// ---------------------------------------------------------------------------
// Patch validation (pure — unit-tested)
// ---------------------------------------------------------------------------

export interface EventPatch {
  title: string;
  venue: string;
  city: string;
  start: string;
  end: string | null;
  price: string;
  ticketUrl: string;
  description: string;
}

const DT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

export function parseEventPatch(
  input: Record<string, unknown>,
): { ok: true; patch: EventPatch } | { ok: false; error: string } {
  const s = (k: string) => String(input[k] ?? "").trim();

  const title = s("title");
  if (!title || title.length > 200) return { ok: false, error: "Title is required (≤200 chars)." };

  const venue = s("venue");
  if (!venue || venue.length > 160) return { ok: false, error: "Venue is required (≤160 chars)." };

  const city = s("city");
  if (city.length > 80) return { ok: false, error: "City is too long." };

  const start = s("start");
  if (!DT.test(start)) return { ok: false, error: "Start must be a valid date/time." };
  const startN = start.slice(0, 16);

  let end: string | null = null;
  const endRaw = s("end");
  if (endRaw) {
    if (!DT.test(endRaw)) return { ok: false, error: "End must be a valid date/time." };
    end = endRaw.slice(0, 16);
    if (end < startN) return { ok: false, error: "End can't be before start." };
  }

  const price = s("price").slice(0, 40) || "See listing";

  const ticketUrl = s("ticket_url");
  if (ticketUrl && !/^https?:\/\//i.test(ticketUrl)) {
    return { ok: false, error: "Ticket URL must start with http:// or https://" };
  }

  const description = s("description").slice(0, 2000);

  return { ok: true, patch: { title, venue, city, start: startN, end, price, ticketUrl, description } };
}

/**
 * Events in the coverage window (roadmap 4.3) — minimal columns, published only.
 * Feeds the category × week coverage grid.
 */
export async function getCoverageEvents(days = 35): Promise<CoverageInput[]> {
  // Dev fallback, consistent with lib/events.ts: without a database, grade the
  // sample calendar rather than reporting a scary (and meaningless) all-zero grid.
  if (!sql) {
    return sampleEvents
      .filter((e) => e.status === "published")
      .map((e) => ({ category: e.category, start: e.start }));
  }
  return await sql<CoverageInput[]>`
    select
      category,
      to_char(start_at at time zone 'America/Chicago', 'YYYY-MM-DD"T"HH24:MI') as start
    from events
    where status = 'published'
      and start_at >= now() - interval '7 days'
      and start_at <= now() + (${days} || ' days')::interval
  `;
}
