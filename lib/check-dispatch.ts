import { envValue } from "./env";
import { rateAllow } from "./rate-limit";

/**
 * Kick the report checker the moment a report is filed.
 *
 * WHY. `.github/workflows/check-reports.yml` exists because reader reports are
 * about things happening TONIGHT — the Marley/Fillmore report (5 Sep 2026) came
 * in at 11:20 for a show that evening. It was scheduled every 2 hours. On
 * 10 Sep 2026 the run history said otherwise: 4–5 runs a day, not 12, with real
 * gaps of 6h35m and 7h51m. GitHub drops scheduled runs under load — nothing
 * errors, every run shows green, the runs simply never happen. Tightening the
 * cron to twice an hour narrowed the worst case but cannot close it, because the
 * dropping is not ours to control.
 *
 * A dispatch is not subject to that queue. The report arrives, we ask GitHub to
 * run the workflow now, and the verdict email lands in minutes instead of hours.
 *
 * THE CRON REMAINS THE GUARANTEE. This is an accelerator, and it is allowed to
 * fail: the token can expire, GitHub can be down, the variable can be unset (it
 * is unset until Taren adds it, and that is a normal state, not a broken one).
 * Every failure here is logged and swallowed — the report is already committed
 * before we are called, and the scheduled run picks it up regardless. ENGINEERING
 * rule 1: a broken instrument must not kill its panel.
 *
 * WHY workflow_dispatch AND NOT repository_dispatch, which is the more usual
 * choice: repository_dispatch requires a token with Contents: write — a token
 * that can push code to `main`. This call needs Actions: write and nothing else.
 * A fine-grained PAT scoped that way cannot alter the repository even if it
 * leaks. Setup is in docs/REPORT-CHECKS.md.
 */

const OWNER = "citypulsemn";
const REPO = "citypulse-mn";
const WORKFLOW_FILE = "check-reports.yml";
/** Dispatch always runs the workflow as it exists on the default branch. */
const REF = "main";

/** A global cap, deliberately NOT per-IP — same reasoning as lib/notify-send.ts.
 *  `rateAllow` fails OPEN on database trouble, so a distributed flood of reports
 *  could otherwise become a flood of queued Actions runs. Hitting this is not an
 *  error: the cron still collects everything that piled up. */
const DISPATCH_BUCKET = "dispatch:check-reports";
const DISPATCH_LIMIT = 10;
const DISPATCH_WINDOW_MINUTES = 60;

export interface DispatchRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
}

/**
 * What the GitHub call looks like — pure, so the URL and the API contract are
 * golden-tested rather than discovered in production. `undefined` when there is
 * no token, which is how "not configured" stays distinguishable from "failed".
 */
export function buildDispatchRequest(token: string | undefined): DispatchRequest | undefined {
  const t = (token ?? "").trim();
  if (!t) return undefined;
  return {
    url: `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
    headers: {
      Authorization: `Bearer ${t}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    // No `inputs`: the workflow's only input is `dry_run`, and an omitted input
    // reads as "" in the run step — which is exactly the real (non-dry) path.
    body: JSON.stringify({ ref: REF }),
  };
}

/**
 * Ask GitHub to run the report checker now. Returns whether the dispatch was
 * accepted, for logging only. Never throws — a caller can `await` this inside a
 * form submission without risking the submission.
 */
export async function dispatchReportCheck(): Promise<boolean> {
  const req = buildDispatchRequest(envValue("GH_DISPATCH_TOKEN"));
  if (!req) {
    // Normal until the token is set. Named, not silent (the Jul 15 lesson), but
    // not an error — the cron is what actually guarantees the check.
    console.warn("[dispatch] GH_DISPATCH_TOKEN unset — report check left to the cron");
    return false;
  }
  try {
    if (!(await rateAllow(DISPATCH_BUCKET, DISPATCH_LIMIT, DISPATCH_WINDOW_MINUTES))) {
      console.warn("[dispatch] hourly dispatch cap reached — the cron will collect the backlog");
      return false;
    }
    // A hung GitHub must not hold the reporter's form open. The cron covers us.
    const res = await fetch(req.url, {
      method: "POST",
      headers: req.headers,
      body: req.body,
      signal: AbortSignal.timeout(5000),
    });
    // 204 No Content is the documented success. Anything else is a real problem
    // worth reading in the log — an expired token 401s here and nowhere else.
    if (res.status !== 204) {
      console.error(`[dispatch] workflow dispatch failed: ${res.status} ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[dispatch] error:", err);
    return false;
  }
}
