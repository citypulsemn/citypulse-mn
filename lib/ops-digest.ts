import type { Engagement } from "./stats";
import { judgeSourceSweep, type SourceSweepHealth } from "./vendor-health";
import type { SearchStats } from "./search-console";
import { esc } from "./digest";
import { EMAIL_HEAD } from "./email-head";

/**
 * OPS DIGEST (roadmap 2.1) — the cockpit, delivered.
 *
 * One email to the operator, Monday after the pipeline run, reading every
 * instrument the site already has: pipeline health, coverage floors, the
 * verify pass, engagement (with week-over-week), trending, subscribers.
 *
 * THE RESILIENCE CONTRACT IS THE DESIGN. Every section is gathered
 * independently; a failed source renders "section unavailable: <reason>"
 * and the email STILL SENDS. The whole point of a cockpit is that it keeps
 * reporting when something is broken — an ops email that dies when the
 * database hiccups is a smoke detector wired to the same fuse as the stove.
 *
 * composeOpsDigest is pure (inputs → subject/html/text) and golden-tested;
 * gatherOpsInputs (in scripts/send-ops-digest.ts territory via lib/db) does
 * the I/O. The WoW baseline lives in ops_digest_runs.totals (jsonb), written
 * only on successful sends.
 */

export interface PipelineRow {
  started_at: string;
  finished_at: string | null;
  ok: boolean;
  upserted: number | null;
  cancelled: number | null;
  archived: number | null;
  collapsed: number | null; // the DEDUPE count (near-duplicate merges)
  collapsed_runs: number | null; // F2.6: multi-day runs folded into spans
  /** Agent listings dropped at ingest for naming no event (Aug 2026). Null on
   *  rows written before the guard existed, which deltaTag renders as silence
   *  rather than as a fall to zero. */
  unnamed_dropped: number | null;
  error: string | null;
}

/**
 * Stampede detection (F2.6 → recal Aug 2026 → rolling baseline Aug 2026) — "how
 * R0.2 would have announced itself." A weekly run archives events that fully
 * passed and dedupes near-copies; a FLOOD of either is the fingerprint of a
 * predicate gone wrong.
 *
 * History of the threshold, each fix paid for in a false signal:
 *  1. Fixed `archived > 100` cried wolf — the weekly archive count climbs as the
 *     calendar grows (52 → 94 → 115 over Jul–Aug 2026), so a healthy 115 tripped
 *     a fixed 100. A stampede is a SPIKE, not a fixed number.
 *  2. Spike vs the SINGLE previous run was fragile: one anomalous week (a partial
 *     run that archived almost nothing) made the next normal week look like a
 *     multiple, or a high prior week masked a real spike.
 *
 * Now the baseline is the BUSIEST of the last N successful runs (their max), and
 * the test is:
 *   - with a baseline → purely RELATIVE: above the FLOOR *and* ≥ `ratio`× the
 *     busiest recent week. No fixed number, so it can never go stale as the
 *     calendar grows.
 *   - no baseline yet (first run) → the absolute CEILING is the only backstop.
 * Max, not median: during a growth phase the window reaches back to smaller
 * early weeks, and a median of those would lag BELOW the current level and flag
 * healthy growth as a spike (observed on the real 52→94→115 series). The max
 * tracks the recent high, so organic growth stays quiet, while a single LOW
 * outlier week (a partial run that archived almost nothing) can't fake a spike
 * the way a single-prior-run baseline would. The multiplier is 2.0× — a
 * doubling of the busiest recent week is worth a human look. Truly GRADUAL drift
 * (a climb that stays under the ratio week over week) is indistinguishable from
 * growth by count alone — that stays the human verify pass's job, which the
 * reason names.
 */
export const PIPELINE_STAMPEDE = {
  archivedFloor: 80,
  archivedCeiling: 250, // no-history backstop only (see isStampede)
  dedupedFloor: 60,
  dedupedCeiling: 200, // no-history backstop only
  ratio: 2.0,
  baselineWindow: 4, // baseline = max over the last N successful runs
};

/** Rolling stampede baseline: the busiest (max) of the recent successful-run
 *  counts, or null when there are none. Max — not median — so a growth-phase
 *  window of smaller early weeks doesn't deflate the baseline and flag healthy
 *  growth, while a lone low-outlier week still can't fake a spike. Pure. */
export function recentBaseline(nums: number[]): number | null {
  const xs = nums.filter((n) => Number.isFinite(n));
  return xs.length === 0 ? null : Math.max(...xs);
}

/** One stage's stampede test. With a `baseline` (busiest of recent runs): a spike
 *  above the floor and ≥ `ratio`× the baseline — purely relative, so growth-proof.
 *  Without one (first run): only the absolute ceiling can fire. Pure. */
export function isStampede(
  current: number,
  baseline: number | null | undefined,
  floor: number,
  ceiling: number,
  ratio = PIPELINE_STAMPEDE.ratio,
): boolean {
  if (baseline == null || baseline <= 0) return current >= ceiling; // no history → absolute backstop
  return current >= floor && current >= ratio * baseline; // spike vs the recent norm
}

/** Human reason string if this run looks like a stampede, else null. Shared by
 *  the ops digest and the pipeline log so they agree. `recent*` are the last N
 *  successful runs' counts; their busiest (max) is the baseline. */
export function stampedeReason(
  archived: number,
  deduped: number,
  recentArchived: number[],
  recentDeduped: number[],
): string | null {
  const S = PIPELINE_STAMPEDE;
  const hits: string[] = [];
  if (isStampede(archived, recentBaseline(recentArchived), S.archivedFloor, S.archivedCeiling)) hits.push(`${archived} archived`);
  if (isStampede(deduped, recentBaseline(recentDeduped), S.dedupedFloor, S.dedupedCeiling)) hits.push(`${deduped} deduped`);
  if (hits.length === 0) return null;
  return `${hits.join(" / ")} this run is unusually high vs recent runs; confirm no live event was wrongly removed (R0.2 territory)`;
}

/** " (+12)" / " (-3)" / " (±0)" for a run-over-run delta; "" when either side
 *  is unknown (a stage with no prior number, e.g. a brand-new column). */
export function deltaTag(cur: number | null | undefined, prev: number | null | undefined): string {
  if (cur == null || prev == null) return "";
  const d = cur - prev;
  return d === 0 ? " (±0)" : ` (${d > 0 ? "+" : ""}${d})`;
}

export interface OpsInputs {
  pipeline: PipelineRow | null;
  /** F2.6 — the run BEFORE `pipeline`, for run-over-run stage diffs. Null on
   *  the first-ever run. */
  prevPipeline: PipelineRow | null;
  /** The last N SUCCESSFUL runs before `pipeline` (most-recent first) — their
   *  median is the stampede baseline. Empty on the first-ever run. */
  recentPipeline: PipelineRow[];
  coverageHealthy: boolean;
  coverageAlerts: string[]; // formatCoverageAlerts() output, verbatim
  verify: { verified7: number; neverVerifiedUpcoming: number };
  /**
   * Is the weekly source check alive? Null when the read itself failed.
   *
   * THE SECTION THAT WOULD HAVE CAUGHT THE WORST SILENCE THIS PROJECT HAS HAD.
   * `check-sources` was dead for four weeks in Sep-Oct 2026 behind a broken
   * step, and the only evidence was `source_checked_at` going stale in a column
   * nothing read. The Actions tile was red for four Mondays and produced no
   * action, so the verdict belongs HERE, in the thing that gets opened.
   */
  sourceSweep: SourceSweepHealth | null;
  engagement: Engagement;
  prevTotals: Engagement["totals"] | null; // last ops_digest_runs row, or null on first run
  /** Newest-first stored run totals, oldest usable baseline last — the history
   *  `declineReason` judges. Element 0 is LAST week; this run's live numbers are
   *  passed separately. Empty on a first run or a failed read, which is silence
   *  rather than a fabricated trend. */
  prevSeries: Record<string, number>[];
  trending: { count: number; top: string[] };
  subscribers: {
    total: number;
    delta7: number;
    /** 7-day signups grouped by placement, most first. Empty when none. */
    bySource7?: { source: string; count: number }[];
  };
  lastDigestNote: string | null; // digest_sends.note — carries "N personalized"
  /** Whole days since the last REAL send (dry runs excluded), or null when none
   *  is recorded. The weekly email is the retention asset, and a missed send used
   *  to be SILENT — the note from the previous send just kept printing as if it
   *  were current. This is what turns that into a Monday-morning line. */
  lastDigestDaysAgo: number | null;
  /** F2.5 — calendar-subscribe clicks on the iCal feeds in the last 7 days. */
  feeds: { clicks7: number; top: { label: string; count: number }[] };
  /** Things waiting on a human: community submissions and listing reports.
   *  The BACKSTOP beneath the instant notification — if a notify email is ever
   *  dropped, this is what still surfaces the item. `oldestReportDays` drives
   *  the only alert here, because a stale REPORT means a cancelled event may
   *  still be live on the site (an honest-data failure), whereas an unreviewed
   *  submission just means a queue. */
  queue: {
    submissions: number;
    reports: number;
    oldestReportDays: number | null;
    /** Music listings a venue calendar disagreed with, still live and still
     *  unverified. SELF-CLEARING by construction: the flag is an append-only
     *  audit row, so "open" is computed from the listing's current state rather
     *  than from how many times it has been flagged. Nineteen flags were only
     *  ever one open item. */
    musicReview: number;
    /** Sep 2026 — listings the freshness pass FLAGGED, still published.
     *
     *  Every `verify_flag` row ever written was invisible: nothing read the
     *  table. A pass that raises its hand into a void is not an instrument, so
     *  its flags now reach this email. Self-clearing the same way `musicReview`
     *  is — computed from the listing's current state, not from flag count. */
    verifyFlags: number;
    /** A few of those, worst first, so the line is actionable rather than a
     *  count. `wrong_event` sorts first: the venue's own calendar contradicting
     *  us is the strongest negative the pass can produce. */
    verifyFlagExamples: string[];
  };
  /** What the calendar can catch by looking at ITSELF (lib/contradictions.ts).
   *  Needs no outside source, which is the point: arts, family, festival, food
   *  and weird have none. `conflicts` is the alert — two different things
   *  claimed in one room at one time means at most one of them is real. */
  contradictions: {
    conflicts: number;
    duplicates: number;
    placeholderVenues: number;
    /** Listings whose TITLE names no event — "Turf Club Show (Sep 3)". */
    placeholderTitles: number;
    /** A few formatted conflict lines, worst first, for the email body. */
    examples: string[];
    /** A few formatted duplicate lines. The only report these ever get. */
    dupExamples: string[];
    /** A few placeholder titles, so the line is actionable rather than a count. */
    titleExamples: string[];
  };
  /** Open listing reports WITH their automated check (Sep 2026), newest last.
   *  Absent or empty renders no section at all — the Queue line already covers
   *  "nothing waiting", and an empty block every week is noise. */
  reports?: {
    title: string;
    venue: string;
    start: string;
    kind: string;
    /** The reader's own words. Public input; escaped at render. */
    reason: string;
    /** `formatCheckLine` output, or a plain "not checked yet". */
    verdictLine: string;
    verdict: string;
    actions: OpsAction[];
  }[];
  /** Live sitemap URL count (fetched from SITE_URL/sitemap.xml — the number
   *  Google actually sees; zero drift by construction) + last week's. */
  sitemapUrls: number | null;
  prevSitemapUrls: number | null;
  /** F2.4 — GSC impressions/clicks (7d), the Phase 5 demand gate reading
   *  itself. Null until the service account is wired → the manual GSC line. */
  search: SearchStats | null;
  prevSearchImpressions: number | null;
  /** Sections that failed to gather: section key -> reason. Aux reads carry
   *  their own keys (R2.3: `engagement_prev`, `digest_note`, `index_prev`) so
   *  a failed read of LAST week's numbers degrades to "first report" / an
   *  omitted line instead of rendering this week's section unavailable. */
  errors: Record<string, string>;
}

/** A tappable decision rendered as a button in the HTML email. */
export interface OpsAction {
  label: string;
  href: string;
  /** Styles the button as the destructive one. */
  danger?: boolean;
}

export interface OpsSection {
  title: string;
  lines: string[];
  alert: boolean;
  /**
   * Rendered after `lines`, one block per item, each with its own buttons.
   * Separate from `lines` because those are escaped as plain text — a link in a
   * line would arrive as visible markup. Labels and hrefs are still escaped
   * when rendered; only the anchor itself is structural.
   */
  items?: { lines: string[]; actions?: OpsAction[] }[];
}

const SECTION_KEYS = [
  "pipeline",
  "coverage",
  "verify",
  "source_sweep",
  "engagement",
  "trending",
  "subscribers",
  "index",
  "feeds",
  "queue",
] as const;

/** A listing report older than this is an alert: the whole point of the channel
 *  is that a cancelled event comes down quickly. */
export const STALE_REPORT_DAYS = 3;

/** A digest older than this means a Thursday send was missed. The digest goes out
 *  Thursday and this report runs Monday, so a healthy week reads 4 days and a
 *  single skipped send reads 11 — 8 catches the miss without ever crying wolf on
 *  a normal week (or on GitHub's routine 1-4h scheduling delays). */
export const DIGEST_STALE_DAYS = 8;

/**
 * When the source sweep is DUE: the last step of Weekly Event Research, whose
 * cron is `0 6 * * 1` — Monday 06:00 UTC.
 *
 * A SCHEDULE AND NOT JUST A PERIOD, because this email is composed minutes
 * after that workflow completes. Judged on elapsed time, the first dead Monday
 * reads exactly one period old and any `judgeCron`-style grace calls it fine;
 * measured, that produced green on the first dead Monday, amber on the second,
 * red on the third. Shared with the /admin/ops tile, which samples the same
 * judge mid-week, so neither surface needs its own looser rule.
 */
export const SOURCE_SWEEP_SCHEDULE = { everyHours: 24 * 7, dueDayUTC: 1, dueHourUTC: 6 } as const;

function unavailable(reason: string): string[] {
  return [`section unavailable: ${reason}`];
}

/**
 * Normalize an ops_digest_runs.totals value read back from jsonb. Rows written
 * before the sql.json fix stored the object double-stringified (a jsonb string
 * scalar), which silently defeated every WoW comparison — the digest reported
 * "first report" forever. Accepts either shape; anything else is null, which
 * wowLabel renders honestly as "first report".
 */
export function parseStoredTotals(raw: unknown): Record<string, number> | null {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, number>;
}

/**
 * How old a stored run must be before it may serve as the week-over-week
 * baseline.
 *
 * The baseline means "what we reported LAST week", and `ops_digest_runs` gains a
 * row on every real send. The Monday job writes its row at ~09:01, so any later
 * read that day — a `--dry-run`, a second Actions run, or a load of
 * `/admin/ops`, which shares this gather — used to pick that row up and compare
 * today against a few hours ago.
 *
 * Measured 2 Nov 2026: the digest printed "views 581 (+2% WoW)" and "1409 URLs
 * (±0%)" while over the real week the sitemap had fallen 1,508 → 1,409 and GSC
 * impressions 20,954 → 13,672. The instrument did not grey out — it printed a
 * confident near-zero delta across a 37% decline in indexed surface, which is
 * the failure this project keeps paying for: a partial measurement must not
 * render as a pass.
 *
 * Three days is past any same-day or next-day re-run, well short of the 7-day
 * cadence, and the same number STALE_REPORT_DAYS already uses. A send that
 * genuinely lands 2 days after another skips it and compares against the week
 * before — a couple of days stale, but honest, which "WoW" cannot be against a
 * 2-day-old row.
 */
export const BASELINE_MIN_AGE_HOURS = 72;

/** A stored run offered as a WoW baseline: how old it is, and what it recorded. */
export type BaselineRow = { age_seconds: number; totals: unknown };

/**
 * The newest stored run old enough to be last week's baseline, or null.
 *
 * Pure, and the SINGLE definition of the rule: the three aux reads in
 * `lib/ops-inputs.ts` — engagement totals, sitemap URLs, GSC impressions — all
 * come through here. Three copies of one query is exactly how those three
 * baselines came to report the same lie independently.
 *
 * `rows` must be newest-first. A row old enough but whose totals do not parse is
 * SKIPPED in favour of an older good one rather than ending the search: the
 * double-stringified rows parseStoredTotals describes would otherwise pin the
 * report to "first report" forever.
 *
 * Null is the honest answer, not a defect — wowLabel renders it "first report"
 * and the sections add "last baseline unreadable".
 */
export function baselineSeries(
  rows: readonly BaselineRow[],
  minAgeSeconds: number = BASELINE_MIN_AGE_HOURS * 3600,
): Record<string, number>[] {
  const out: Record<string, number>[] = [];
  for (const row of rows) {
    if (!Number.isFinite(row.age_seconds) || row.age_seconds < minAgeSeconds) continue;
    const totals = parseStoredTotals(row.totals);
    if (totals) out.push(totals);
  }
  return out;
}

/** The newest usable baseline — `baselineSeries`' first entry. See above. */
export function pickBaseline(
  rows: readonly BaselineRow[],
  minAgeSeconds: number = BASELINE_MIN_AGE_HOURS * 3600,
): Record<string, number> | null {
  return baselineSeries(rows, minAgeSeconds)[0] ?? null;
}

/**
 * When a falling number stops being a bad week and starts being a problem.
 *
 * **Calibrated against the 16 weeks of stored runs, not chosen.** The guard
 * shipped on 3 Nov 2026 made the WoW figures honest; nothing escalated them, so
 * views could read -55% in black text. A plain WoW threshold is the obvious fix
 * and it is the wrong one, in both directions:
 *
 *   - At -50% it would have fired 3 times in 16 weeks on views and ticket
 *     clicks, every one of them seasonal (a Halloween ramp, a one-week
 *     Restaurant Week listing). An alarm that cries wolf gets ignored, and this
 *     email has one reader.
 *   - It would have stayed SILENT through the whole decline that prompted it.
 *     The sitemap fell 2,242 → 1,409 URLs between 7 Sep and 2 Nov and never
 *     once dropped more than 11% in a single week.
 *
 * So two rules, each measured:
 *
 * `cliffPct` **-80%**: fires 0 times in the whole stored history across all four
 * metrics (steepest real weekly drops: views -56%, ticket clicks -70%, sitemap
 * -11%, impressions -35%). A fall that steep is an instrument dying, not a
 * quiet week — which is why its wording points at the instrument first.
 *
 * `slideWeeks` **4**: views have never fallen more than 2 weeks running and
 * ticket clicks never more than 1, in 16 weeks — so four consecutive declines
 * cannot be noise on those. The sitemap ran 6 down weeks (7 Sep → 19 Oct) and
 * impressions 4 (14 Sep → 12 Oct), so this rule would have raised the sitemap
 * on the 5 Oct send — five weeks before anyone noticed by hand.
 *
 * `windowWeeks`/`windowPct` **8 weeks, -25%**, and OPT-IN — the `window` option,
 * which only the Index surface passes. A streak resets on one good week: the
 * sitemap's 6-week slide was broken by a single +1% week on 26 Oct, so on 2 Nov
 * the streak rule read 1 while the surface was still down 37% from 7 Sep. The
 * cumulative rule catches that. It is opt-in because it CANNOT be applied to
 * views or ticket clicks: measured over the same history it fires on those
 * today at -63% and -61%, which is the Halloween calendar emptying, not a
 * defect. Our own published surface has no such excuse — a sitemap that loses a
 * quarter of its URLs in two months is a supply problem in any season. On the
 * structural pair it fires 3 of 7 readable weeks (sitemap) and 1 of 4
 * (impressions), every one of them real.
 */
export const DECLINE = {
  /** One week this steep: suspect the instrument before the business. */
  cliffPct: -80,
  /** Consecutive down weeks that make a trend rather than seasonality. */
  slideWeeks: 4,
  /** Opt-in cumulative rule, for structural surfaces only. */
  windowWeeks: 8,
  windowPct: -25,
} as const;

/**
 * How many stored rows the gather must read to feed every rule above.
 *
 * The window rule needs `windowWeeks + 1` USABLE rows, and usable excludes
 * today's own send (too new for BASELINE_MIN_AGE_HOURS) plus any row whose
 * totals do not parse. A `limit` of exactly the window silently starves it: on
 * 3 Nov a read of 8 returned 7 usable rows, one short, and the sitemap's -37%
 * would have gone unreported by the very rule written for it. Derived rather
 * than typed so raising `windowWeeks` cannot reintroduce that.
 */
export const BASELINE_READ_ROWS = DECLINE.windowWeeks + 8;

/**
 * Why `label` looks like it is falling, or null. Pure.
 *
 * `series` is newest-first and element 0 is THIS run's live number, so the
 * caller passes `[live, ...storedWeeks]`. Reading stops at the first value that
 * is not a finite number: a gap in the history is not a decline, and judging
 * past it would compare across a hole. Fewer than two readable numbers is
 * silence, which is also what a first run and a failed baseline read produce.
 *
 * `window` adds the cumulative rule, and belongs only to surfaces we publish
 * ourselves — see DECLINE. The most acute finding wins: a cliff outranks a
 * slide, a slide outranks a two-month drift.
 */
export function declineReason(
  label: string,
  series: readonly (number | null | undefined)[],
  opts: { window?: boolean } = {},
): string | null {
  const nums: number[] = [];
  for (const v of series) {
    if (typeof v !== "number" || !Number.isFinite(v)) break;
    nums.push(v);
  }
  if (nums.length < 2) return null;
  const pct = (cur: number, prev: number): number | null =>
    prev === 0 ? null : Math.round(((cur - prev) / prev) * 100);

  const week = pct(nums[0], nums[1]);
  if (week !== null && week <= DECLINE.cliffPct) {
    return `${label} fell ${Math.abs(week)}% in one week (${nums[1]} → ${nums[0]}) — check the instrument before the business`;
  }

  let down = 0;
  while (down + 1 < nums.length && nums[down] < nums[down + 1]) down++;
  if (down >= DECLINE.slideWeeks) {
    const total = pct(nums[0], nums[down]);
    return `${label} has fallen ${down} weeks running, ${nums[down]} → ${nums[0]}${total === null ? "" : ` (${total}%)`}`;
  }

  if (opts.window && nums.length > DECLINE.windowWeeks) {
    const then = nums[DECLINE.windowWeeks];
    const over = pct(nums[0], then);
    if (over !== null && over <= DECLINE.windowPct) {
      return `${label} is down ${Math.abs(over)}% over ${DECLINE.windowWeeks} weeks, ${then} → ${nums[0]}`;
    }
  }
  return null;
}

/** "+18%" / "-7%" / "±0%" / "first report" for week-over-week deltas. */
export function wowLabel(current: number, prev: number | null): string {
  if (prev === null) return "first report";
  if (prev === 0) return current > 0 ? "new" : "±0%";
  const pct = Math.round(((current - prev) / prev) * 100);
  return pct === 0 ? "±0%" : `${pct > 0 ? "+" : ""}${pct}% WoW`;
}

function fmtDuration(startIso: string, endIso: string): string {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "?";
  const m = Math.floor(ms / 60000);
  const s = Math.round((ms % 60000) / 1000);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function buildSections(inputs: OpsInputs, now: Date = new Date()): OpsSection[] {
  const out: OpsSection[] = [];
  const err = (k: string) => inputs.errors[k];

  // 1 — Pipeline
  {
    let lines: string[];
    let alert = false;
    if (err("pipeline")) {
      lines = unavailable(err("pipeline"));
      alert = true;
    } else if (!inputs.pipeline) {
      lines = ["no pipeline runs recorded yet"];
      alert = true;
    } else {
      const p = inputs.pipeline;
      if (p.finished_at === null) {
        lines = [
          `⚠️ last run KILLED/INCOMPLETE — started ${p.started_at}, never finalized`,
          "check the Actions log; the run died without writing its own failure",
        ];
        alert = true;
      } else if (!p.ok) {
        lines = [
          `⚠️ last run FAILED — ${p.error ?? "no error recorded"}`,
          `started ${p.started_at} · duration ${fmtDuration(p.started_at, p.finished_at)}`,
        ];
        alert = true;
      } else {
        // F2.6 — per-stage counts WITH diffs vs the previous run. deltaTag
        // shows nothing until a stage has a prior number, so brand-new metrics
        // (collapsed_runs on historical rows) stay quiet rather than lying.
        const pv = inputs.prevPipeline;
        const stage = (label: string, cur: number | null, prev: number | null | undefined) =>
          `${cur ?? 0} ${label}${deltaTag(cur, prev)}`;
        lines = [
          `ok ✓ — ${stage("upserted", p.upserted, pv?.upserted)} · ${stage("deduped", p.collapsed, pv?.collapsed)} · ${stage("collapsed", p.collapsed_runs, pv?.collapsed_runs)} · ${stage("archived", p.archived, pv?.archived)}`,
          `started ${p.started_at} · duration ${fmtDuration(p.started_at, p.finished_at)}${pv ? " · Δ vs last run" : ""}`,
          ...(p.unnamed_dropped
            ? [`${stage("listings dropped for naming no event", p.unnamed_dropped, pv?.unnamed_dropped)} — the agents guessed that often`]
            : []),
        ];
        // Stampede tripwire — spike vs the MEDIAN of recent runs, not a fixed
        // number and not a single (possibly noisy) prior run.
        const reason = stampedeReason(
          p.archived ?? 0,
          p.collapsed ?? 0,
          inputs.recentPipeline.map((r) => r.archived ?? 0),
          inputs.recentPipeline.map((r) => r.collapsed ?? 0),
        );
        if (reason) {
          lines.push(`⚠️ stampede check — ${reason}`);
          alert = true;
        }
      }
    }
    out.push({ title: "Pipeline", lines, alert });
  }

  // 2 — Coverage
  {
    let lines: string[];
    let alert = false;
    if (err("coverage")) {
      lines = unavailable(err("coverage"));
      alert = true;
    } else {
      lines = inputs.coverageAlerts;
      alert = !inputs.coverageHealthy;
    }
    out.push({ title: "Coverage", lines, alert });
  }

  // 3 — Verification
  {
    let lines: string[];
    let alert = false;
    if (err("verify")) {
      lines = unavailable(err("verify"));
      alert = true;
    } else {
      const v = judgeVerification(inputs.verify.verified7, inputs.verify.neverVerifiedUpcoming);
      lines = v.lines;
      alert = v.alert;
    }
    out.push({ title: "Verification", lines, alert });
  }

  // 3b — Source check. Its own section rather than a line under Verification:
  // the two fail independently (the verify pass runs twice a week from two
  // different workflows; the sweep is the last step of a third), and a dead
  // instrument folded into a healthy section's prose is how four weeks of
  // silence went unread the first time.
  {
    let lines: string[];
    let alert = false;
    if (err("source_sweep") || !inputs.sourceSweep) {
      lines = unavailable(err("source_sweep") ?? "the source-check health read returned nothing");
      alert = true;
    } else {
      const v = judgeSourceSweep(inputs.sourceSweep, SOURCE_SWEEP_SCHEDULE, now);
      lines = v.lines;
      // `unknown` alerts. "We could not tell" is never green — the rule the
      // vendor tiles already enforce, and the reason this section exists.
      alert = v.status !== "ok";
    }
    out.push({ title: "Source check", lines, alert });
  }

  // 4 — Engagement (with WoW)
  {
    let lines: string[];
    let alert = false;
    if (err("engagement")) {
      lines = unavailable(err("engagement"));
      alert = true;
    } else {
      const t = inputs.engagement.totals;
      const p = inputs.prevTotals;
      lines = [
        `views ${t.view} (${wowLabel(t.view, p?.view ?? null)}) · ticket clicks ${t.ticket_click} (${wowLabel(t.ticket_click, p?.ticket_click ?? null)})`,
        `saves ${t.save} (${wowLabel(t.save, p?.save ?? null)}) · calendar adds ${t.calendar} (${wowLabel(t.calendar, p?.calendar ?? null)})`,
      ];
      const top = inputs.engagement.top[0];
      if (top) lines.push(`most viewed: ${top.title}`);
      // The WoW numbers became honest on 3 Nov 2026 and still escalated
      // nothing, so a halved week printed in black. Neither of these has ever
      // fallen 4 weeks running in the stored history — see DECLINE.
      const falling = [
        declineReason("views", [t.view, ...inputs.prevSeries.map((p) => p.view)]),
        declineReason("ticket clicks", [t.ticket_click, ...inputs.prevSeries.map((p) => p.ticket_click)]),
      ].filter((r): r is string => r !== null);
      if (falling.length > 0) {
        lines.push(...falling);
        alert = true;
      }
      if (err("engagement_prev")) lines.push("(last baseline unreadable — WoW shown as first report)");
    }
    out.push({ title: "Engagement (7d)", lines, alert });
  }

  // 5 — Trending
  {
    let lines: string[];
    let alert = false;
    if (err("trending")) {
      lines = unavailable(err("trending"));
      alert = true;
    } else if (inputs.trending.count === 0) {
      lines = ["dark — below the all-or-nothing minimum (expected while stats accumulate)"];
    } else {
      lines = [
        `lit ✓ — ${inputs.trending.count} events trending`,
        ...inputs.trending.top.slice(0, 3).map((t, i) => `${i + 1}. ${t}`),
      ];
    }
    out.push({ title: "Trending", lines, alert });
  }

  // 6 — Index surface (roadmap 3.1). Supply side (sitemap URL count) is
  // measured automatically; the demand side is impressions — automated by F2.4
  // when the GSC service account is wired, else the manual-glance line.
  {
    let lines: string[];
    let alert = false;
    if (err("index")) {
      lines = unavailable(err("index"));
      alert = true;
    } else if (inputs.sitemapUrls === null) {
      lines = ["sitemap not fetched (SITE_URL unset?)"];
      alert = true;
    } else {
      lines = [
        `${inputs.sitemapUrls} URLs in the live sitemap (${wowLabel(inputs.sitemapUrls, inputs.prevSitemapUrls)})`,
      ];
      if (inputs.search) {
        // F2.4 — the demand number reads itself. Indexed count stays manual
        // (not a bulk API read), so the glance line still points at it.
        const s = inputs.search;
        lines.push(
          `${s.impressions} GSC impressions · ${s.clicks} clicks (7d) (${wowLabel(s.impressions, inputs.prevSearchImpressions)})`,
          "indexed count: check GSC Pages (not API-exposed)",
        );
      } else {
        lines.push("demand side: check GSC Pages + Performance for indexed count & impressions");
      }
      // The slide rule exists for this section: the sitemap lost 37% of its
      // URLs over eight weeks without one week ever dropping more than 11%.
      const falling = [
        declineReason(
          "the sitemap",
          [inputs.sitemapUrls, ...inputs.prevSeries.map((p) => p.sitemap_urls)],
          { window: true },
        ),
        inputs.search
          ? declineReason(
              "GSC impressions",
              [inputs.search.impressions, ...inputs.prevSeries.map((p) => p.search_impressions)],
              { window: true },
            )
          : null,
      ].filter((r): r is string => r !== null);
      if (falling.length > 0) {
        lines.push(...falling);
        alert = true;
      }
      if (err("index_prev")) lines.push("(last count unreadable — WoW shown as first report)");
    }
    out.push({ title: "Index surface", lines, alert });
  }

  // 7 — Subscribers
  {
    let lines: string[];
    let alert = false;
    if (err("subscribers")) {
      lines = unavailable(err("subscribers"));
      alert = true;
    } else {
      const s = inputs.subscribers;
      lines = [`${s.total} subscribed (${s.delta7 >= 0 ? "+" : ""}${s.delta7} last 7 days)`];
      if (s.bySource7 && s.bySource7.length > 0) {
        lines.push(`new by placement: ${s.bySource7.map((r) => `${r.source} ${r.count}`).join(" · ")}`);
      }
      if (inputs.lastDigestNote) lines.push(`last digest: ${inputs.lastDigestNote}`);
      else if (err("digest_note")) lines.push("(last digest note unavailable)");

      // Did the weekly email actually go out? A note alone can't answer that —
      // it keeps rendering the previous send's text after a miss.
      const age = inputs.lastDigestDaysAgo;
      if (err("digest_age")) {
        lines.push("(digest age unreadable — could not check for a missed send)");
      } else if (age === null) {
        lines.push("no successful digest send recorded yet");
      } else if (age >= DIGEST_STALE_DAYS) {
        lines.push(
          `last successful send was ${age} days ago — a Thursday send was MISSED (check the Weekly Email Digest workflow)`,
        );
        alert = true;
      } else {
        // Print the age even when it's healthy. Saying nothing on a good week is
        // what made the Aug 6 miss invisible: an absent line reads exactly like an
        // absent check. One short line keeps the instrument visibly alive.
        lines.push(`last successful send: ${age} day${age === 1 ? "" : "s"} ago`);
      }
    }
    out.push({ title: "Subscribers", lines, alert });
  }

  // 8 — Feeds (F2.5). Zero clicks is NOT an alert — the feeds are new and
  // adoption is a slow signal (honest emptiness, like dark trending). This
  // line is what tells us whether the public API (6.2) ever earns building.
  {
    let lines: string[];
    let alert = false;
    if (err("feeds")) {
      lines = unavailable(err("feeds"));
      alert = true;
    } else if (inputs.feeds.clicks7 === 0) {
      lines = ["no calendar-subscribe clicks in the last 7 days (feeds are new)"];
    } else {
      const c = inputs.feeds.clicks7;
      lines = [
        `${c} calendar-subscribe click${c === 1 ? "" : "s"} (7d)`,
        ...inputs.feeds.top.slice(0, 3).map((t) => `${t.label}: ${t.count}`),
      ];
    }
    out.push({ title: "Feeds", lines, alert });
  }

  // 9 — Queue: what's waiting on a person. An empty queue is the NORMAL state,
  // so a zero here is never an alert (that would destroy the subject-line alert
  // signal every quiet week). The one thing that IS an alert: a report left
  // sitting, because a cancelled event still showing on the site is exactly the
  // honest-data failure this project exists to avoid.
  {
    let lines: string[];
    let alert = false;
    if (err("queue")) {
      lines = unavailable(err("queue"));
      alert = true;
    } else {
      const { submissions, reports, oldestReportDays } = inputs.queue;
      if (
        submissions === 0 &&
        reports === 0 &&
        inputs.queue.musicReview === 0 &&
        inputs.queue.verifyFlags === 0
      ) {
        lines = ["nothing waiting — no open submissions or reports"];
      } else {
        lines = [];
        if (submissions > 0) {
          lines.push(`${submissions} submission${submissions === 1 ? "" : "s"} awaiting review → /admin/submissions`);
        }
        if (reports > 0) {
          lines.push(`${reports} listing report${reports === 1 ? "" : "s"} awaiting review → /admin/reports`);
        }
        if (inputs.queue.musicReview > 0) {
          lines.push(
            `${inputs.queue.musicReview} music listing${inputs.queue.musicReview === 1 ? "" : "s"} a venue calendar disagrees with → /admin/events`,
          );
        }
        if (inputs.queue.verifyFlags > 0) {
          lines.push(
            `${inputs.queue.verifyFlags} listing${inputs.queue.verifyFlags === 1 ? "" : "s"} the verify pass flagged, still live → /admin/events`,
          );
          for (const ex of inputs.queue.verifyFlagExamples) lines.push(`    ${ex}`);
          // An alert, because these are listings our own pass doubts that are
          // still on the site. The Marley listing was never flagged at all —
          // it was CONFIRMED — but had it been flagged, this is the line that
          // would have carried it.
          alert = true;
        }
        if (oldestReportDays !== null && oldestReportDays >= STALE_REPORT_DAYS) {
          lines.push(`oldest report is ${oldestReportDays} days old — a cancelled event may still be live`);
          alert = true;
        }
      }
    }
    out.push({ title: "Queue", lines, alert });
  }

  // 9b — Reports, with the automated check attached (Sep 2026).
  //
  // The Queue section above counts reports; this one says what each of them
  // actually is, whether the check backs the reporter, and gives the two
  // buttons. It exists because a count is not actionable: the Marley/Fillmore
  // report sat as "1 listing report awaiting review" while a listing nobody
  // could stand behind was live on the site.
  //
  // Only rendered when something is pending — an empty section every week is
  // noise, and the Queue line already says "nothing waiting".
  if (inputs.reports && inputs.reports.length > 0) {
    const supported = inputs.reports.filter((r) => r.verdict === "supported").length;
    const lines = [
      supported > 0
        ? `${supported} of ${inputs.reports.length} checked report${inputs.reports.length === 1 ? "" : "s"} look${supported === 1 ? "s" : ""} like a real problem`
        : `${inputs.reports.length} open report${inputs.reports.length === 1 ? "" : "s"}, none confirmed wrong by the check`,
    ];
    out.push({
      title: "Reports",
      lines,
      alert: supported > 0,
      items: inputs.reports.map((r) => ({
        lines: [
          `${r.title} — ${r.venue} · ${r.start}`,
          `Reader (${r.kind}): ${r.reason}`,
          r.verdictLine,
        ].filter(Boolean),
        actions: r.actions,
      })),
    });
  }

  // 10 — Self-check: where the calendar contradicts itself. The only section
  // here that needs no outside source, which is why it exists — five categories
  // have none. A CONFLICT alerts (two different things in one room at one time
  // means the site is publishing something false); duplicates and placeholder
  // venues are reported without alerting.
  //
  // A DUPLICATE NOW ALERTS TOO, and the old reason for not alerting — "untidy
  // rather than untrue" — was wrong. When BOTH rows of a duplicate pair are live,
  // each one blocks the other's weekly re-find: withoutLiveDuplicates excludes
  // an incoming row from comparison with ITSELF by event_key, but not with its
  // twin, and findIncomingDuplicates then refuses the arrival
  // (lib/upsert.ts withoutLiveDuplicates, lib/contradictions.ts pass 1). So a
  // cancellation or a time change on either row can never reach the site.
  // Measured 29 Oct 2026: two live rows in exactly that state, one pair at the
  // Minnesota Children's Museum on 1 Nov, last re-found 19 and 26 October.
  // That is untrue, not untidy, and it was the quietest line in the email.
  {
    let lines: string[];
    let alert = false;
    if (err("contradictions")) {
      lines = unavailable(err("contradictions"));
      alert = true;
    } else {
      const {
        conflicts, duplicates, placeholderVenues, placeholderTitles,
        examples, dupExamples, titleExamples,
      } = inputs.contradictions;
      if (conflicts === 0 && duplicates === 0 && placeholderVenues === 0 && placeholderTitles === 0) {
        lines = ["the calendar does not contradict itself anywhere"];
      } else {
        lines = [];
        if (conflicts > 0) {
          lines.push(
            `${conflicts} clash${conflicts === 1 ? "" : "es"} — one room, one time, two different events`,
          );
          lines.push(...examples.map((e) => `    ${e}`));
          alert = true;
        }
        if (duplicates > 0) {
          lines.push(
            `${duplicates} probable duplicate${duplicates === 1 ? "" : "s"} — same event listed twice, ` +
              "and while both are live neither can be updated",
          );
          lines.push(...dupExamples.map((e) => `    ${e}`));
          alert = true;
        }
        if (placeholderTitles > 0) {
          lines.push(
            `${placeholderTitles} listing${placeholderTitles === 1 ? "" : "s"} whose TITLE names no event`,
          );
          lines.push(...titleExamples.map((e) => `    ${e}`));
        }
        if (placeholderVenues > 0) {
          lines.push(`${placeholderVenues} listing${placeholderVenues === 1 ? "" : "s"} whose venue names no place ("TBD")`);
        }
      }
    }
    out.push({ title: "Self-check", lines, alert });
  }

  return out;
}

/**
 * Whether the verification story is worth waking up for.
 *
 * This section used to raise a flag ONLY when its own read failed. It printed
 * two numbers and judged neither — which made a dying verify pass read as
 * good news, twice over: verified7 falls to zero, and with nothing checking
 * anything the flag queue stops growing, so the Queue section calms down too.
 * The email would have read all-green through a month of silence.
 *
 * The pass runs TWICE a week (Mondays via verify-events.yml, Thursdays as a
 * step inside weekly-digest.yml). Seven days with nothing re-verified is not
 * a quiet week; it means it did not run, or ran and produced nothing.
 */
export function judgeVerification(
  verified7: number,
  neverVerifiedUpcoming: number,
): { lines: string[]; alert: boolean } {
  const dead = !Number.isFinite(verified7) || verified7 <= 0;
  return {
    alert: dead,
    lines: [
      dead
        ? "NOTHING re-verified in the last 7 days — the pass runs twice weekly, so it did not run or returned nothing"
        : `${verified7} events re-verified against sources in the last 7 days`,
      `${neverVerifiedUpcoming} upcoming events have never been verified`,
    ],
  };
}

export function composeOpsDigest(
  inputs: OpsInputs,
  now: Date,
): { subject: string; html: string; text: string } {
  const sections = buildSections(inputs, now);
  const alerts = sections.filter((s) => s.alert).length;
  const dateLabel = now.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "America/Chicago",
  });
  const subject =
    alerts === 0
      ? `✅ City Pulse ops — all green (${dateLabel})`
      : `⚠️ City Pulse ops — ${alerts} alert${alerts > 1 ? "s" : ""} (${dateLabel})`;

  const text = sections
    .map((s) => {
      const head = `## ${s.title}${s.alert ? " ⚠️" : ""}\n${s.lines.map((l) => `- ${l}`).join("\n")}`;
      if (!s.items?.length) return head;
      const items = s.items
        .map((it) =>
          [
            ...it.lines.map((l) => `  ${l}`),
            ...(it.actions ?? []).map((a) => `  ${a.label}: ${a.href}`),
          ].join("\n"),
        )
        .join("\n\n");
      return `${head}\n\n${items}`;
    })
    .join("\n\n");

  const html = `<!doctype html><html><head>${EMAIL_HEAD}</head><body style="margin:0;padding:24px;background:#0d1526;font-family:Georgia,serif;color:#f2ecdd;">
<div style="max-width:560px;margin:0 auto;">
<h1 style="font-size:18px;letter-spacing:0.06em;color:#c9a961;margin:0 0 4px;">CITY PULSE — OPS</h1>
<p style="margin:0 0 20px;font-size:13px;color:#9aa3b5;">${esc(dateLabel)} · ${alerts === 0 ? "all green" : `${alerts} alert${alerts > 1 ? "s" : ""}`}</p>
${sections
  .map(
    (s) => `<div style="margin:0 0 16px;padding:12px 16px;border:1px solid ${s.alert ? "#a05c3b" : "#2a3550"};border-radius:10px;background:#131d33;">
<div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:${s.alert ? "#e0b070" : "#c9a961"};margin:0 0 6px;">${esc(s.title)}${s.alert ? " ⚠️" : ""}</div>
${s.lines.map((l) => `<div style="font-size:13.5px;line-height:1.55;">${esc(l)}</div>`).join("")}
${(s.items ?? [])
  .map(
    (it) => `<div style="margin:10px 0 0;padding:10px 12px;border:1px solid #2a3550;border-radius:8px;background:#0f1729;">
${it.lines.map((l) => `<div style="font-size:13px;line-height:1.5;">${esc(l)}</div>`).join("")}
${
  it.actions?.length
    ? `<div style="margin-top:9px;">${it.actions
        .map(
          (a) =>
            `<a href="${esc(a.href)}" style="display:inline-block;padding:10px 15px;margin:0 7px 6px 0;border-radius:8px;text-decoration:none;font-size:13px;background:${a.danger ? "#a05c3b" : "#c9a961"};color:${a.danger ? "#ffffff" : "#0d1526"};">${esc(a.label)}</a>`,
        )
        .join("")}</div>`
    : ""
}
</div>`,
  )
  .join("")}
</div>`,
  )
  .join("")}
<p style="font-size:11.5px;color:#707a8d;">Sent by the ops-digest workflow after the weekly pipeline run.</p>
</div></body></html>`;

  return { subject, html, text };
}

export { SECTION_KEYS };
