import { sql } from "./db";
import type { EventRecord } from "./types";
import type { StatAction } from "./stats";

/**
 * TRENDING (roadmap 5.2). The first consumer of the 5.1 feedback loop:
 * rank upcoming events by what people are ACTUALLY doing — recently, and
 * weighted by intent — instead of by what an editor guesses.
 *
 * THE MATH:
 *  - Intent ladder: a ticket click means more than a view. Weights below.
 *  - Momentum, not lifetime totals: each day's counts decay with a 3-day
 *    half-life, so yesterday's spike beats last week's steady trickle and an
 *    event can't coast on old popularity.
 *  - Eligibility: published events you can still attend (upcoming, or a
 *    multi-day run still in progress).
 *
 * COLD-START HONESTY: stats collection just started. Three events with two
 * views each is not "trending" — it's noise wearing a crown. So there is a
 * score floor per event AND a minimum list size: unless at least MIN_LIST
 * events clear the floor, trending renders NOTHING. The surface earns its
 * place or it hides.
 */

export const TREND_WEIGHTS: Record<StatAction, number> = {
  view: 1,
  save: 3,
  calendar: 4,
  ticket_click: 5,
};

/** Days for a day's engagement to lose half its weight. */
export const TREND_HALF_LIFE_DAYS = 3;

/** Stats window considered (matches the admin's short window). */
export const TREND_WINDOW_DAYS = 7;

/** An event must score at least this to qualify (≈ 8 views today, or one
 *  ticket click + three views — enough to mean something). */
export const TREND_MIN_SCORE = 8;

/** Fewer than this many qualifying events ⇒ show nothing at all. */
export const TREND_MIN_LIST = 4;

/** Never show more than this many. */
export const TREND_CAP = 12;

/** Exponential decay by age in days: 1 today, 0.5 at the half-life, … */
export function decayFactor(ageDays: number): number {
  if (ageDays <= 0) return 1;
  return Math.pow(0.5, ageDays / TREND_HALF_LIFE_DAYS);
}

export interface StatRow {
  day: string; // YYYY-MM-DD (Chicago)
  action: StatAction;
  count: number;
}

/** Whole days between a stat day and today (Chicago); never negative. */
function ageInDays(day: string, todayKey: string): number {
  const a = new Date(`${day}T12:00:00Z`).getTime();
  const b = new Date(`${todayKey}T12:00:00Z`).getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/** Score one event's stat rows: Σ weight × count × decay(age). */
export function scoreRows(rows: StatRow[], todayKey: string): number {
  let score = 0;
  for (const r of rows) {
    const w = TREND_WEIGHTS[r.action] ?? 0;
    score += w * r.count * decayFactor(ageInDays(r.day, todayKey));
  }
  return score;
}

export interface ScoredEvent {
  event: EventRecord;
  score: number;
}

/**
 * Apply the floor, the all-or-nothing minimum, and the cap.
 * Ties break toward the sooner event (you can still make it).
 */
export function rankTrending(candidates: ScoredEvent[]): ScoredEvent[] {
  const qualified = candidates
    .filter((c) => c.score >= TREND_MIN_SCORE)
    .sort((a, b) => b.score - a.score || a.event.start.localeCompare(b.event.start));
  if (qualified.length < TREND_MIN_LIST) return [];
  return qualified.slice(0, TREND_CAP);
}

interface DbStatRow {
  id: string;
  day: string;
  action: StatAction;
  n: number;
}

/**
 * Trending events, ready to render. Same resilience contract as all analytics
 * reads (learned the hard way in 5.1): any failure logs and returns [] — a
 * trending strip must never take down the homepage.
 */
export async function getTrendingEvents(): Promise<ScoredEvent[]> {
  if (!sql) return [];
  try {
    // Stats for eligible events only: published, and still attendable.
    const statRows = await sql<DbStatRow[]>`
      select s.event_id::text as id, s.day::text as day, s.action, s.count::int as n
      from event_stats s
      join events e on e.id = s.event_id
      where s.day >= (now() at time zone 'America/Chicago')::date - (${TREND_WINDOW_DAYS - 1})::int
        and e.status = 'published'
        and coalesce(e.multi_day_end, e.end_at, e.start_at) >= now()
    `;
    if (statRows.length === 0) return [];

    const byEvent = new Map<string, StatRow[]>();
    for (const r of statRows) {
      (byEvent.get(r.id) ?? byEvent.set(r.id, []).get(r.id)!).push({
        day: r.day,
        action: r.action,
        count: r.n,
      });
    }

    // Fetch full records once, via the read path (clean titles etc.).
    const { getEventsByIds } = await import("./events");
    const events = await getEventsByIds([...byEvent.keys()]);

    const todayKey = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Chicago",
    }).format(new Date());

    const scored: ScoredEvent[] = events.map((event) => ({
      event,
      score: scoreRows(byEvent.get(event.id) ?? [], todayKey),
    }));

    return rankTrending(scored);
  } catch (err) {
    console.error("[trending] failed (returning empty):", err);
    return [];
  }
}
