import { SITE_URL } from "./seo/site";
import { EMAIL_HEAD } from "./email-head";
import { envOr, envValue } from "./env";
import { esc } from "./digest";
import {
  reportActionUrl,
  submissionActionUrl,
  reportActionSecret,
} from "./report-token";
import { verdictHeadline, recommendationFor, type ReportCheckResult } from "./report-check";
import {
  submissionVerdictHeadline,
  recommendationForSubmission,
  describeCorrections,
  realCorrections,
  type SubmissionCheckResult,
  type SubmissionCorrections,
} from "./submission-check";

/**
 * THE INBOX EMAIL — one message, after the checking, for both kinds of thing a
 * stranger can send us.
 *
 * It replaces two separate channels and deletes a third:
 *
 *   - lib/notify-send.ts fired "a new submission/report came in" the INSTANT
 *     someone hit submit, before anything had been checked. That email could
 *     not tell Taren whether the thing was real, so it could not be acted on;
 *     it only said "go and do some research". It is gone.
 *   - lib/report-verdict-email.ts sent the checked report. Its rendering lives
 *     on below, unchanged, as the report half of this message.
 *   - Submissions had NO checked email at all. They sat until somebody noticed
 *     the count in Monday's ops digest, up to seven days later.
 *
 * So the cost of an arrival went from "one email you cannot act on, then maybe
 * another" to "one email, once, with the answer in it".
 *
 * Everything interpolated here is PUBLIC INPUT — a stranger's prose, or a
 * model's note about it. All of it goes through `esc`.
 */

export interface ReportRow {
  result: ReportCheckResult;
  row: {
    id: string;
    event_title: string;
    event_venue: string;
    event_start: string;
    event_status: string;
    kind: string;
    reason: string;
  };
}

export interface SubmissionRow {
  result: SubmissionCheckResult;
  row: {
    id: string;
    title: string;
    venue: string;
    city: string;
    address: string;
    start_local: string;
    end_local: string | null;
    price: string;
    ticket_url: string;
    source_url: string;
    submitter_email: string;
  };
}

const ROW_STYLE = "font-size:13.5px;line-height:1.5;margin:0;color:#cdd5e4;";
const BTN =
  "display:inline-block;padding:9px 14px;border-radius:7px;font-size:13.5px;text-decoration:none;margin-right:8px;";
const BTN_DOWN = `${BTN}background:#8c3b3b;color:#fff;`;
const BTN_KEEP = `${BTN}background:#2a3550;color:#e8edf7;`;
const BTN_GO = `${BTN}background:#3b7a57;color:#fff;`;

export function renderInboxEmail(
  submissions: SubmissionRow[],
  reports: ReportRow[],
  siteUrl: string,
  secret: string,
): { subject: string; html: string; text: string } {
  const base = siteUrl.replace(/\/+$/, "");
  const wrong = reports.filter((r) => r.result.verdict === "supported").length;
  const ready = submissions.filter(
    (s) => s.result.verdict === "confirmed" || s.result.verdict === "corrected",
  ).length;

  const bits: string[] = [];
  if (wrong > 0) bits.push(`${wrong} listing${wrong > 1 ? "s look" : " looks"} wrong`);
  if (ready > 0) bits.push(`${ready} submission${ready > 1 ? "s" : ""} ready to publish`);
  const subject =
    bits.length > 0
      ? `${wrong > 0 ? "⚠️ " : ""}${bits.join(" · ")}`
      : `Checked ${submissions.length + reports.length} inbox item${submissions.length + reports.length === 1 ? "" : "s"}`;

  // ── submissions ──────────────────────────────────────────────────────────
  const subBlock = (s: SubmissionRow) => {
    const proposed = (s.result.corrections ?? {}) as SubmissionCorrections;
    const corrections = realCorrections(s.row, proposed);
    const lines = describeCorrections(s.row, corrections);
    const rec = recommendationForSubmission(s.result.verdict);
    const alert = s.result.verdict === "contradicted";
    const hasCorrections = lines.length > 0;

    // The corrected button is offered only when there is something to correct,
    // so the operator is never choosing between two identical outcomes.
    const buttons = [
      hasCorrections
        ? `<a href="${esc(submissionActionUrl(base, s.row.id, "publish-corrected", secret))}" style="${BTN_GO}">Publish corrected</a>`
        : "",
      `<a href="${esc(submissionActionUrl(base, s.row.id, "publish-as-sent", secret))}" style="${hasCorrections ? BTN_KEEP : BTN_GO}">Publish as sent</a>`,
      `<a href="${esc(submissionActionUrl(base, s.row.id, "reject", secret))}" style="${BTN_DOWN}">Reject</a>`,
    ].join("");

    return `<div style="margin:0 0 16px;padding:14px 16px;border:1px solid ${alert ? "#a05c3b" : "#2a3550"};border-radius:10px;background:#131d33;">
<div style="font-size:15px;color:#f2ecdd;margin:0 0 2px;">${esc(s.row.title)}</div>
<div style="${ROW_STYLE}color:#9aa3b5;">${esc(s.row.venue)}, ${esc(s.row.city)} · ${esc(s.row.start_local)} · ${esc(s.row.price || "no price given")}</div>
<div style="${ROW_STYLE}margin-top:8px;color:${alert ? "#e0b070" : "#c9a961"};">${esc(submissionVerdictHeadline(s.result.verdict))}</div>
${s.result.note ? `<div style="${ROW_STYLE}">${esc(s.result.note)}</div>` : ""}
${s.result.evidence ? `<div style="${ROW_STYLE}color:#9aa3b5;">Evidence: ${esc(s.result.evidence)}</div>` : ""}
${
  hasCorrections
    ? `<div style="${ROW_STYLE}margin-top:8px;color:#9aa3b5;">We would change:</div>
       <ul style="margin:4px 0 0;padding-left:18px;color:#cdd5e4;font-size:13px;">${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`
    : ""
}
<div style="margin-top:12px;">${buttons}</div>
<div style="font-size:11.5px;color:#707a8d;margin-top:6px;">${esc(
      rec === "publish-corrected"
        ? "Suggested: publish corrected."
        : rec === "publish-as-sent"
          ? "Suggested: publish as sent."
          : rec === "reject"
            ? "Suggested: reject."
            : "No suggestion — worth a look.",
    )} Each button opens a confirm page; nothing changes until you tap there.</div>
</div>`;
  };

  // ── reports (moved from lib/report-verdict-email.ts, unchanged) ──────────
  const repBlock = (r: ReportRow) => {
    const down = reportActionUrl(base, r.row.id, "delete", secret);
    const keep = reportActionUrl(base, r.row.id, "keep", secret);
    const rec = recommendationFor(r.result.verdict);
    const alert = r.result.verdict === "supported";
    return `<div style="margin:0 0 16px;padding:14px 16px;border:1px solid ${alert ? "#a05c3b" : "#2a3550"};border-radius:10px;background:#131d33;">
<div style="font-size:15px;color:#f2ecdd;margin:0 0 2px;">${esc(r.row.event_title)}</div>
<div style="${ROW_STYLE}color:#9aa3b5;">${esc(r.row.event_venue)} · ${esc(r.row.event_start)} · ${esc(r.row.event_status)}</div>
<div style="${ROW_STYLE}margin-top:8px;"><span style="color:#9aa3b5;">Reader (${esc(r.row.kind)}):</span> “${esc(r.row.reason)}”</div>
<div style="${ROW_STYLE}margin-top:8px;color:${alert ? "#e0b070" : "#c9a961"};">${esc(verdictHeadline(r.result.verdict))}</div>
${r.result.note ? `<div style="${ROW_STYLE}">${esc(r.result.note)}</div>` : ""}
${r.result.evidence ? `<div style="${ROW_STYLE}color:#9aa3b5;">Evidence: ${esc(r.result.evidence)}</div>` : ""}
<div style="margin-top:12px;">
  <a href="${esc(down)}" style="${BTN_DOWN}">Take it down</a>
  <a href="${esc(keep)}" style="${BTN_KEEP}">Keep it</a>
</div>
<div style="font-size:11.5px;color:#707a8d;margin-top:6px;">${esc(
      rec === "take-it-down"
        ? "Suggested: take it down."
        : rec === "keep-it"
          ? "Suggested: keep it."
          : "No suggestion — worth a look.",
    )} Each button opens a confirm page; nothing changes until you tap there.</div>
</div>`;
  };

  const section = (title: string, body: string) =>
    body ? `<h2 style="font-size:13px;letter-spacing:0.08em;color:#9aa3b5;margin:22px 0 10px;">${title}</h2>${body}` : "";

  const html = `<!doctype html><html><head>${EMAIL_HEAD}</head><body style="margin:0;padding:24px;background:#0d1526;font-family:Georgia,serif;color:#f2ecdd;">
<div style="max-width:560px;margin:0 auto;">
<h1 style="font-size:18px;letter-spacing:0.06em;color:#c9a961;margin:0 0 4px;">CITY PULSE — INBOX</h1>
<p style="margin:0 0 4px;font-size:13px;color:#9aa3b5;">Everything below was checked against an organiser's own page before this was sent. Nothing arrives here unchecked.</p>
${section(`SUBMISSIONS (${submissions.length})`, submissions.map(subBlock).join(""))}
${section(`REPORTS (${reports.length})`, reports.map(repBlock).join(""))}
<p style="font-size:11.5px;color:#707a8d;margin-top:20px;">Publishing uses the details shown. Taking a listing down hides it as a draft — nothing is ever deleted, and Admin puts it back.</p>
</div></body></html>`;

  const text = [
    ...submissions.map((s) => {
      const corrections = realCorrections(s.row, (s.result.corrections ?? {}) as SubmissionCorrections);
      return [
        `SUBMISSION: ${s.row.title} — ${s.row.venue}, ${s.row.city} · ${s.row.start_local}`,
        submissionVerdictHeadline(s.result.verdict),
        s.result.note ?? "",
        s.result.evidence ? `Evidence: ${s.result.evidence}` : "",
        ...describeCorrections(s.row, corrections).map((l) => `  ${l}`),
        Object.keys(corrections).length > 0
          ? `Publish corrected: ${submissionActionUrl(base, s.row.id, "publish-corrected", secret)}`
          : "",
        `Publish as sent: ${submissionActionUrl(base, s.row.id, "publish-as-sent", secret)}`,
        `Reject: ${submissionActionUrl(base, s.row.id, "reject", secret)}`,
      ]
        .filter(Boolean)
        .join("\n");
    }),
    ...reports.map((r) =>
      [
        `REPORT: ${r.row.event_title} — ${r.row.event_venue} · ${r.row.event_start}`,
        `Reader (${r.row.kind}): ${r.row.reason}`,
        verdictHeadline(r.result.verdict),
        r.result.note ?? "",
        r.result.evidence ? `Evidence: ${r.result.evidence}` : "",
        `Take it down: ${reportActionUrl(base, r.row.id, "delete", secret)}`,
        `Keep it: ${reportActionUrl(base, r.row.id, "keep", secret)}`,
      ]
        .filter(Boolean)
        .join("\n"),
    ),
  ].join("\n\n---\n\n");

  return { subject, html, text };
}

/**
 * Send it. Never throws — the verdicts are already saved and the Monday digest
 * carries the pending counts regardless (ENGINEERING rule 1). Returns whether
 * Resend took it, so the caller can fail the job: a decision channel that
 * cannot deliver is an outage, not a log line.
 */
export async function sendInboxEmail(
  submissions: SubmissionRow[],
  reports: ReportRow[],
): Promise<boolean> {
  if (submissions.length === 0 && reports.length === 0) return false;
  try {
    const siteUrl = envOr(SITE_URL, "SITE_URL");
    const apiKey = envValue("RESEND_API_KEY");
    const to = envValue("NOTIFY_TO", "OPS_DIGEST_TO");
    const from = envOr("City Pulse MN <hello@citypulsemn.com>", "DIGEST_FROM");
    if (!apiKey || !to) {
      console.error(
        `[inbox] missing ${!apiKey ? "RESEND_API_KEY" : "NOTIFY_TO/OPS_DIGEST_TO"} — checks saved but not emailed`,
      );
      return false;
    }
    const { subject, html, text } = renderInboxEmail(submissions, reports, siteUrl, reportActionSecret());
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, html, text }),
    });
    if (!res.ok) {
      console.error(`[inbox] send failed: ${res.status} ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[inbox] email error:", err);
    return false;
  }
}
