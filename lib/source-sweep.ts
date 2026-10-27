/**
 * Read the one column nobody was reading.
 *
 * `events.source_checked_at` is stamped by `scripts/check-sources.ts` after it
 * actually reads a cited page, and `stalestFirst` sorts the weekly budget by
 * it. For four weeks in Sep–Oct 2026 the sweep did not run at all, the newest
 * stamp in the table sat frozen at 28 Sep, and nothing anywhere looked at it.
 * This module is the look. The judgement is `judgeSourceSweep` in
 * lib/vendor-health.ts; this file only measures.
 *
 * ONE READER FOR TWO SURFACES. The Monday ops email and `/admin/ops` both call
 * this, so they cannot disagree about whether the sweep is alive — the same
 * contract `gatherOpsInputs` keeps for every other section. Only the email is
 * actually read on a phone at 9pm, which is why the verdict goes there and not
 * only into a tile.
 *
 * Matches the sweep's own scope exactly: published rows, still upcoming, with
 * an http(s) source. A row the sweep never looks at must not count against it.
 */
import { sql } from "./db";
import { SWEEP_PAGE_BUDGET } from "./source-presence";
import { expectedPages, type SourceSweepHealth } from "./vendor-health";

/**
 * How far back from the NEWEST stamp still counts as the same run.
 *
 * NOT a calendar window, and the difference is the whole correctness of
 * `pagesSwept`. The first version counted a fixed 8 days against a 7-day
 * cadence, so every measurement carried the previous run's stamps: a sweep that
 * died after three pages still reported last week's 372, and the partial-run
 * alarm could not fire on the week it mattered. Anchoring on the newest stamp
 * measures one run however long after it the question is asked — which matters,
 * because the `/admin/ops` tile asks mid-week and a window shorter than the
 * cadence would report zero pages on a perfectly healthy Thursday.
 *
 * A sweep takes about twelve minutes, so a day is ~100x headroom and still
 * nowhere near the seven-day gap to the run before it. A deliberate
 * `--host=` run on a LATER day becomes the newest stamp and will read as a
 * partial sweep; that is a `warn` an operator who just ran one will recognise,
 * and the alarm erring towards "look at this" is the right direction.
 */
export const SWEEP_RUN_WINDOW_HOURS = 24;

export async function getSourceSweepHealth(
  runWindowHours: number = SWEEP_RUN_WINDOW_HOURS,
): Promise<SourceSweepHealth> {
  if (!sql) throw new Error("no database connection");
  // `pages_swept` is anchored to `newest` rather than to `now()` — see the note
  // on SWEEP_RUN_WINDOW_HOURS. The lookback is built with `make_interval` so the
  // hours travel as a bound parameter instead of as text spliced into a literal.
  const [row] = await sql<
    {
      newest: string | null;
      pages_swept: number;
      pages_total: number;
      never_checked: number;
      listings: number;
    }[]
  >`
    with scoped as (
      select source_url, source_checked_at
      from events
      where status = 'published' and start_at > now() and source_url ~* '^https?://'
    ), newest as (
      select max(source_checked_at) as at from scoped
    )
    select
      n.at::text as newest,
      count(distinct s.source_url) filter (
        where s.source_checked_at > n.at - make_interval(hours => ${runWindowHours})
      )::int as pages_swept,
      count(distinct s.source_url)::int as pages_total,
      count(*) filter (where s.source_checked_at is null)::int as never_checked,
      count(*)::int as listings
    from scoped s cross join newest n
    group by n.at
  `;
  // Why the unverified ones are unverified, from the note the sweep records on
  // every attempt. Grouped on the category half so `blocked:403` and
  // `blocked:429` read as one cause.
  //
  // RULE 1: this is the aux half of the measurement and it must not be able to
  // take the main half down with it. `source_check_note` arrives by migration,
  // so between the deploy and the `alter table` this query is the one thing here
  // that cannot run — and a missing breakdown has a correct rendering ("no cause
  // recorded yet") while a thrown error would blank the whole Source check
  // section in the Monday email and call it unavailable.
  let causes: { category: string; listings: number }[] = [];
  try {
    causes = [
      ...(await sql<{ category: string; listings: number }[]>`
        select split_part(coalesce(source_check_note, 'not yet attempted'), ':', 1) as category,
               count(*)::int as listings
        from events
        where status = 'published' and start_at > now() and source_url ~* '^https?://'
          and source_checked_at is null
        group by 1 order by 2 desc`),
    ];
  } catch {
    causes = [];
  }
  const pagesTotal = row?.pages_total ?? 0;
  return {
    newestIso: row?.newest ?? null,
    pagesSwept: row?.pages_swept ?? 0,
    pagesTotal,
    pagesExpected: expectedPages(pagesTotal, SWEEP_PAGE_BUDGET),
    neverChecked: row?.never_checked ?? 0,
    unverifiedBy: causes.map((c) => ({ category: c.category, listings: c.listings })),
    listings: row?.listings ?? 0,
    runWindowHours,
  };
}
