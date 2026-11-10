/**
 * Gather every instrument the ops digest reads.
 *
 * WHY THIS IS IN lib/ AND NOT IN THE SENDER. It was the sender's private
 * `gather()` for its whole life, which meant the only way to see any of it was
 * to wait for Monday's email. `/admin/ops` renders the same inputs through the
 * same `buildSections`, so the page and the email can never drift — there is
 * one gatherer and one formatter, and the page is just the email you can reach
 * on a phone at 9pm on a Saturday.
 *
 * THE RESILIENCE CONTRACT travels with it: every source is independently
 * caught and a failure becomes an "unavailable" section, never a dead email or
 * a 500. `errors` carries the reasons. Nothing in here may throw.
 */
import { sql } from "./db";
import { composeOpsDigest, baselineSeries, pickBaseline, BASELINE_READ_ROWS, PIPELINE_STAMPEDE, type BaselineRow, type OpsInputs, type PipelineRow } from "./ops-digest";
import { assessCoverage, formatCoverageAlerts } from "./coverage";
import { getEngagementStrict, type Engagement } from "./stats";
import { getTrendingEvents } from "./trending";
import { getDigestSends, getDaysSinceLastDigest } from "./digest-send";
import { getFeedAdoption } from "./feed-stats";
import { getSearchImpressions } from "./search-console";
import { actionsConfigured, getActionsHealth, type WorkflowHealth } from "./actions-health";
import { withDeadline } from "./vendor-health";
import { getSourceSweepHealth } from "./source-sweep";
import { getPendingSubmissionCount } from "./submissions";
import { openFlagCount, openVerifyFlags } from "./verify-flags";
import { getPendingReportCount, getOldestPendingReportDays, getPendingReportsWithChecks } from "./event-reports";
import { formatCheckLine, type CheckVerdict } from "./report-check";
import { reportActionUrl, reportActionSecret } from "./report-token";
import { findContradictions, findPlaceholderTitles, formatFinding, type CalendarRow } from "./contradictions";

/** How long the Monday numbers will wait on Google before shrugging. */
const GSC_BUDGET_MS = 5_000;

/** Same courtesy for GitHub: four parallel reads, then give up and say so. */
const ACTIONS_BUDGET_MS = 5_000;

/**
 * The stored totals of the last run old enough to be a week-ago baseline.
 *
 * One query, one rule (`pickBaseline` / `BASELINE_MIN_AGE_HOURS`), three
 * callers: the engagement, sitemap and GSC-impression baselines below. Each
 * caller keeps its OWN `wrap` key, so one failure still degrades only its own
 * line — that is the R2.3 contract, and it is why this is a shared function
 * rather than a single hoisted read.
 *
 * The database computes the age, so there is no timestamp parameter to get
 * wrong. BASELINE_READ_ROWS looks past a full day of re-runs and still feeds
 * the decline window; if every row it returns is too new, `pickBaseline` says
 * null and the sections print "first report" instead of comparing today
 * against this morning.
 */
async function baselineRows(): Promise<BaselineRow[]> {
  if (!sql) throw new Error("no database connection");
  const rows = await sql<BaselineRow[]>`
    select extract(epoch from (now() - sent_at))::float8 as age_seconds, totals
    from ops_digest_runs order by sent_at desc limit ${BASELINE_READ_ROWS}`;
  return [...rows];
}

async function prevRunTotals(): Promise<Record<string, number> | null> {
  return pickBaseline(await baselineRows());
}

/**
 * The whole usable history, newest-first, for `declineReason`.
 *
 * Its own `wrap` key, like every other aux read: if this one fails, the two
 * sections lose their trend line and keep every number they were already
 * reporting. `declineReason` is silent on an empty series, so the degradation
 * needs no special case.
 */
async function prevRunSeries(): Promise<Record<string, number>[]> {
  return baselineSeries(await baselineRows());
}

export async function gatherOpsInputs(): Promise<OpsInputs> {
  const errors: Record<string, string> = {};
  const wrap = async <T>(key: string, fallback: T, fn: () => Promise<T>): Promise<T> => {
    try {
      return await fn();
    } catch (err) {
      errors[key] = err instanceof Error ? err.message : String(err);
      return fallback;
    }
  };

  // F2.6 — recent runs: [0] is current; the diff baseline is the most recent
  // SUCCESSFUL run before it (a failed run recorded zeros — diffing against
  // those would fake a huge swing).
  const pipelineRows = await wrap<PipelineRow[]>("pipeline", [], async () => {
    if (!sql) throw new Error("no database connection");
    const rows = await sql<PipelineRow[]>`
      select to_char(started_at at time zone 'America/Chicago', 'YYYY-MM-DD HH24:MI') as started_at,
             to_char(finished_at at time zone 'America/Chicago', 'YYYY-MM-DD HH24:MI') as finished_at,
             ok, upserted, cancelled, archived, collapsed, collapsed_runs, unnamed_dropped, error
      from pipeline_runs order by started_at desc limit 6`;
    return [...rows];
  });
  const pipeline = pipelineRows[0] ?? null;
  const priorSuccessful = pipelineRows.slice(1).filter((r) => r.ok);
  const prevPipeline = priorSuccessful[0] ?? null;
  // Stampede baseline = the median of the last N successful runs (rolling).
  const recentPipeline = priorSuccessful.slice(0, PIPELINE_STAMPEDE.baselineWindow);

  const coverage = await wrap("coverage", { healthy: true, alerts: ["section gathered nothing"] }, async () => {
    if (!sql) throw new Error("no database connection");
    const events = await sql<{ category: string; start: string }[]>`
      select category, to_char(start_at at time zone 'America/Chicago', 'YYYY-MM-DD"T"HH24:MI') as start
      from events where status = 'published' and start_at >= now()`;
    const report = assessCoverage(events as never, new Date());
    return { healthy: report.healthy, alerts: formatCoverageAlerts(report) };
  });

  const verify = await wrap("verify", { verified7: 0, neverVerifiedUpcoming: 0 }, async () => {
    if (!sql) throw new Error("no database connection");
    const [row] = await sql<{ verified7: number; never_upcoming: number }[]>`
      select
        count(*) filter (where verified_at >= now() - interval '7 days')::int as verified7,
        count(*) filter (where verified_at is null and start_at >= now() and status = 'published')::int as never_upcoming
      from events`;
    return { verified7: row?.verified7 ?? 0, neverVerifiedUpcoming: row?.never_upcoming ?? 0 };
  });

  // R2.3 — the STRICT read, threaded through wrap like every other section.
  // getEngagement's swallow returns zeros on failure; a cockpit that reports
  // failure-zeros as fact ("views 0, -100% WoW") also poisons next week's
  // baseline with them. Failure here now renders "unavailable" instead.
  const emptyEngagement: Engagement = {
    totals: { view: 0, ticket_click: 0, save: 0, calendar: 0 },
    daily: [],
    top: [],
  };
  const engagement = await wrap("engagement", emptyEngagement, () => getEngagementStrict(7));

  // R2.3 — aux reads get their OWN keys. These used to share "engagement" /
  // "subscribers" / "index" with the main sections, so a failed read of LAST
  // week's numbers rendered THIS week's perfectly good section "unavailable".
  // Aux failures degrade instead: null → "first report" / an omitted line.
  const prevTotals = await wrap<OpsInputs["prevTotals"]>("engagement_prev", null, async () =>
    ((await prevRunTotals()) as OpsInputs["prevTotals"]) ?? null,
  );

  const prevSeries = await wrap<Record<string, number>[]>("baseline_series", [], prevRunSeries);

  const trending = await wrap("trending", { count: 0, top: [] as string[] }, async () => {
    const ranked = await getTrendingEvents();
    return { count: ranked.length, top: ranked.slice(0, 3).map((r) => r.event.title) };
  });

  const feeds = await wrap("feeds", { clicks7: 0, top: [] as { label: string; count: number }[] }, () =>
    getFeedAdoption(7),
  );

  // What's waiting on a person. Read together so one failure degrades the whole
  // section honestly rather than reporting "0 reports" when the query threw.
  const queue = await wrap(
    "queue",
    {
      submissions: 0,
      reports: 0,
      oldestReportDays: null as number | null,
      musicReview: 0,
      verifyFlags: 0,
      verifyFlagExamples: [] as string[],
    },
    async () => {
      if (!sql) throw new Error("no database connection");
      // OPEN, not flagged-ever — and through lib/verify-flags.ts since 10 Nov
      // 2026, not inline. This was the THIRD hand-rolled copy of that rule and
      // it carried the bug the helper exists to prevent: a bare
      // `verified_at is null` with no after-stamp clause, so a flag raised after
      // a stamp vanished. It reported 0 while hiding 1. The comment that used to
      // sit here claimed the item closes itself once a later pass verifies the
      // listing — true, and the reason the count was wrong.
      const musicReview = await openFlagCount("import_music_review");
      // Listings the freshness pass flagged that are STILL LIVE. The predicate
      // moved to lib/verify-flags.ts on 3 Nov 2026 so this count and the
      // `/admin?status=flagged` screen cannot disagree — a hand-written query
      // over the same table that day returned 164, then 25, against this 33,
      // because "open" also covers a flag raised AFTER a stamp.
      const sorted = await openVerifyFlags();

      return {
        submissions: await getPendingSubmissionCount(),
        reports: await getPendingReportCount(),
        oldestReportDays: await getOldestPendingReportDays(),
        musicReview,
        verifyFlags: sorted.length,
        verifyFlagExamples: sorted
          .slice(0, 4)
          .map((f) => `${f.verdict}: "${f.title.slice(0, 44)}" @ ${f.venue.slice(0, 28)} · ${f.day}`),
      };
    },
  );

  // The open reports themselves, with whatever the automated check found. This
  // is the backstop copy — `npm run inbox` mails the same verdicts and
  // the same buttons as soon as a check completes, which is the timely channel.
  // Wrapped like everything else: a failure here degrades to no section rather
  // than to a reassuring empty one.
  const reports = await wrap("reports", [] as OpsInputs["reports"], async () => {
    const secret = reportActionSecret();
    const site = (process.env.SITE_URL ?? "https://citypulsemn.com").replace(/\/+$/, "");
    const rows = await getPendingReportsWithChecks();
    return rows.map((r) => ({
      title: r.event_title,
      venue: r.event_venue,
      start: r.event_start,
      kind: r.kind,
      reason: r.reason,
      verdict: r.check_verdict ?? "unchecked",
      verdictLine: r.check_verdict
        ? formatCheckLine({
            verdict: r.check_verdict as CheckVerdict,
            note: r.check_note,
            evidence: r.check_evidence,
          })
        : "Not checked yet — run `npm run inbox`.",
      actions: [
        { label: "Take it down", href: reportActionUrl(site, r.id, "delete", secret), danger: true },
        { label: "Keep it", href: reportActionUrl(site, r.id, "keep", secret) },
      ],
    }));
  });

  // The self-check. No outside source, so it can run for every category —
  // including the five that have no feed to verify against. Wrapped like every
  // other section: if the read throws, the section says "unavailable" rather
  // than reporting a reassuring zero.
  const contradictions = await wrap(
    "contradictions",
    {
      conflicts: 0, duplicates: 0, placeholderVenues: 0, placeholderTitles: 0,
      examples: [] as string[], dupExamples: [] as string[], titleExamples: [] as string[],
    },
    async () => {
      if (!sql) throw new Error("no database connection");
      const rows = await sql<CalendarRow[]>`
        select id::text as id, venue, title, category,
               (verified_at is not null) as verified,
               to_char(start_at at time zone 'America/Chicago', 'YYYY-MM-DD"T"HH24:MI') as start
        from events where status = 'published' and start_at >= now()`;
      const report = findContradictions([...rows]);
      const titles = findPlaceholderTitles([...rows]);
      return {
        conflicts: report.conflicts.length,
        duplicates: report.duplicates.length,
        placeholderVenues: report.placeholderVenues.length,
        placeholderTitles: titles.length,
        examples: report.conflicts.slice(0, 5).map(formatFinding),
        // Named, not just counted. A duplicate pair that is both rows LIVE is the
        // one the write gate skips as "the panel's problem"
        // (lib/contradictions.ts findIncomingDuplicates pass 1), so this line is
        // the only place it is ever reported.
        dupExamples: report.duplicates.slice(0, 5).map(formatFinding),
        titleExamples: titles.slice(0, 4).map((t) => `${t.day} · ${t.venue}: "${t.title}"`),
      };
    },
  );

  // Every fold the write gate made, NAMED. `planRunFolds` declines an insert,
  // so a wrong fold is an event that silently never appears — and the only
  // traces were an admin_audit row (no read path in the app) and a console.log
  // in the Actions log. Read straight from the audit trail rather than from a
  // new pipeline_runs column: the trail already carries the title and the
  // keeper, which is what makes the line reviewable instead of a bare count.
  const folds = await wrap("folds", { count7: 0, drift7: 0, examples: [] as string[] }, async () => {
    if (!sql) throw new Error("no database connection");
    const rows = await sql<
      {
        title: string;
        keptTitle: string;
        kept: string;
        extendedTo: string | null;
        day: string;
        drift: boolean;
      }[]
    >`
      select coalesce(patch->>'title', '(untitled)') as title,
             coalesce(patch->>'kept_title', '') as "keptTitle",
             coalesce(patch->>'kept', '') as kept,
             patch->>'extended_to' as "extendedTo",
             -- Folds written before the drift rule existed carry no flag, and
             -- they were all key matches, so absent reads as false.
             coalesce((patch->>'drift')::boolean, false) as drift,
             to_char(at at time zone 'America/Chicago', 'YYYY-MM-DD') as day
      from admin_audit
      where action = 'run:folded' and at >= now() - interval '7 days'
      order by at desc`;
    return {
      count7: rows.length,
      drift7: rows.filter((r) => r.drift).length,
      // BOTH titles. The suppressed row and the keeper can be worded
      // differently — that is the whole reason the alias key exists — and it is
      // precisely then that the operator needs to see the two side by side.
      // `kept` is the uuid fallback for rows written before kept_title existed.
      // DRIFT FIRST, then newest. The examples are capped at five and the
      // query returns newest-first, so on a busy week the judgement calls — the
      // only folds that need a human — were the ones getting cut: replayed at
      // the real batch size, a drift fold appeared among the printed five in
      // under a third of the passes that made one. A count nobody can review is
      // the failure this section was built to end. Sort is stable, so recency
      // still orders within each group.
      examples: [...rows]
        .sort((a, b) => Number(b.drift) - Number(a.drift))
        .slice(0, 5)
        .map(
        (r) =>
          `${r.day} · "${r.title.slice(0, 44)}" → kept ` +
          (r.keptTitle ? `"${r.keptTitle.slice(0, 44)}"` : r.kept.slice(0, 8)) +
          // Marked on the line itself, not only in the count above: the
          // examples are where the two titles sit side by side, and a drift
          // fold is exactly the one where they are supposed to differ.
          (r.drift ? " (title similarity)" : "") +
          (r.extendedTo ? `, run extended to ${r.extendedTo}` : ", span unchanged"),
        ),
    };
  });

  const subscribers = await wrap("subscribers", { total: 0, delta7: 0, bySource7: [] as { source: string; count: number }[] }, async () => {
    if (!sql) throw new Error("no database connection");
    const [row] = await sql<{ total: number; delta7: number }[]>`
      select
        count(*) filter (where status = 'subscribed')::int as total,
        count(*) filter (where status = 'subscribed' and created_at >= now() - interval '7 days')::int as delta7
      from subscribers`;
    const bySource7 = await sql<{ source: string; count: number }[]>`
      select source, count(*)::int as count
      from subscribers
      where status = 'subscribed' and created_at >= now() - interval '7 days'
      group by source order by count desc`;
    return { total: row?.total ?? 0, delta7: row?.delta7 ?? 0, bySource7: [...bySource7] };
  });

  const lastDigestNote = await wrap<string | null>("digest_note", null, async () => {
    const sends = await getDigestSends(1);
    return sends[0]?.note ?? null;
  });

  // Its OWN error key (the R2.3 aux convention): if this read fails we must not
  // render the Subscribers section unavailable — but we also must not silently
  // report 'fine'. A failure here prints an explicit 'could not check' line.
  const lastDigestDaysAgo = await wrap<number | null>("digest_age", null, () =>
    getDaysSinceLastDigest(),
  );

  const sitemapUrls = await wrap<number | null>("index", null, async () => {
    const base = process.env.SITE_URL;
    if (!base) return null;
    const res = await fetch(`${base.replace(/\/$/, "")}/sitemap.xml`);
    if (!res.ok) throw new Error(`sitemap fetch ${res.status}`);
    const xml = await res.text();
    return (xml.match(/<loc>/g) ?? []).length;
  });

  const prevSitemapUrls = await wrap<number | null>("index_prev", null, async () =>
    (await prevRunTotals())?.sitemap_urls ?? null,
  );

  // F2.4 — GSC impressions. getSearchImpressions returns null (→ manual line)
  // when the service account isn't configured, so this is safe pre-wire.
  //
  // IT GETS A BUDGET, NOT THE SECTION'S. Google is the only outside service in
  // a gather that is otherwise entirely about our own calendar, and every step
  // here is awaited in series. getSearchImpressions makes two round-trips — an
  // OAuth token, then the query — which lib/search-console.ts caps at 6s each.
  // Twelve seconds plus ~3s of database work overran the 15s deadline on
  // /admin/ops, so one slow vendor blanked the whole panel: pipeline, coverage,
  // verification and the queue, none of which had anything to do with Google.
  //
  // Five seconds, then null, which is already the defined "not reported" state
  // for this field and prints as the manual line the digest has always had.
  // Rule 1: the instrument must not be killable by something it merely reports.
  const search = await wrap("search", null, () =>
    withDeadline(getSearchImpressions(7), GSC_BUDGET_MS, null),
  );
  const prevSearchImpressions = await wrap<number | null>("search_prev", null, async () =>
    (await prevRunTotals())?.search_impressions ?? null,
  );

  // The run's own conclusion. A timeout must NOT degrade to null: null is the
  // defined "no token configured" state (Vercel), which is quiet by design, and
  // a silent GitHub outage wearing that costume is the exact failure this
  // section exists to end. So the configured check happens first, and a timeout
  // throws into `errors` → "unavailable" + alert, like any other section.
  const actions = await wrap<WorkflowHealth[] | null>("actions", null, async () => {
    if (!actionsConfigured()) return null;
    // Tagged rather than a bare null fallback: withDeadline's fallback has to be
    // the same type as the promise, and null already means "not configured".
    const got = await withDeadline<{ read: true; health: WorkflowHealth[] | null } | { read: false }>(
      getActionsHealth().then((health) => ({ read: true as const, health })),
      ACTIONS_BUDGET_MS,
      { read: false },
    );
    if (!got.read) throw new Error("GitHub Actions read timed out");
    return got.health;
  });

  // Is the weekly fabrication check alive? Null on a failed read, which the
  // section renders "unavailable" and alerts on — never a quiet green. This is
  // the column that sat frozen at 28 Sep for four weeks while nothing read it.
  const sourceSweep = await wrap("source_sweep", null, () => getSourceSweepHealth());

  return {
    actions,
    prevSeries,
    pipeline,
    prevPipeline,
    recentPipeline,
    coverageHealthy: coverage.healthy,
    coverageAlerts: coverage.alerts,
    verify,
    sourceSweep,
    engagement,
    prevTotals,
    trending,
    subscribers,
    lastDigestNote,
    lastDigestDaysAgo,
    feeds,
    queue,
    reports,
    contradictions,
    folds,
    sitemapUrls,
    prevSitemapUrls,
    search,
    prevSearchImpressions,
    errors,
  };
}
