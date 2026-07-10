import { sql } from "./db";

/**
 * Email capture boundary. The pure helpers (normalizeEmail/isValidEmail) are
 * unit-tested; the DB functions read/write through the owner connection, which
 * bypasses RLS (the subscribers table is sealed from the public API).
 */

export type SubscribeResult = "added" | "already" | "invalid" | "error";

export interface SubscriberRow {
  email: string;
  status: string;
  source: string;
  created_at: string;
}

export interface SubscriberStats {
  total: number;
  last7d: number;
}

/** Trim + lowercase so dedupe and lookups are case-insensitive. */
export function normalizeEmail(raw: string): string {
  return (raw ?? "").trim().toLowerCase();
}

/** Pragmatic format check — real validation is deliverability at send time. */
export function isValidEmail(email: string): boolean {
  if (email.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function addSubscriber(rawEmail: string, source = "site"): Promise<SubscribeResult> {
  const email = normalizeEmail(rawEmail);
  if (!isValidEmail(email)) return "invalid";

  if (!sql) {
    // Dev/local without a database: accept so the UI can be exercised.
    console.warn(`[subscribe] no DATABASE_URL — dev no-op for ${email}`);
    return "added";
  }

  try {
    const rows = await sql<{ id: number }[]>`
      insert into subscribers (email, source)
      values (${email}, ${source})
      on conflict (email) do nothing
      returning id
    `;
    return rows.length > 0 ? "added" : "already";
  } catch (err) {
    console.error("[subscribe] insert failed:", err);
    return "error";
  }
}

export async function getSubscriberStats(): Promise<SubscriberStats> {
  if (!sql) return { total: 0, last7d: 0 };
  const [row] = await sql<{ total: number; last7d: number }[]>`
    select
      count(*)::int as total,
      count(*) filter (where created_at >= now() - interval '7 days')::int as last7d
    from subscribers
    where status <> 'unsubscribed'
  `;
  return row ?? { total: 0, last7d: 0 };
}

export async function listSubscribers(): Promise<SubscriberRow[]> {
  if (!sql) return [];
  return await sql<SubscriberRow[]>`
    select email, status, source,
      to_char(created_at at time zone 'America/Chicago', 'YYYY-MM-DD HH24:MI') as created_at
    from subscribers
    order by created_at desc
  `;
}
