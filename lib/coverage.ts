import { CATEGORY_KEYS, CATEGORIES } from "./categories";
import { MONTHS } from "./dates";
import type { CategoryKey } from "./types";

/**
 * COVERAGE MONITOR (roadmap 4.3).
 *
 * The Live Music collection sat empty for weeks and nobody knew — it was found
 * by a human looking at the site. That's the real failure: not the gap itself,
 * but the absence of any instrument that would report one. Features get built and
 * shipped; nothing checks whether the pipeline's OUTPUT is any good.
 *
 * This module answers one question — "how many events do we have, per category,
 * per week, for the next month?" — and flags anything below a floor. Pure and
 * unit-tested; used by both the admin dashboard and the pipeline's run log, so a
 * thin category shows up in two places you already look.
 */

export type CoverageStatus = "ok" | "thin" | "empty";

/**
 * Minimum events per category per week for the calendar to feel honest.
 * These are editorial judgments about the Twin Cities, not statistics: a week
 * with no live music is broken; a week with no "unique" oddity is just a normal
 * week. Tuned deliberately low so the flags mean something when they fire.
 */
export const WEEKLY_FLOORS: Record<CategoryKey, number> = {
  music: 6, // a metro this size has live music every night
  arts: 4,
  family: 3,
  food: 3,
  sports: 2, // seasonal — quiet in the deep offseason
  festival: 2,
  weird: 1, // genuinely scarce; one is a good week
};

export interface WeekBucket {
  key: string; // ISO date of the week's Monday
  label: string; // "Jul 13"
  start: Date;
  end: Date;
}

export interface CoverageCell {
  category: CategoryKey;
  week: string;
  count: number;
  floor: number;
  status: CoverageStatus;
}

export interface CoverageAlert {
  category: CategoryKey;
  label: string;
  week: string;
  count: number;
  floor: number;
  status: CoverageStatus;
}

export interface CoverageReport {
  weeks: WeekBucket[];
  cells: CoverageCell[];
  alerts: CoverageAlert[];
  totals: Record<CategoryKey, number>;
  /** True when nothing is below its floor anywhere in the window. */
  healthy: boolean;
}

const DAY_MS = 86_400_000;

/** Monday 00:00 of the week containing `d`. */
export function weekStart(d: Date): Date {
  const out = new Date(d);
  const dow = out.getDay(); // 0 Sun … 6 Sat
  const back = dow === 0 ? 6 : dow - 1; // Monday-based
  out.setDate(out.getDate() - back);
  out.setHours(0, 0, 0, 0);
  return out;
}

/** `weeks` consecutive week buckets starting with the week containing `now`. */
export function weekBuckets(now: Date, weeks = 4): WeekBucket[] {
  const first = weekStart(now);
  const out: WeekBucket[] = [];
  for (let i = 0; i < weeks; i++) {
    const start = new Date(first.getTime() + i * 7 * DAY_MS);
    const end = new Date(start.getTime() + 7 * DAY_MS - 1);
    out.push({
      key: isoDay(start),
      label: `${MONTHS[start.getMonth()].slice(0, 3)} ${start.getDate()}`,
      start,
      end,
    });
  }
  return out;
}

function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function statusFor(count: number, floor: number): CoverageStatus {
  if (count === 0) return "empty";
  if (count < floor) return "thin";
  return "ok";
}

/** Minimal shape needed to assess coverage. */
export interface CoverageInput {
  category: CategoryKey;
  start: string; // ISO / local wall-clock
}

/**
 * Build the category × week grid, plus the alerts worth acting on.
 * Events outside the window are ignored; unknown categories are skipped.
 */
export function assessCoverage(
  events: CoverageInput[],
  now: Date,
  weeks = 4,
): CoverageReport {
  const buckets = weekBuckets(now, weeks);
  const counts = new Map<string, number>(); // `${category}|${weekKey}`
  const totals = Object.fromEntries(CATEGORY_KEYS.map((k) => [k, 0])) as Record<CategoryKey, number>;

  for (const ev of events) {
    if (!CATEGORY_KEYS.includes(ev.category)) continue;
    const t = new Date(ev.start).getTime();
    if (Number.isNaN(t)) continue;
    const bucket = buckets.find((b) => t >= b.start.getTime() && t <= b.end.getTime());
    if (!bucket) continue;
    const k = `${ev.category}|${bucket.key}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
    totals[ev.category] += 1;
  }

  const cells: CoverageCell[] = [];
  const alerts: CoverageAlert[] = [];

  for (const category of CATEGORY_KEYS) {
    const floor = WEEKLY_FLOORS[category];
    for (const bucket of buckets) {
      const count = counts.get(`${category}|${bucket.key}`) ?? 0;
      const status = statusFor(count, floor);
      cells.push({ category, week: bucket.key, count, floor, status });
      if (status !== "ok") {
        alerts.push({
          category,
          label: CATEGORIES[category].label,
          week: bucket.label,
          count,
          floor,
          status,
        });
      }
    }
  }

  // Empty weeks are the emergency; thin weeks are the warning.
  alerts.sort((a, b) => {
    if (a.status !== b.status) return a.status === "empty" ? -1 : 1;
    return a.count - b.count;
  });

  return { weeks: buckets, cells, alerts, totals, healthy: alerts.length === 0 };
}

/** One-line-per-alert summary for the pipeline log / CI output. */
export function formatCoverageAlerts(report: CoverageReport): string[] {
  if (report.healthy) return ["[coverage] all categories meet their weekly floor ✓"];
  return report.alerts.map(
    (a) =>
      `[coverage] ${a.status === "empty" ? "EMPTY" : "thin "} ${a.label.padEnd(14)} week of ${a.week}: ${a.count}/${a.floor}`,
  );
}
