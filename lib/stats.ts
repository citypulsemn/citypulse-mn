import { sql } from "./db";

/**
 * FIRST-PARTY ANALYTICS (roadmap 5.1).
 *
 * The feedback loop: which events people view, which ticket links they click,
 * what they save, what they put on their calendars — counted in OUR database,
 * joinable against our own data, not locked in a vendor dashboard.
 *
 * PRIVACY BY SCHEMA: event_stats holds one counter per (event, day, action).
 * No user identifiers, no IPs, no cookies. The table cannot answer "who did
 * what" — only "how many" — so there is nothing to leak, subpoena, or comply
 * about. Days are bucketed in America/Chicago, like everything on the site.
 *
 * WRITE PATHS (asymmetric on purpose):
 *  - view / ticket_click / calendar — public beacon endpoint, because they
 *    happen in the browser. Both add-to-calendar options (.ics AND Google)
 *    beacon on the human click; the .ics download ROUTE no longer counts,
 *    because crawlers and calendar-app pollers hit it ~11× per real view
 *    (Jul 2026). The R2.1 per-IP beacon cap bounds the whole surface.
 *  - save — counted ONLY inside the save server-action, never accepted from
 *    the beacon: the one metric tied to real user state shouldn't be the one
 *    a bored person with curl can inflate.
 */

export const STAT_ACTIONS = ["view", "ticket_click", "save", "calendar"] as const;
export type StatAction = (typeof STAT_ACTIONS)[number];

/** Actions the PUBLIC beacon may record ('save' is server-action-only). */
export const BEACON_ACTIONS = ["view", "ticket_click", "calendar"] as const;
export type BeaconAction = (typeof BEACON_ACTIONS)[number];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface BeaconPayload {
  id: string;
  action: BeaconAction;
}

/**
 * Validate a beacon request body. Returns null for anything that isn't exactly
 * an event UUID plus an allow-listed action — including 'save' (see above).
 * Pure and unit-tested; the route stays a thin shell.
 */
export function parseBeacon(raw: unknown): BeaconPayload | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  const action = typeof o.action === "string" ? o.action : "";
  if (!UUID_RE.test(id)) return null;
  if (!(BEACON_ACTIONS as readonly string[]).includes(action)) return null;
  return { id, action: action as BeaconAction };
}

/** Click-through rate, guarded. Rendered as a whole percent. */
export function ctr(views: number, clicks: number): number {
  if (!views || views <= 0) return 0;
  return Math.round((clicks / views) * 100);
}

export interface DailyRow {
  day: string;
  action: StatAction;
  n: number;
}

export interface DailyPivot {
  day: string;
  view: number;
  ticket_click: number;
  save: number;
  calendar: number;
}

/** Pivot (day, action, n) rows into one row per day. Pure, for the admin table. */
export function shapeDaily(rows: DailyRow[]): DailyPivot[] {
  const byDay = new Map<string, DailyPivot>();
  for (const r of rows) {
    const p =
      byDay.get(r.day) ??
      { day: r.day, view: 0, ticket_click: 0, save: 0, calendar: 0 };
    if ((STAT_ACTIONS as readonly string[]).includes(r.action)) {
      p[r.action] += r.n;
    }
    byDay.set(r.day, p);
  }
  return [...byDay.values()].sort((a, b) => b.day.localeCompare(a.day));
}

/**
 * Bump a counter. Fire-and-forget by contract: analytics must NEVER break the
 * feature it measures, so every failure (no DB, unknown event id, race) is
 * swallowed. The FK means garbage ids simply don't create rows.
 */
export async function recordStat(eventId: string, action: StatAction): Promise<void> {
  if (!sql) return;
  try {
    await sql`
      insert into event_stats (event_id, day, action, count)
      values (${eventId}::uuid, (now() at time zone 'America/Chicago')::date, ${action}, 1)
      on conflict (event_id, day, action)
      do update set count = event_stats.count + 1
    `;
  } catch {
    // swallow — see contract above
  }
}

export interface TopEventRow {
  id: string;
  title: string;
  category: string;
  start: string;
  view: number;
  ticket_click: number;
  save: number;
  calendar: number;
}

export interface Engagement {
  totals: { view: number; ticket_click: number; save: number; calendar: number };
  daily: DailyPivot[];
  top: TopEventRow[];
}

const EMPTY: Engagement = {
  totals: { view: 0, ticket_click: 0, save: 0, calendar: 0 },
  daily: [],
  top: [],
};

/**
 * Engagement over the last `days` days, for /admin/stats.
 *
 * Wrapped in the same never-break contract as the writes: if the table is
 * missing (schema step not yet run) or any query fails, the admin page shows
 * the empty state instead of a 500. This bit the live site once — the read
 * path crashed /admin/stats before the schema was applied. Never again.
 */
export async function getEngagement(days: number): Promise<Engagement> {
  if (!sql) return EMPTY;
  try {
    return await queryEngagement(days);
  } catch (err) {
    console.error("[stats] getEngagement failed (returning empty):", err);
    return EMPTY;
  }
}

/**
 * Strict variant for callers that must tell "zero engagement" apart from
 * "stats broke" (the ops digest, R2.3): throws instead of returning zeros.
 * getEngagement's swallow is right for /admin/stats — a page should degrade —
 * but a COCKPIT that reports failure-zeros as fact poisons next week's
 * baseline with them. The digest wraps this in its own never-break contract.
 */
export async function getEngagementStrict(days: number): Promise<Engagement> {
  if (!sql) throw new Error("no database connection");
  return queryEngagement(days);
}

async function queryEngagement(days: number): Promise<Engagement> {
  if (!sql) return EMPTY;
  const window = Math.max(1, Math.min(days, 90));

  const dailyRows = await sql<DailyRow[]>`
    select day::text as day, action, sum(count)::int as n
    from event_stats
    where day >= (now() at time zone 'America/Chicago')::date - (${window - 1})::int
    group by day, action
  `;

  const top = await sql<TopEventRow[]>`
    select e.id::text as id, e.title, e.category,
           to_char(e.start_at at time zone 'America/Chicago', 'YYYY-MM-DD"T"HH24:MI') as start,
           coalesce(sum(s.count) filter (where s.action = 'view'), 0)::int as view,
           coalesce(sum(s.count) filter (where s.action = 'ticket_click'), 0)::int as ticket_click,
           coalesce(sum(s.count) filter (where s.action = 'save'), 0)::int as save,
           coalesce(sum(s.count) filter (where s.action = 'calendar'), 0)::int as calendar
    from event_stats s
    join events e on e.id = s.event_id
    where s.day >= (now() at time zone 'America/Chicago')::date - (${window - 1})::int
    group by e.id, e.title, e.category, e.start_at
    order by view desc, ticket_click desc
    limit 50
  `;

  const daily = shapeDaily(dailyRows);
  const totals = { view: 0, ticket_click: 0, save: 0, calendar: 0 };
  for (const d of daily) {
    totals.view += d.view;
    totals.ticket_click += d.ticket_click;
    totals.save += d.save;
    totals.calendar += d.calendar;
  }

  return { totals, daily, top };
}
