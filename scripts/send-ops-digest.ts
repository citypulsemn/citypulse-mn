/**
 * Ops digest sender (roadmap 2.1). Gather → compose → send → record baseline.
 *
 * THE RESILIENCE CONTRACT: every gather is independently caught; a failed
 * source becomes an "unavailable" section, never a dead email. The one thing
 * that fails LOUDLY is the send itself (exit 1) — per the 5.4 lesson, infra
 * failures are reported honestly, not swallowed.
 *
 * Usage: npm run ops-digest [-- --dry-run]
 */
import { sql } from "../lib/db";
import { composeOpsDigest, type OpsInputs, type PipelineRow } from "../lib/ops-digest";
import { assessCoverage, formatCoverageAlerts } from "../lib/coverage";
import { getEngagement } from "../lib/stats";
import { getTrendingEvents } from "../lib/trending";
import { getDigestSends } from "../lib/digest-send";

const dryRun = process.argv.includes("--dry-run");

async function gather(): Promise<OpsInputs> {
  const errors: Record<string, string> = {};
  const wrap = async <T>(key: string, fallback: T, fn: () => Promise<T>): Promise<T> => {
    try {
      return await fn();
    } catch (err) {
      errors[key] = err instanceof Error ? err.message : String(err);
      return fallback;
    }
  };

  const pipeline = await wrap<PipelineRow | null>("pipeline", null, async () => {
    if (!sql) throw new Error("no database connection");
    const rows = await sql<PipelineRow[]>`
      select to_char(started_at at time zone 'America/Chicago', 'YYYY-MM-DD HH24:MI') as started_at,
             to_char(finished_at at time zone 'America/Chicago', 'YYYY-MM-DD HH24:MI') as finished_at,
             ok, upserted, cancelled, archived, collapsed, error
      from pipeline_runs order by started_at desc limit 1`;
    return rows[0] ?? null;
  });

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

  const engagement = await getEngagement(7); // carries its own never-break contract

  const prevTotals = await wrap<OpsInputs["prevTotals"]>("engagement", null, async () => {
    if (!sql) throw new Error("no database connection");
    const rows = await sql<{ totals: OpsInputs["prevTotals"] }[]>`
      select totals from ops_digest_runs order by sent_at desc limit 1`;
    return rows[0]?.totals ?? null;
  });

  const trending = await wrap("trending", { count: 0, top: [] as string[] }, async () => {
    const ranked = await getTrendingEvents();
    return { count: ranked.length, top: ranked.slice(0, 3).map((r) => r.event.title) };
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

  const lastDigestNote = await wrap<string | null>("subscribers", null, async () => {
    const sends = await getDigestSends(1);
    return sends[0]?.note ?? null;
  });

  const sitemapUrls = await wrap<number | null>("index", null, async () => {
    const base = process.env.SITE_URL;
    if (!base) return null;
    const res = await fetch(`${base.replace(/\/$/, "")}/sitemap.xml`);
    if (!res.ok) throw new Error(`sitemap fetch ${res.status}`);
    const xml = await res.text();
    return (xml.match(/<loc>/g) ?? []).length;
  });

  const prevSitemapUrls = await wrap<number | null>("index", null, async () => {
    if (!sql) throw new Error("no database connection");
    const rows = await sql<{ totals: { sitemap_urls?: number } }[]>`
      select totals from ops_digest_runs order by sent_at desc limit 1`;
    return rows[0]?.totals?.sitemap_urls ?? null;
  });

  return {
    pipeline,
    coverageHealthy: coverage.healthy,
    coverageAlerts: coverage.alerts,
    verify,
    engagement,
    prevTotals,
    trending,
    subscribers,
    lastDigestNote,
    sitemapUrls,
    prevSitemapUrls,
    errors,
  };
}

async function main() {
  const inputs = await gather();
  const { subject, html, text } = composeOpsDigest(inputs, new Date());

  console.log(`[ops-digest] ${subject}`);
  console.log(text);

  if (dryRun) {
    console.log("[ops-digest] dry run — not sending, not recording");
    return;
  }

  const to = process.env.OPS_DIGEST_TO;
  const key = process.env.RESEND_API_KEY;
  const from = process.env.DIGEST_FROM;
  if (!to || !key || !from) {
    console.error("[ops-digest] missing OPS_DIGEST_TO / RESEND_API_KEY / DIGEST_FROM");
    process.exit(1);
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html, text }),
  });
  if (!res.ok) {
    console.error(`[ops-digest] send FAILED: ${res.status} ${await res.text()}`);
    process.exit(1); // loud, per the 5.4 lesson
  }
  console.log("[ops-digest] sent ✓");

  if (sql) {
    try {
      // Baseline for next week's WoW: engagement totals + sitemap size in one
      // jsonb (additive key — old rows without sitemap_urls read as null,
      // which wowLabel renders as "first report").
      const baseline = { ...inputs.engagement.totals, sitemap_urls: inputs.sitemapUrls ?? undefined };
      await sql`insert into ops_digest_runs (totals) values (${JSON.stringify(baseline)}::jsonb)`;
      console.log("[ops-digest] WoW baseline recorded");
    } catch (err) {
      console.error("[ops-digest] baseline record failed (email already sent):", err);
    }
  }
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
