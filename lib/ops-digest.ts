import type { Engagement } from "./stats";
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
  engagement: Engagement;
  prevTotals: Engagement["totals"] | null; // last ops_digest_runs row, or null on first run
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
    /** A few placeholder titles, so the line is actionable rather than a count. */
    titleExamples: string[];
  };
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

export interface OpsSection {
  title: string;
  lines: string[];
  alert: boolean;
}

const SECTION_KEYS = [
  "pipeline",
  "coverage",
  "verify",
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

export function buildSections(inputs: OpsInputs): OpsSection[] {
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
      const v = inputs.verify;
      lines = [
        `${v.verified7} events re-verified against sources in the last 7 days`,
        `${v.neverVerifiedUpcoming} upcoming events have never been verified`,
      ];
    }
    out.push({ title: "Verification", lines, alert });
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
      if (submissions === 0 && reports === 0 && inputs.queue.musicReview === 0) {
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
        if (oldestReportDays !== null && oldestReportDays >= STALE_REPORT_DAYS) {
          lines.push(`oldest report is ${oldestReportDays} days old — a cancelled event may still be live`);
          alert = true;
        }
      }
    }
    out.push({ title: "Queue", lines, alert });
  }

  // 10 — Self-check: where the calendar contradicts itself. The only section
  // here that needs no outside source, which is why it exists — five categories
  // have none. A CONFLICT alerts (two different things in one room at one time
  // means the site is publishing something false); duplicates and placeholder
  // venues are reported without alerting, because they are untidy rather than
  // untrue.
  {
    let lines: string[];
    let alert = false;
    if (err("contradictions")) {
      lines = unavailable(err("contradictions"));
      alert = true;
    } else {
      const {
        conflicts, duplicates, placeholderVenues, placeholderTitles, examples, titleExamples,
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
          lines.push(`${duplicates} probable duplicate${duplicates === 1 ? "" : "s"} — same event listed twice`);
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

export function composeOpsDigest(
  inputs: OpsInputs,
  now: Date,
): { subject: string; html: string; text: string } {
  const sections = buildSections(inputs);
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
    .map((s) => `## ${s.title}${s.alert ? " ⚠️" : ""}\n${s.lines.map((l) => `- ${l}`).join("\n")}`)
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
</div>`,
  )
  .join("")}
<p style="font-size:11.5px;color:#707a8d;">Sent by the ops-digest workflow after the weekly pipeline run.</p>
</div></body></html>`;

  return { subject, html, text };
}

export { SECTION_KEYS };
