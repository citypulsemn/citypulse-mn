import { requireSql } from "./db";
import type { DbEventInput } from "./types";
import { planCollapse } from "./multiday";

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
    all_day: e.all_day ?? false,
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
    "lat", "lng", "start_at", "all_day", "end_at", "price", "price_tier",
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
      all_day     = excluded.all_day,
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

/**
 * Collapse multi-day runs and merge true duplicates (roadmap 4.4).
 *
 * Reads the candidate rows, groups them in TypeScript with the pure logic in
 * lib/multiday.ts (so the rules are unit-tested rather than buried in SQL), then:
 *   - keeps the earliest row of each cluster, extending it with `multi_day_end`
 *     when the cluster spans more than one day;
 *   - archives the rest.
 *
 * A cluster only forms from CONSECUTIVE days, so a weekly series (a recurring
 * date night, a Thursday film series) is never collapsed — those are real,
 * separate events.
 */
export async function collapseMultiDayRuns(): Promise<{ collapsed: number; merged: number; folded: number }> {
  const sql = requireSql();

  // multi_day_end matters here: without it, a previously collapsed run card is
  // invisible to clustering and every new "Weekend V"-style row survives
  // (the 2026-07-20 duplicate wave). planCollapse clusters on full spans.
  const rows = await sql<
    { id: string; title: string; city: string; category: string; start: string; end_day: string | null }[]
  >`
    select id::text as id, title, city, category,
           to_char(start_at at time zone 'America/Chicago', 'YYYY-MM-DD"T"HH24:MI') as start,
           to_char(multi_day_end at time zone 'America/Chicago', 'YYYY-MM-DD') as end_day
    from events
    where status in ('published', 'draft')
    order by start_at asc
  `;

  const actions = planCollapse(rows.map((r) => ({ ...r, endDay: r.end_day })));
  let collapsed = 0;
  let merged = 0;
  let folded = 0;

  for (const action of actions) {
    if (action.kind === "fold") folded++;
    else if (action.kind === "run") collapsed++;
    else merged++;

    if (action.setEnd) {
      await sql`
        update events
        set multi_day_end = (${`${action.setEnd}T23:59`}::timestamp at time zone 'America/Chicago')
        where id::text = ${action.keepId}
      `;
    }

    if (action.archiveIds.length > 0) {
      await sql`
        update events set status = 'archived'
        where id::text = any(${action.archiveIds})
          and status in ('published', 'draft')
      `;
    }
  }

  return { collapsed, merged, folded };
}

/** Stamp events as source-verified just now (roadmap 4.5). */
export async function markVerified(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const sql = requireSql();
  const res = await sql`
    update events set verified_at = now()
    where id::text = any(${ids}) and status = 'published'
  `;
  return res.count;
}

/** Cancel events by id with evidence, recorded in the audit log (roadmap 4.5). */
export async function cancelVerified(items: { id: string; evidence: string }[]): Promise<number> {
  if (items.length === 0) return 0;
  const sql = requireSql();
  let n = 0;
  for (const item of items) {
    const res = await sql`
      update events set status = 'cancelled'
      where id::text = ${item.id} and status = 'published'
    `;
    n += res.count;
    await sql`
      insert into admin_audit (action, event_id, patch)
      values ('verify_cancel', ${item.id}::uuid, ${JSON.stringify({ evidence: item.evidence.slice(0, 500) })}::jsonb)
    `;
  }
  return n;
}

/** Record a verification flag for admin attention (roadmap 4.5). */
export async function flagVerification(id: string, verdict: string, note: string): Promise<void> {
  const sql = requireSql();
  await sql`
    insert into admin_audit (action, event_id, patch)
    values ('verify_flag', ${id}::uuid, ${JSON.stringify({ verdict, note: note.slice(0, 300) })}::jsonb)
  `;
}
