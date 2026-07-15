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

export interface DigestRecipient {
  id: number;
  email: string;
  saver_token: string | null;
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

export async function addSubscriber(
  rawEmail: string,
  source = "site",
  saverToken: string | null = null,
): Promise<SubscribeResult> {
  const email = normalizeEmail(rawEmail);
  if (!isValidEmail(email)) return "invalid";

  if (!sql) {
    // Dev/local without a database: accept so the UI can be exercised.
    console.warn(`[subscribe] no DATABASE_URL — dev no-op for ${email}`);
    return "added";
  }

  try {
    // ROADMAP 5.3 — the identity bridge. If this browser has the anonymous
    // saver cookie, remember it on the subscriber row so the digest can lead
    // with THEIR saved events. On re-subscribe we refresh the link (that's
    // also how an existing subscriber connects their saves: submit the form
    // once from the browser they save in).
    const rows = await sql<{ inserted: boolean }[]>`
      insert into subscribers (email, source, saver_token)
      values (${email}, ${source}, ${saverToken})
      on conflict (email) do update
        set saver_token = coalesce(excluded.saver_token, subscribers.saver_token)
      returning (xmax = 0) as inserted
    `;
    return rows[0]?.inserted ? "added" : "already";
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

/** Confirmed recipients for the weekly digest (roadmap 3.1). */
export async function getSubscribedRecipients(): Promise<DigestRecipient[]> {
  if (!sql) return [];
  return await sql<DigestRecipient[]>`
    select id, email, saver_token
    from subscribers
    where status = 'subscribed'
    order by id
  `;
}

/** Mark a subscriber unsubscribed (idempotent). Returns true if a row changed. */
export async function markUnsubscribed(id: number | string): Promise<boolean> {
  if (!sql) return false;
  if (!/^\d+$/.test(String(id))) return false;
  const rows = await sql<{ id: number }[]>`
    update subscribers
    set status = 'unsubscribed', unsubscribed_at = now(),
        -- 5.3: sever the saves link — no reason to keep it for someone who left.
        saver_token = null
    where id = ${id} and status <> 'unsubscribed'
    returning id
  `;
  return rows.length > 0;
}
