/**
 * Research horizon (how far ahead the pipeline looks, and how hard).
 *
 * The problem: we want the calendar populated months ahead so someone browsing
 * the future sees something — but far-out listings are sparse and firm up as the
 * date nears. So we research in BANDS, each with its own depth and cadence:
 *
 *   near  (0–21d)   deep,  every week   ← the "revisit closer to the date" guarantee
 *   mid   (22–60d)  medium, every week
 *   far   (61–120d) lighter, every 2 weeks (seeds the long calendar; saves cost)
 *
 * Because the windows slide forward every run and upserts are idempotent, an
 * event first caught far out gets re-found and ENRICHED as it migrates
 * far → mid → near (deeper, more frequent passes). Dedup means no duplicates;
 * sticky status means your publish decisions survive the re-research.
 *
 * Tune freely. More/wider bands = more coverage but more API cost
 * (cost ≈ categories × bands that run that week).
 */

export interface HorizonBand {
  label: string;
  startDay: number; // days from today, inclusive
  endDay: number; // days from today, inclusive
  maxSearchUses: number; // web_search budget for agents in this band
  everyNWeeks: number; // 1 = every run, 2 = every other run, …
}

export const HORIZON: HorizonBand[] = [
  { label: "near", startDay: 0, endDay: 21, maxSearchUses: 8, everyNWeeks: 1 },
  { label: "mid", startDay: 22, endDay: 60, maxSearchUses: 6, everyNWeeks: 1 },
  { label: "far", startDay: 61, endDay: 120, maxSearchUses: 5, everyNWeeks: 2 },
];

export interface HorizonWindow {
  label: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  maxSearchUses: number;
}

function addDaysISO(now: Date, days: number): string {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whole-week counter since the epoch, in UTC — used for band cadence. */
export function weekIndex(now: Date): number {
  const dayMs = 86_400_000;
  const utcMidnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  return Math.floor(utcMidnight / dayMs / 7);
}

/** The bands due to run for a given date (respecting each band's cadence). */
export function dueWindows(now: Date, horizon: HorizonBand[] = HORIZON): HorizonWindow[] {
  const wi = weekIndex(now);
  const out: HorizonWindow[] = [];
  for (const b of horizon) {
    if (wi % b.everyNWeeks !== 0) continue;
    out.push({
      label: b.label,
      startDate: addDaysISO(now, b.startDay),
      endDate: addDaysISO(now, b.endDay),
      maxSearchUses: b.maxSearchUses,
    });
  }
  return out;
}
