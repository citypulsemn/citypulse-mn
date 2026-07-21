import type { Engagement } from "./stats";
import { esc } from "./digest";

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
  collapsed: number | null;
  error: string | null;
}

export interface OpsInputs {
  pipeline: PipelineRow | null;
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
  /** Live sitemap URL count (fetched from SITE_URL/sitemap.xml — the number
   *  Google actually sees; zero drift by construction) + last week's. */
  sitemapUrls: number | null;
  prevSitemapUrls: number | null;
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
] as const;

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
        lines = [
          `ok ✓ — ${p.upserted ?? 0} upserted · ${p.cancelled ?? 0} cancelled · ${p.archived ?? 0} archived · ${p.collapsed ?? 0} collapsed`,
          `started ${p.started_at} · duration ${fmtDuration(p.started_at, p.finished_at)}`,
        ];
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

  // 6 — Index surface (roadmap 3.1: the supply side of the indexing loop,
  // measured automatically; the demand side — indexed count, impressions —
  // is your weekly GSC glance, per the loop's manual-first design)
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
        "demand side: check GSC Pages + Performance for indexed count & impressions",
      ];
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
    }
    out.push({ title: "Subscribers", lines, alert });
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

  const html = `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:24px;background:#0d1526;font-family:Georgia,serif;color:#f2ecdd;">
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
