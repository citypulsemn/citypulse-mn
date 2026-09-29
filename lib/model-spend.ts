/**
 * The ledger of what this project spends on models.
 *
 * `lib/api-usage.ts` accumulates a run's spend in memory, deliberately: it is
 * called on the hot path of every agent call and is forbidden to throw, so a
 * database write there would be a new way for a research run to die. This is
 * the other half — ONE write, at the end, from whichever script just finished.
 *
 * WHY IT EXISTS. Until 29 Sep 2026 only `scripts/run-pipeline.ts` wrote its
 * cost anywhere, so /admin/ops could see the weekly research pipeline and
 * nothing else. The verify pass runs twice a week and cost ~$58 in September
 * against the pipeline's ~$47 — the job nobody was watching was the bigger
 * one. The tile read $22.78 in green while the console read $181.87.
 *
 * WHAT IT STILL IS NOT. Our measurement of our jobs, never the account's bill.
 * Anything spending on this organisation's key from outside this repo is not
 * here and cannot be. The tile says so and links to the console.
 */
import postgres from "postgres";
import { sql } from "./db";
import { isCi } from "./env";
import { runUsageTotals } from "./api-usage";

/** The jobs that spend. Adding one is a row, not a migration. */
export type SpendJob =
  | "pipeline"
  | "verify"
  | "check-reports"
  | "restore-drafted"
  | "resweep-verified"
  | "research-places"
  | "reels";

export interface SpendRow {
  job: string;
  cost_usd: number;
  searches: number;
  calls: number;
  unpriced_calls: number;
  runs: number;
}

/**
 * Record what this process spent, if it spent anything.
 *
 * A run that made no model call writes NO row. The record has to mean "this
 * happened" — the same rule the digest learned when dry runs were leaving
 * rows that read as real sends. check-reports fires every thirty minutes and
 * returns early on an empty queue; 139 rows of $0.00 a month would bury the
 * runs that cost something.
 *
 * Never throws. An instrument that can kill the job it measures is worse than
 * no instrument, and this one runs last, after the work is already done.
 */
export async function recordRunSpend(job: SpendJob, note?: string): Promise<void> {
  try {
    const t = runUsageTotals();
    if (t.calls === 0) return;
    const url = process.env.DATABASE_URL;
    if (!url) {
      console.warn(`[spend] ${job}: ${t.usd.toFixed(4)} not recorded — no DATABASE_URL`);
      return;
    }
    // Its OWN connection, not the shared singleton in lib/db. This is called
    // from .finally(), by which point the script has usually run sql.end() —
    // and lib/db's client is a process-global that cannot be reopened. Paying
    // for one extra connection at process exit is cheaper than the blind spot.
    const own = postgres(url, { max: 1, idle_timeout: 5, prepare: false });
    try {
      await own`
        insert into model_spend (job, cost_usd, searches, calls, unpriced_calls, ci, note)
        values (${job}, ${t.usd.toFixed(4)}, ${t.searches}, ${t.calls}, ${t.unpriced}, ${isCi()}, ${note ?? null})`;
    } finally {
      await own.end({ timeout: 5 });
    }
    console.log(
      `[spend] ${job}: $${t.usd.toFixed(4)} over ${t.calls} call(s), ${t.searches} search(es)` +
        (t.unpriced > 0 ? `, ${t.unpriced} at an unknown rate` : "") +
        " — recorded",
    );
  } catch (err) {
    // Loud, because a silent failure here recreates the blind spot this exists
    // to close — but not fatal, because the spending already happened.
    console.error(`[spend] ${job}: FAILED to record —`, err);
  }
}

/** This calendar month's spend, by job. Empty array when nothing is recorded. */
export async function getMonthlySpend(): Promise<SpendRow[]> {
  if (!sql) return [];
  const rows = await sql<SpendRow[]>`
    select job,
           sum(cost_usd)::float8        as cost_usd,
           sum(searches)::int           as searches,
           sum(calls)::int              as calls,
           sum(unpriced_calls)::int     as unpriced_calls,
           count(*)::int                as runs
    from model_spend
    where ran_at >= date_trunc('month', now())
    group by job
    order by sum(cost_usd) desc`;
  return rows;
}

/** Total of a by-job breakdown. */
export function totalSpend(rows: SpendRow[]): number {
  return rows.reduce((sum, r) => sum + (Number.isFinite(r.cost_usd) ? r.cost_usd : 0), 0);
}

/**
 * "pipeline $47.40 · verify $58.02" — biggest first, so the line leads with
 * the job worth arguing about.
 */
export function describeSpend(rows: SpendRow[]): string {
  if (rows.length === 0) return "nothing recorded yet";
  return rows
    .slice()
    .sort((a, b) => b.cost_usd - a.cost_usd)
    .map((r) => `${r.job} $${r.cost_usd.toFixed(2)}`)
    .join(" · ");
}
