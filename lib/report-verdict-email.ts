import { EMAIL_HEAD } from "./email-head";
import { envOr, envValue } from "./env";
import { esc } from "./digest";
import { reportActionUrl, reportActionSecret } from "./report-token";
import { verdictHeadline, recommendationFor, type ReportCheckResult } from "./report-check";

/**
 * The email that carries a checked report and its two buttons.
 *
 * This is the SECOND email a report produces. The first — "a new listing report
 * came in" (lib/notify-send.ts) — still fires the instant someone submits, and
 * is unchanged; it is the fast ping. This one arrives once the check has
 * actually looked at the venue's calendar, and it is the one you can act on.
 *
 * Everything interpolated here is PUBLIC INPUT: the reason is a stranger's
 * prose, the note and evidence come from a model. All of it goes through `esc`.
 */

export interface VerdictEmailRow {
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

const ROW_STYLE = "font-size:13.5px;line-height:1.55;margin:0 0 4px;";
const BTN_DOWN =
  "display:inline-block;padding:12px 18px;margin:0 8px 8px 0;border-radius:9px;background:#a05c3b;color:#ffffff;text-decoration:none;font-size:14px;";
const BTN_KEEP =
  "display:inline-block;padding:12px 18px;margin:0 8px 8px 0;border-radius:9px;background:#c9a961;color:#0d1526;text-decoration:none;font-size:14px;";

export function renderReportVerdictEmail(
  rows: VerdictEmailRow[],
  siteUrl: string,
  secret: string,
): { subject: string; html: string; text: string } {
  const base = siteUrl.replace(/\/+$/, "");
  const wrong = rows.filter((r) => r.result.verdict === "supported").length;

  const subject =
    wrong > 0
      ? `⚠️ ${wrong} reported listing${wrong > 1 ? "s look" : " looks"} wrong — one tap to take ${wrong > 1 ? "them" : "it"} down`
      : `Checked ${rows.length} listing report${rows.length === 1 ? "" : "s"}`;

  const block = (r: VerdictEmailRow) => {
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

  const html = `<!doctype html><html><head>${EMAIL_HEAD}</head><body style="margin:0;padding:24px;background:#0d1526;font-family:Georgia,serif;color:#f2ecdd;">
<div style="max-width:560px;margin:0 auto;">
<h1 style="font-size:18px;letter-spacing:0.06em;color:#c9a961;margin:0 0 4px;">CITY PULSE — REPORTS CHECKED</h1>
<p style="margin:0 0 20px;font-size:13px;color:#9aa3b5;">Each report below was checked against the venue's own calendar.</p>
${rows.map(block).join("")}
<p style="font-size:11.5px;color:#707a8d;">Taking a listing down hides it as a draft — nothing is ever deleted, and Admin → Events puts it back.</p>
</div></body></html>`;

  const text = rows
    .map((r) => {
      const down = reportActionUrl(base, r.row.id, "delete", secret);
      const keep = reportActionUrl(base, r.row.id, "keep", secret);
      return [
        `${r.row.event_title} — ${r.row.event_venue} · ${r.row.event_start}`,
        `Reader (${r.row.kind}): ${r.row.reason}`,
        verdictHeadline(r.result.verdict),
        r.result.note ?? "",
        r.result.evidence ? `Evidence: ${r.result.evidence}` : "",
        `Take it down: ${down}`,
        `Keep it: ${keep}`,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n---\n\n");

  return { subject, html, text };
}

/**
 * Send it. Never throws — the verdicts are already saved and the weekly digest
 * carries them regardless (ENGINEERING rule 1). Returns whether Resend took it,
 * for logging only.
 */
export async function sendReportVerdictEmail(rows: VerdictEmailRow[]): Promise<boolean> {
  if (rows.length === 0) return false;
  try {
    const siteUrl = envOr("https://citypulsemn.com", "SITE_URL");
    const apiKey = envValue("RESEND_API_KEY");
    const to = envValue("NOTIFY_TO", "OPS_DIGEST_TO");
    const from = envOr("City Pulse MN <hello@citypulsemn.com>", "DIGEST_FROM");
    if (!apiKey || !to) {
      console.error(
        `[check-reports] missing ${!apiKey ? "RESEND_API_KEY" : "NOTIFY_TO/OPS_DIGEST_TO"} — verdicts saved but not emailed`,
      );
      return false;
    }
    const { subject, html, text } = renderReportVerdictEmail(rows, siteUrl, reportActionSecret());
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, html, text }),
    });
    if (!res.ok) {
      console.error(`[check-reports] send failed: ${res.status} ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[check-reports] email error:", err);
    return false;
  }
}
