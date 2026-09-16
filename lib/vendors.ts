/**
 * The probes. One per outside service, each answering "is this still working?"
 *
 * CONTRACT, and it is the whole design:
 *   1. A probe NEVER throws. `gatherVendorTiles` must not be able to 500 the
 *      admin page it decorates (rule 1 — the instrument must not kill the
 *      panel).
 *   2. A probe that cannot run returns `unknown`, never `ok`. No token, a 500
 *      from the vendor, a timeout, an unrecognised response shape — all of them
 *      say so on the tile. Green means observed, never assumed.
 *   3. Every token is read with `envValue`, not `??`. An unset GitHub Actions
 *      secret arrives as `""`, and `""` is not nullish — that exact shape kept
 *      an alert email from sending for days in Sep 2026.
 *
 * WHAT IS AND IS NOT REACHABLE. Checked against the vendors' current APIs on
 * 13 Sep 2026, because promising a metric we cannot actually fetch would be the
 * same sin as a listing we cannot source:
 *   - Vercel publishes cost, not a CPU-vs-limit gauge: `/v1/billing/charges`
 *     (FOCUS v1.3, JSONL). So the tile tracks month-to-date spend and the last
 *     deployment, which is what is genuinely observable.
 *   - Supabase has no clean egress endpoint. Database size, though, comes free
 *     from the connection we already hold, so that tile needs no token at all.
 *   - GitHub and Resend both answer plainly.
 */
import { envValue } from "./env";
import { sql } from "./db";
import { getDigestHealth } from "./digest-send";
import { DIGEST_STALE_DAYS } from "./ops-digest";
import {
  judgeCron,
  judgeUsage,
  judgeDelivery,
  judgeDigest,
  unknownTile,
  formatBytes,
  formatDuration,
  type VendorTile,
} from "./vendor-health";

/** Nothing here may hang the page. */
const TIMEOUT_MS = 6000;

async function getJson(url: string, headers: Record<string, string>): Promise<unknown> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers, signal: ctl.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

const rec = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const reason = (err: unknown): string => {
  const m = err instanceof Error ? err.message : String(err);
  return m.includes("abort") ? `no answer in ${TIMEOUT_MS / 1000}s` : m.slice(0, 120);
};

/* ------------------------------------------------------------------ GitHub */

/**
 * Did the weekly pipeline actually fire, and did it pass?
 *
 * The reason this tile exists: GitHub drops roughly 60% of scheduled cron runs,
 * and a pipeline that never ran looks exactly like a quiet week from inside our
 * own database. `judgeCron` is what turns "nothing happened" into a red tile.
 */
export async function githubTile(now: Date): Promise<VendorTile> {
  const link = "https://github.com/citypulsemn/citypulse-mn/actions";
  const token = envValue("GITHUB_TOKEN", "GH_TOKEN");
  const repo = envValue("GITHUB_REPOSITORY") ?? "citypulsemn/citypulse-mn";
  const wf = envValue("PIPELINE_WORKFLOW_FILE") ?? "weekly-research.yml";
  if (!token) return unknownTile("GitHub Actions", "GITHUB_TOKEN is not set", link);

  try {
    const body = await getJson(
      `https://api.github.com/repos/${repo}/actions/workflows/${wf}/runs?per_page=1`,
      { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
    );
    const run = rec(arr(rec(body).workflow_runs)[0]);
    const started = typeof run.created_at === "string" ? run.created_at : null;
    if (!started) {
      return unknownTile("GitHub Actions", `no runs found for ${wf}`, link);
    }
    // `conclusion` is null while a run is still going — that is genuinely "we
    // cannot tell yet", which judgeCron renders as unknown rather than as a pass.
    const conclusion = typeof run.conclusion === "string" ? run.conclusion : null;
    const ok = conclusion === null ? null : conclusion === "success";
    const days = Math.floor((now.getTime() - Date.parse(started)) / 86_400_000);
    return {
      service: "GitHub Actions",
      status: judgeCron(started, ok, 24 * 7, now),
      headline: conclusion === null ? "running now" : conclusion,
      detail: `${wf} last ran ${days === 0 ? "today" : `${days}d ago`}`,
      link: typeof run.html_url === "string" ? run.html_url : link,
    };
  } catch (err) {
    return unknownTile("GitHub Actions", reason(err), link);
  }
}

/* ------------------------------------------------------------------ Resend */

/**
 * Email, checked where it actually breaks.
 *
 * Resend publishes no aggregate bounce-rate endpoint, so the useful probe is
 * the sending DOMAIN's verification state. If that lapses, every email — the
 * weekly digest, the report alerts, the one-tap decision links — stops arriving
 * and nothing in our own database notices.
 */
export async function resendTile(): Promise<VendorTile> {
  const link = "https://resend.com/domains";
  const key = envValue("RESEND_API_KEY");
  if (!key) return unknownTile("Resend", "RESEND_API_KEY is not set", link);

  try {
    const body = await getJson("https://api.resend.com/domains", { Authorization: `Bearer ${key}` });
    const domains = arr(rec(body).data).map(rec);
    if (domains.length === 0) {
      return unknownTile("Resend", "the account has no sending domain", link);
    }
    const bad = domains.filter((d) => d.status !== "verified");
    const names = domains.map((d) => String(d.name ?? "?")).join(", ");
    return {
      service: "Resend",
      status: bad.length === 0 ? "ok" : "down",
      headline: bad.length === 0 ? "domain verified" : `${bad.length} domain(s) not verified`,
      detail:
        bad.length === 0
          ? `${names} — mail can leave`
          : bad.map((d) => `${d.name}: ${d.status}`).join(" · "),
      link,
    };
  } catch (err) {
    return unknownTile("Resend", reason(err), link);
  }
}

/* ---------------------------------------------------------------- Supabase */

/**
 * Disk against the plan. No token required — the connection we already hold can
 * answer it, which is why this is the one vendor tile that works out of the box.
 *
 * Egress, the thing that actually caused the 402s in Aug 2026, has no clean
 * Management API endpoint; it is visible only on the billing dashboard. The
 * tile says so rather than pretending disk is the whole story.
 */
export async function supabaseTile(): Promise<VendorTile> {
  const link = "https://supabase.com/dashboard/project/_/settings/billing/usage";
  if (!sql) return unknownTile("Supabase", "no database connection", link);
  // 8 GB of disk on the free tier; override when the plan changes.
  const limitGb = Number(envValue("SUPABASE_DISK_LIMIT_GB") ?? 8);
  try {
    const rows = await sql<{ bytes: string }[]>`select pg_database_size(current_database())::text as bytes`;
    const bytes = Number(rows[0]?.bytes);
    if (!Number.isFinite(bytes)) return unknownTile("Supabase", "could not read database size", link);
    const limitBytes = limitGb * 1024 ** 3;
    return {
      service: "Supabase",
      status: judgeUsage(bytes, limitBytes),
      headline: `${formatBytes(bytes)} of ${limitGb} GB disk`,
      detail: "egress is not exposed by the API — check the billing dashboard for that",
      link,
    };
  } catch (err) {
    return unknownTile("Supabase", reason(err), link);
  }
}

/* ------------------------------------------------------------------ Vercel */

/**
 * Month-to-date spend and the last deployment.
 *
 * Vercel's billing API returns FOCUS v1.3 as newline-delimited JSON, one row
 * per charge per day, so this sums `BilledCost` over the current month. A
 * budget is opt-in via `VERCEL_BUDGET_USD`; without one there is no cliff to
 * measure against, so the tile reports the number and stays neutral rather than
 * inventing a threshold.
 */
export async function vercelTile(now: Date): Promise<VendorTile> {
  const link = "https://vercel.com/dashboard/usage";
  const token = envValue("VERCEL_API_TOKEN");
  if (!token) return unknownTile("Vercel", "VERCEL_API_TOKEN is not set", link);
  const team = envValue("VERCEL_TEAM_ID");

  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const to = now.toISOString().slice(0, 10);
  const qs = new URLSearchParams({ from, to });
  if (team) qs.set("teamId", team);

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`https://api.vercel.com/v1/billing/charges?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: ctl.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    // JSONL: one JSON object per line. A blank line is not an error.
    const text = await res.text();
    let total = 0;
    let seen = 0;
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      try {
        const row = rec(JSON.parse(line));
        const cost = Number(row.BilledCost ?? row.EffectiveCost ?? row.billedCost);
        if (Number.isFinite(cost)) {
          total += cost;
          seen += 1;
        }
      } catch {
        // One unparseable line must not lose the other 200.
      }
    }
    if (seen === 0) {
      return unknownTile("Vercel", "billing API returned no charge rows", link);
    }
    const budget = Number(envValue("VERCEL_BUDGET_USD") ?? NaN);
    return {
      service: "Vercel",
      status: Number.isFinite(budget) ? judgeUsage(total, budget) : "ok",
      headline: `$${total.toFixed(2)} month to date`,
      detail: Number.isFinite(budget)
        ? `against a $${budget.toFixed(2)} budget · ${seen} charge rows since ${from}`
        : `${seen} charge rows since ${from} · set VERCEL_BUDGET_USD for a threshold`,
      link,
    };
  } catch (err) {
    return unknownTile("Vercel", reason(err), link);
  } finally {
    clearTimeout(timer);
  }
}

/* --------------------------------------------------------------- Anthropic */

/**
 * What the research runs cost, from our own `pipeline_runs` rows.
 *
 * Anthropic's usage API needs an admin-scoped key that this project does not
 * hold, so the number here is OUR measurement of OUR calls — which is the one
 * that matters, since the pipeline is essentially all of the spend. Runs from
 * before the cost columns existed read as null and are skipped rather than
 * counted as zero.
 */
export async function anthropicTile(): Promise<VendorTile> {
  const link = "https://console.anthropic.com/settings/usage";
  if (!sql) return unknownTile("Anthropic", "no database connection", link);
  try {
    const rows = await sql<{ cost: string; searches: number; unpriced: number; n: number }[]>`
      select coalesce(sum(cost_usd), 0)::text as cost,
             coalesce(sum(cost_searches), 0)::int as searches,
             coalesce(sum(cost_unpriced_calls), 0)::int as unpriced,
             count(cost_usd)::int as n
      from pipeline_runs
      where started_at >= date_trunc('month', now()) and cost_usd is not null`;
    const r = rows[0];
    if (!r || r.n === 0) {
      return unknownTile("Anthropic", "no priced runs yet this month", link);
    }
    const usd = Number(r.cost);
    const budget = Number(envValue("ANTHROPIC_BUDGET_USD") ?? NaN);
    return {
      service: "Anthropic",
      status: Number.isFinite(budget) ? judgeUsage(usd, budget) : "ok",
      headline: `$${usd.toFixed(2)} month to date`,
      detail:
        `${r.n} run(s) · ${r.searches} web searches` +
        (r.unpriced > 0 ? ` · ${r.unpriced} calls at an unknown rate, so this is a floor` : "") +
        (Number.isFinite(budget) ? ` · budget $${budget.toFixed(2)}` : ""),
      link,
    };
  } catch (err) {
    return unknownTile("Anthropic", reason(err), link);
  }
}

/* ------------------------------------------------------------------ gather */

/**
 * Every probe, in parallel, with a belt-and-braces catch. `allSettled` plus the
 * per-probe try/catch means a rejected promise still becomes a tile rather than
 * a missing row — a service that silently vanishes from the page would be the
 * exact blind spot this is built to close.
 */
export async function gatherVendorTiles(now: Date = new Date()): Promise<VendorTile[]> {
  const probes: [string, Promise<VendorTile>][] = [
    ["GitHub Actions", githubTile(now)],
    ["Vercel", vercelTile(now)],
    ["Supabase", supabaseTile()],
    ["Resend", resendTile()],
    ["Anthropic", anthropicTile()],
    ["Weekly email", digestTile()],
  ];
  const settled = await Promise.allSettled(probes.map(([, p]) => p));
  return settled.map((s, i) =>
    s.status === "fulfilled" ? s.value : unknownTile(probes[i][0], reason(s.reason), "#"),
  );
}

/* ----------------------------------------------------------- weekly digest */

/**
 * Did the weekly subscriber email actually go out?
 *
 * Not an outside service, but it fails like one: it depends on GitHub's
 * scheduler firing and on Resend accepting the batch, and when either lets go
 * the evidence is an absence. It has been a line of prose in the Monday email
 * all along; on 6 Aug 2026 a Thursday send was missed and nobody noticed.
 *
 * Uses the email's own DIGEST_STALE_DAYS so the tile and the Monday report can
 * never disagree about what "missed" means.
 */
export async function digestTile(): Promise<VendorTile> {
  const link = "/admin/digest";
  if (!sql) return unknownTile("Weekly email", "no database connection", link);
  try {
    const h = await getDigestHealth();
    const status = judgeDigest(h.lastSuccessDaysAgo, h.lastAttemptFailed, DIGEST_STALE_DAYS);
    if (h.lastSuccessDaysAgo === null && !h.lastAttemptFailed) {
      return unknownTile("Weekly email", "no successful send on record yet", link);
    }
    const ago =
      h.lastSuccessDaysAgo === null
        ? "never sent"
        : h.lastSuccessDaysAgo === 0
          ? "sent today"
          : `${h.lastSuccessDaysAgo}d ago`;
    return {
      service: "Weekly email",
      status,
      headline: h.lastAttemptFailed ? "last attempt FAILED" : ago,
      detail: h.lastAttemptFailed
        ? `${h.lastNote ?? "no reason recorded"} · last good send ${ago}`
        : `${h.lastSuccessAt ?? "—"} to ${h.lastRecipients ?? 0} subscribers · due weekly on Thursday`,
      link,
    };
  } catch (err) {
    return unknownTile("Weekly email", reason(err), link);
  }
}
