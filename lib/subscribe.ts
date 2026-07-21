import { sql } from "./db";

/**
 * Email capture boundary. The pure helpers (normalizeEmail/isValidEmail) are
 * unit-tested; the DB functions read/write through the owner connection, which
 * bypasses RLS (the subscribers table is sealed from the public API).
 */

export type SubscribeResult =
  | "added"
  | "resubscribed"
  | "reconfirm" // F2.3: was unsubscribed → now pending, caller sends confirm email
  | "already"
  | "invalid"
  | "error";

/** addSubscriber's outcome plus the row id (needed to build a confirm link on
 *  the "reconfirm" path; null when there's no row, e.g. invalid/error/dev). */
export interface AddSubscriberResult {
  result: SubscribeResult;
  id: number | null;
}

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
): Promise<AddSubscriberResult> {
  const email = normalizeEmail(rawEmail);
  if (!isValidEmail(email)) return { result: "invalid", id: null };

  if (!sql) {
    // Dev/local without a database: accept so the UI can be exercised.
    console.warn(`[subscribe] no DATABASE_URL — dev no-op for ${email}`);
    return { result: "added", id: null };
  }

  try {
    // ROADMAP 5.3 — the identity bridge. If this browser has the anonymous
    // saver cookie, remember it on the subscriber row so the digest can lead
    // with THEIR saved events. On re-subscribe we refresh the link (that's
    // also how an existing subscriber connects their saves: submit the form
    // once from the browser they save in).
    //
    // R0.5 — an explicit form submit is consent, so the conflict path PROMOTES
    // status back to 'subscribed'. F2.3 adds ONE exception (Taren's policy
    // call): a row that EXPLICITLY UNSUBSCRIBED (unsubscribed_at set and not
    // currently subscribed) goes to 'pending' instead, keeping unsubscribed_at
    // as the "not back until confirmed" signal — the caller then emails a
    // confirm link. Everything else is single opt-in, unchanged: brand-new
    // emails and keep-list `pending` rows (which never unsubscribed) subscribe
    // immediately. The `prior` CTE reads the pre-statement snapshot so we can
    // report honestly: added / resubscribed / reconfirm / already.
    const rows = await sql<
      { id: number; inserted: boolean; new_status: string; prior_status: string | null }[]
    >`
      with prior as (
        select status from subscribers where email = ${email}
      ),
      ins as (
        insert into subscribers (email, source, saver_token)
        values (${email}, ${source}, ${saverToken})
        on conflict (email) do update
          set status = case
                when subscribers.unsubscribed_at is not null and subscribers.status <> 'subscribed'
                  then 'pending'
                else 'subscribed'
              end,
              unsubscribed_at = case
                when subscribers.unsubscribed_at is not null and subscribers.status <> 'subscribed'
                  then subscribers.unsubscribed_at
                else null
              end,
              saver_token = coalesce(excluded.saver_token, subscribers.saver_token)
        returning id, (xmax = 0) as inserted, status as new_status
      )
      select ins.id, ins.inserted, ins.new_status, prior.status as prior_status
      from ins left join prior on true
    `;
    const row = rows[0];
    if (!row) return { result: "error", id: null };
    if (row.inserted) return { result: "added", id: row.id };
    if (row.new_status === "pending") return { result: "reconfirm", id: row.id };
    return { result: row.prior_status === "subscribed" ? "already" : "resubscribed", id: row.id };
  } catch (err) {
    console.error("[subscribe] insert failed:", err);
    return { result: "error", id: null };
  }
}

export type ConfirmResult = "confirmed" | "already" | "expired";

/**
 * F2.3 — promote a reconfirming subscriber from 'pending' to 'subscribed'.
 * Scoped to `status = 'pending'` so a stale confirm link can NEVER resurrect a
 * row that has since unsubscribed again; a double-click reads back as 'already'.
 */
export async function confirmSubscriber(id: number | string): Promise<ConfirmResult> {
  if (!sql) return "expired";
  if (!/^\d+$/.test(String(id))) return "expired";
  const rows = await sql<{ promoted: number; current_status: string | null }[]>`
    with upd as (
      update subscribers
      set status = 'subscribed', confirmed_at = now(), unsubscribed_at = null
      where id = ${id} and status = 'pending'
      returning id
    )
    select
      (select count(*) from upd)::int as promoted,
      (select status from subscribers where id = ${id}) as current_status
  `;
  const row = rows[0];
  if (row && row.promoted > 0) return "confirmed";
  if (row && row.current_status === "subscribed") return "already";
  return "expired";
}

export async function getSubscriberStats(): Promise<SubscriberStats> {
  if (!sql) return { total: 0, last7d: 0 };
  // R2.7 — count who actually gets mailed. 'pending' rows (keep-list emails
  // that never subscribed) inflated "total" while the sender skips them.
  const [row] = await sql<{ total: number; last7d: number }[]>`
    select
      count(*)::int as total,
      count(*) filter (where created_at >= now() - interval '7 days')::int as last7d
    from subscribers
    where status = 'subscribed'
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
