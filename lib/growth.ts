/**
 * Audience and growth, from the data we already hold.
 *
 * WHY IT LOOKS LIKE THIS. On 14 Sep 2026 the admin could tell you there were 29
 * subscribers and that 24 arrived in the last 30 days. It could not tell you the
 * SHAPE — 4 in July, 11 in August, 14 in the first half of September — which is
 * the only part anyone would act on. A count is a fact; a curve is a decision.
 *
 * THE HONEST-DENOMINATOR RULE runs through the whole file. We count actions, not
 * people: `event_stats` is identity-free by design (docs/ANALYTICS.md), so
 * "4,535 views" is not "4,535 readers" and a conversion rate computed from it
 * would be fiction dressed as arithmetic. Every rate here either has a real
 * denominator or reports `null` and says why. A dashboard that invents a
 * percentage is the same failure as a listing that invents a date.
 */

/* ------------------------------------------------------- subscriber cohorts */

export interface SubscriberRow {
  /** ISO timestamp. */
  created_at: string;
  /** ISO timestamp, or null while still subscribed. */
  unsubscribed_at?: string | null;
}

export interface WeekCohort {
  /** Monday of the week, "YYYY-MM-DD". */
  weekStart: string;
  joined: number;
  /** Everyone who had joined by the END of this week, churn included. */
  cumulative: number;
  /** People who joined in THIS week and have since left. */
  churnedFromCohort: number;
}

/** Monday 00:00 UTC of the week containing `d`, as "YYYY-MM-DD". */
export function weekStartOf(d: Date): string {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = x.getUTCDay(); // 0 = Sunday
  x.setUTCDate(x.getUTCDate() - ((dow + 6) % 7));
  return x.toISOString().slice(0, 10);
}

/**
 * Signups per week, most recent LAST so it reads like a chart.
 *
 * Weeks with no signups are still emitted: a flat stretch is information, and
 * dropping empty buckets turns a plateau into a line that looks like growth.
 */
export function weeklyCohorts(rows: SubscriberRow[], now: Date, weeks = 12): WeekCohort[] {
  const valid = rows
    .map((r) => ({ t: Date.parse(r.created_at), out: r.unsubscribed_at ? Date.parse(r.unsubscribed_at) : null }))
    .filter((r) => Number.isFinite(r.t));

  const buckets: WeekCohort[] = [];
  const cursor = new Date(`${weekStartOf(now)}T00:00:00Z`);
  cursor.setUTCDate(cursor.getUTCDate() - 7 * (weeks - 1));

  for (let i = 0; i < weeks; i++) {
    const start = cursor.toISOString().slice(0, 10);
    const startMs = Date.parse(`${start}T00:00:00Z`);
    const endMs = startMs + 7 * 86_400_000;
    const inWeek = valid.filter((r) => r.t >= startMs && r.t < endMs);
    buckets.push({
      weekStart: start,
      joined: inWeek.length,
      cumulative: valid.filter((r) => r.t < endMs).length,
      churnedFromCohort: inWeek.filter((r) => r.out !== null).length,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  return buckets;
}

/**
 * Churn as a share of everyone who ever subscribed.
 *
 * Null when nobody has ever subscribed — 0% churn on an empty list reads as
 * "we retain everyone", which is not what it means.
 */
export function churnRate(rows: SubscriberRow[]): number | null {
  if (rows.length === 0) return null;
  const gone = rows.filter((r) => r.unsubscribed_at).length;
  return gone / rows.length;
}

/**
 * Is the curve bending up, flat, or down? Compares the last `span` weeks to the
 * `span` before them. Null when there is not enough history to say — the most
 * common way a small dataset lies is by letting one good week look like a trend.
 */
export function trend(
  cohorts: WeekCohort[],
  span = 4,
): { recent: number; previous: number; direction: "up" | "flat" | "down" } | null {
  if (cohorts.length < span * 2) return null;
  const recent = cohorts.slice(-span).reduce((n, c) => n + c.joined, 0);
  const previous = cohorts.slice(-span * 2, -span).reduce((n, c) => n + c.joined, 0);
  const direction = recent > previous ? "up" : recent < previous ? "down" : "flat";
  return { recent, previous, direction };
}

/* ------------------------------------------------------------------ funnel */

export interface FunnelInput {
  views: number;
  ticketClicks: number;
  saves: number;
  calendarAdds: number;
  newSubscribers: number;
}

export interface FunnelStage {
  label: string;
  count: number;
  /** Share of the stage above, 0..1 — or null when that would be meaningless. */
  rate: number | null;
  /** Present exactly when `rate` is null: why we refuse to compute it. */
  why?: string;
}

/**
 * The funnel, with every rate earned.
 *
 * Views → ticket clicks is a real rate: both are actions counted the same way on
 * the same pages, so their ratio means something. Subscribing is NOT a share of
 * views, because a view is not a person and one reader can generate thirty. The
 * subscriber stage therefore carries a count and no rate, and says so on the
 * page rather than quietly showing "0.5%" as if that were a conversion rate.
 */
export function buildFunnel(input: FunnelInput): FunnelStage[] {
  const n = (v: number) => (Number.isFinite(v) && v >= 0 ? v : 0);
  const views = n(input.views);
  const clicks = n(input.ticketClicks);
  const intent = n(input.saves) + n(input.calendarAdds);
  const subs = n(input.newSubscribers);
  const share = (a: number, b: number) => (b > 0 ? a / b : null);

  return [
    {
      label: "Event views",
      count: views,
      rate: null,
      why: "actions, not people — event_stats holds no identifiers, so this is not a visitor count",
    },
    { label: "Ticket clicks", count: clicks, rate: share(clicks, views) },
    {
      label: "Saved or added to a calendar",
      count: intent,
      rate: share(intent, views),
    },
    {
      label: "New subscribers",
      count: subs,
      rate: null,
      why: "not a share of views: a view is not a reader, and one reader makes many. The denominator lives in Vercel Analytics",
    },
  ];
}

/* -------------------------------------------------------- returning readers */

export interface SaveRow {
  user_token: string;
  /** ISO timestamp. */
  saved_at: string;
}

export interface ReturningReaders {
  /** Distinct people who have ever saved anything. */
  people: number;
  /** Of those, how many saved on more than one DAY. */
  returning: number;
  /** returning / people, or null when nobody has saved. */
  returnRate: number | null;
  saves: number;
}

/**
 * The one slice of genuine per-person behaviour this project has.
 *
 * `saved_events` carries a `user_token`, so unlike `event_stats` it can count
 * PEOPLE. "Returning" means saved on two different days — one visit that
 * produces four saves is enthusiasm, not a return, and counting it as one would
 * flatter the number.
 */
export function returningReaders(rows: SaveRow[]): ReturningReaders {
  const days = new Map<string, Set<string>>();
  let saves = 0;
  for (const r of rows) {
    const token = typeof r.user_token === "string" ? r.user_token.trim() : "";
    const t = Date.parse(r.saved_at);
    if (token === "" || !Number.isFinite(t)) continue;
    saves++;
    const day = new Date(t).toISOString().slice(0, 10);
    const set = days.get(token) ?? new Set<string>();
    set.add(day);
    days.set(token, set);
  }
  const people = days.size;
  const returning = [...days.values()].filter((s) => s.size > 1).length;
  return { people, returning, returnRate: people > 0 ? returning / people : null, saves };
}

/* ------------------------------------------------------------- presentation */

/** A rate as a whole percent, or an em dash when there isn't one. */
export function pct(rate: number | null | undefined, digits = 0): string {
  if (rate === null || rate === undefined || !Number.isFinite(rate)) return "—";
  return `${(rate * 100).toFixed(digits)}%`;
}

/** "+12" / "−3" / "±0" — signed so a flat week reads as flat, not as nothing. */
export function delta(current: number, previous: number): string {
  const d = current - previous;
  if (d === 0) return "±0";
  return d > 0 ? `+${d}` : `−${Math.abs(d)}`;
}

/* ------------------------------------------------------------------ reading */
/* Everything above is pure and unit-tested. Below is the I/O that feeds it,
 * kept in the same file the way lib/stats.ts does — one place per subject. */

import { sql } from "./db";

/** Every subscriber's join and leave dates. Small table; no need to window it. */
export async function getSubscriberRows(): Promise<SubscriberRow[]> {
  if (!sql) return [];
  const rows = await sql<{ created_at: string; unsubscribed_at: string | null }[]>`
    select created_at::text as created_at, unsubscribed_at::text as unsubscribed_at
    from subscribers order by created_at`;
  return [...rows];
}

/** Save events with their anonymous per-browser token, for returning-reader maths. */
export async function getSaveRows(days = 90): Promise<SaveRow[]> {
  if (!sql) return [];
  const rows = await sql<{ user_token: string; saved_at: string }[]>`
    select user_token, saved_at::text as saved_at
    from saved_events where saved_at > now() - (${days} || ' days')::interval`;
  return [...rows];
}

/** Arrivals by referring host over a window. Identity-free by construction. */
export async function getReferrerRows(days = 30): Promise<{ host: string; count: number }[]> {
  if (!sql) return [];
  const rows = await sql<{ host: string; count: number }[]>`
    select host, sum(count)::int as count
    from referrer_stats
    where day > (now() at time zone 'America/Chicago')::date - ${days}::int
    group by host order by count desc`;
  return [...rows];
}

/** The four engagement counters over a window, for the funnel. */
export async function getFunnelCounts(days = 30): Promise<FunnelInput> {
  const empty = { views: 0, ticketClicks: 0, saves: 0, calendarAdds: 0, newSubscribers: 0 };
  if (!sql) return empty;
  const [e] = await sql<{ v: number; t: number; s: number; c: number }[]>`
    select coalesce(sum(count) filter (where action='view'),0)::int        as v,
           coalesce(sum(count) filter (where action='ticket_click'),0)::int as t,
           coalesce(sum(count) filter (where action='save'),0)::int         as s,
           coalesce(sum(count) filter (where action='calendar'),0)::int     as c
    from event_stats
    where day > (now() at time zone 'America/Chicago')::date - ${days}::int`;
  const [s] = await sql<{ n: number }[]>`
    select count(*)::int as n from subscribers
    where created_at > now() - (${days} || ' days')::interval`;
  return {
    views: e?.v ?? 0,
    ticketClicks: e?.t ?? 0,
    saves: e?.s ?? 0,
    calendarAdds: e?.c ?? 0,
    newSubscribers: s?.n ?? 0,
  };
}
