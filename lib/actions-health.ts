/**
 * ACTIONS HEALTH — does the ops digest know when a job went red?
 *
 * Until now it did not, and that gap cost three weeks of the fabrication check.
 *
 * On 5, 12, 19 and 26 October the "Weekly Event Research" workflow FAILED. The
 * pipeline step inside it succeeded every time, so `pipeline_runs.ok` was
 * `true`, and the digest reads `pipeline_runs` — so the Monday email reported
 * the pipeline healthy on four consecutive red Mondays. What actually died was
 * a later step (`import-sports`, a `//` comment inside a SQL template), and
 * because the steps after it carried no `if:` guard, GitHub skipped them —
 * including "Check every listing against the page it cites". Pages
 * source-checked per week went 321 → 0 → 0 → 0 → 49 → 491 while the verify
 * pass, a separate workflow, kept stamping 110–212 events verified. The cause
 * is fixed (`fc7c22f`); the blindness is what this module removes.
 *
 * The lesson generalizes, and it is the same one twice now: **the thing that
 * reports health was reading a table the failing step never reached.** The only
 * instrument that cannot be fooled that way is the run's own conclusion.
 *
 * NO SDK, plain fetch — the project's standing rule (`npm audit` 0). Shaped
 * after `lib/search-console.ts`: the pure parts are golden-tested, the live read
 * returns null when no token is configured, and everything sits behind the ops
 * digest's never-break wrapper so a GitHub outage degrades to a line rather
 * than killing the email.
 *
 * "Not configured" and "failed to read" are deliberately DIFFERENT states.
 * `/admin/ops` renders on Vercel, where there is no GitHub token and never will
 * be, so an unconfigured read must be a quiet "not reported here" — otherwise
 * the panel alarms forever and the alarm stops meaning anything. A read that was
 * configured and then threw is a real failure and alerts, via the gather's
 * `errors` map like every other section.
 */

/** How many recent runs to read per workflow. Enough to spot a flapping job. */
export const ACTIONS_RUNS_PER_WORKFLOW = 5;

/**
 * The SCHEDULED workflows. Manual-only ones (`gsc-report`, `purge-cache`) are
 * deliberately absent: a dispatch someone ran once and abandoned is not news.
 * `ops-digest` itself is absent too — it is mid-run while it reports, so its own
 * conclusion is always `null` and would read as a permanent unknown.
 */
export const WATCHED_WORKFLOWS: readonly { file: string; label: string }[] = [
  { file: "weekly-research.yml", label: "weekly research" },
  { file: "weekly-digest.yml", label: "subscriber email" },
  { file: "verify-events.yml", label: "verify pass" },
  { file: "check-reports.yml", label: "report checker" },
];

export interface WorkflowRun {
  /** "success" | "failure" | "cancelled" | "timed_out" | … ; null while running. */
  conclusion: string | null;
  /** ISO timestamp the run started. */
  at: string;
  /** Link straight to the run, so the email is one tap from the log. */
  url: string;
}

export interface WorkflowHealth {
  label: string;
  file: string;
  /** Newest first, at most ACTIONS_RUNS_PER_WORKFLOW. */
  recent: WorkflowRun[];
}

/**
 * Conclusions that mean the job did not do its job.
 *
 * `cancelled` counts. It is usually deliberate — but the 14 July pipeline was
 * cancelled by GitHub's own timeout mid-flight and recorded `ok=false` with
 * nothing upserted, which is exactly the shape worth seeing on a Monday.
 * `null` does NOT count: a run still in progress is not a failure, and the
 * ops digest fires on `workflow_run: completed` so it will often see one.
 */
export const BAD_CONCLUSIONS: readonly string[] = ["failure", "cancelled", "timed_out", "startup_failure"];

/**
 * Pull the fields we need out of one `/actions/workflows/{file}/runs` response.
 * Pure. Anything unparseable becomes an empty list, which the judge reports as
 * "no runs recorded" — never as a pass.
 */
export function parseWorkflowRuns(raw: unknown): WorkflowRun[] {
  if (raw === null || typeof raw !== "object") return [];
  const runs = (raw as { workflow_runs?: unknown }).workflow_runs;
  if (!Array.isArray(runs)) return [];
  const out: WorkflowRun[] = [];
  for (const r of runs) {
    if (r === null || typeof r !== "object") continue;
    const row = r as Record<string, unknown>;
    const at = typeof row.created_at === "string" ? row.created_at : null;
    if (!at) continue; // a run we cannot date is a run we cannot report
    out.push({
      conclusion: typeof row.conclusion === "string" ? row.conclusion : null,
      at,
      url: typeof row.html_url === "string" ? row.html_url : "",
    });
  }
  return out;
}

/** Chicago-dated day, matching the rest of the digest's wording. */
function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown date";
  return d.toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric" });
}

/**
 * Turn the health of every watched workflow into the section's lines, and decide
 * whether the Monday email should shout. Pure.
 *
 * `null` means no token was configured — a quiet line and NO alert, the same
 * contract `getSearchImpressions` has for a missing key. A read that was
 * configured and threw never reaches here; the gather catches it and the
 * section renders "unavailable" with an alert, like every other section.
 *
 * All green collapses to ONE line: the operator reads this on a phone, and four
 * green lines every week is how a section becomes scenery. Only trouble is named.
 */
export function judgeActions(health: readonly WorkflowHealth[] | null): {
  lines: string[];
  alert: boolean;
} {
  if (health === null) {
    return { lines: ["not reported here — no GitHub token in this environment"], alert: false };
  }
  if (health.length === 0) {
    return { lines: ["no workflows watched"], alert: false };
  }

  const lines: string[] = [];
  let alert = false;

  for (const w of health) {
    const [latest] = w.recent;

    // Nothing to read is not a pass. A weekly schedule with no runs at all means
    // the cron stopped firing, which GitHub does silently on a quiet repo.
    if (!latest) {
      lines.push(`${w.label} — NO RUNS RECORDED`);
      alert = true;
      continue;
    }

    if (latest.conclusion !== null && BAD_CONCLUSIONS.includes(latest.conclusion)) {
      const link = latest.url ? ` → ${latest.url}` : "";
      lines.push(`${w.label} — LAST RUN ${latest.conclusion.toUpperCase()} (${shortDate(latest.at)})${link}`);
      alert = true;
      continue;
    }

    // Latest is fine, but a job that fails every other week is still broken; the
    // sports step passed on 28 Sep between failures and nobody looked again.
    const bad = w.recent.filter((r) => r.conclusion !== null && BAD_CONCLUSIONS.includes(r.conclusion)).length;
    if (bad > 0) {
      lines.push(`${w.label} — last run ok, but ${bad} of the last ${w.recent.length} failed`);
    }
  }

  if (lines.length === 0) {
    lines.push(`${health.length} scheduled workflow(s), last run green`);
  }
  return { lines, alert };
}

/**
 * Read the recent runs of every watched workflow. Null when no token is
 * configured (Vercel, a local shell without one) — which is "not reported",
 * not a failure. Throws on a real read error so the gather can report it.
 */
/**
 * Is there a token to read Actions with?
 *
 * The gather asks this BEFORE applying a deadline, so that "no token" and "the
 * read timed out" stay distinguishable: the first is a quiet line, the second
 * alerts. One definition, two callers — `getActionsHealth` uses it too.
 */
export function actionsConfigured(token: string | undefined = process.env.GITHUB_TOKEN): boolean {
  return Boolean(token);
}

export async function getActionsHealth(
  token: string | undefined = process.env.GITHUB_TOKEN,
  repo: string | undefined = process.env.GITHUB_REPOSITORY ?? "citypulsemn/citypulse-mn",
): Promise<WorkflowHealth[] | null> {
  if (!actionsConfigured(token) || !repo) return null;

  const read = async (w: { file: string; label: string }): Promise<WorkflowHealth> => {
    const url =
      `https://api.github.com/repos/${repo}/actions/workflows/${w.file}/runs` +
      `?per_page=${ACTIONS_RUNS_PER_WORKFLOW}&exclude_pull_requests=true`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    // A 404 here is a workflow file that no longer exists — a fact worth
    // reporting as "no runs", not an outage that should blank the section.
    if (res.status === 404) return { label: w.label, file: w.file, recent: [] };
    if (!res.ok) throw new Error(`actions ${w.file}: ${res.status}`);
    return { label: w.label, file: w.file, recent: parseWorkflowRuns(await res.json()) };
  };

  return Promise.all(WATCHED_WORKFLOWS.map(read));
}
