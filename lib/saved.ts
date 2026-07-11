import { sql } from "./db";
import { getEventsByIds } from "./events";
import type { EventRecord } from "./types";

/**
 * Saved-events store (roadmap 3.3). Every query is explicitly scoped by the
 * caller's anonymous token, so isolation holds on the owner connection (which
 * bypasses RLS); the RLS policy is the second layer for any other role.
 */

export const SAVED_CAP = 300;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isValidUuid(id: string): boolean {
  return UUID_RE.test(id ?? "");
}

export async function isSaved(token: string, eventId: string): Promise<boolean> {
  if (!sql || !isValidUuid(eventId)) return false;
  const rows = await sql`
    select 1 from saved_events where user_token = ${token} and event_id = ${eventId} limit 1
  `;
  return rows.length > 0;
}

/** Save an event for this token (idempotent, capped). Returns the saved state (true). */
export async function saveEvent(token: string, eventId: string): Promise<boolean> {
  if (!sql || !isValidUuid(eventId)) return false;
  const [c] = await sql<{ n: number }[]>`
    select count(*)::int as n from saved_events where user_token = ${token}
  `;
  if ((c?.n ?? 0) >= SAVED_CAP) return true; // at cap — treat as already saved
  await sql`
    insert into saved_events (user_token, event_id)
    values (${token}, ${eventId})
    on conflict do nothing
  `;
  return true;
}

/** Remove an event for this token. Returns the saved state (false). */
export async function unsaveEvent(token: string, eventId: string): Promise<boolean> {
  if (!sql || !isValidUuid(eventId)) return false;
  await sql`
    delete from saved_events where user_token = ${token} and event_id = ${eventId}
  `;
  return false;
}

export async function getSavedEventIds(token: string): Promise<string[]> {
  if (!sql) return [];
  const rows = await sql<{ event_id: string }[]>`
    select event_id::text as event_id
    from saved_events
    where user_token = ${token}
    order by saved_at desc
  `;
  return rows.map((r) => r.event_id);
}

/** The visitor's saved events as full records, newest-saved first. */
export async function getSavedEvents(token: string): Promise<EventRecord[]> {
  const ids = await getSavedEventIds(token);
  if (ids.length === 0) return [];
  return getEventsByIds(ids); // preserves the id order (saved_at desc)
}
