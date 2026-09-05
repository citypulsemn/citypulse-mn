import { esc } from "@/lib/digest";
import { EMAIL_HEAD } from "@/lib/email-head";
import { verifyReportToken, reportActionSecret, isReportAction } from "@/lib/report-token";
import { applyEmailedDecision, type DecisionOutcome } from "@/lib/event-reports";
import { revalidateReportDecision } from "@/lib/report-revalidate";

/**
 * One-tap report decisions from the ops email.
 *
 * GET  → a confirmation page. IT CHANGES NOTHING.
 * POST → applies the decision.
 *
 * That split is the whole security design. Outlook Safe Links and Gmail's
 * scanners fetch every URL in a message before a human sees it, so a GET that
 * hid a listing would fire on delivery and take events off the site by itself.
 * The token is checked on both, and it signs the ACTION as well as the report
 * id, so a "keep" link cannot be edited into a "take it down".
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parse(req: Request): { id: string; action: string; token: string } {
  const url = new URL(req.url);
  return {
    id: (url.searchParams.get("id") ?? "").trim(),
    action: (url.searchParams.get("a") ?? "").trim(),
    token: (url.searchParams.get("t") ?? "").trim(),
  };
}

export async function GET(req: Request): Promise<Response> {
  const { id, action, token } = parse(req);
  if (!isReportAction(action) || !verifyReportToken(id, action, token, reportActionSecret())) {
    return page(400, "Link expired", "<p>That link isn't valid any more. Open the report in Admin instead.</p>");
  }

  const isDelete = action === "delete";
  const verb = isDelete ? "Take this listing down" : "Keep this listing";
  const detail = isDelete
    ? "It will be hidden from the site straight away. Nothing is deleted — it stays in the database as a draft and one click in Admin puts it back."
    : "The report will be closed as reviewed with no change. The listing stays live.";

  // The action lives in the form, not in a link, so nothing here fires by being
  // fetched. Values are re-signed the same way and re-checked on POST.
  return page(
    200,
    verb,
    `<p>${esc(detail)}</p>
     <form method="post" action="/report-action?id=${encodeURIComponent(id)}&a=${esc(action)}&t=${encodeURIComponent(token)}">
       <button type="submit" style="${isDelete ? BTN_DANGER : BTN_OK}">${esc(verb)}</button>
     </form>
     <p style="font-size:12.5px;color:#9aa3b5;margin-top:18px;">Tapped this by mistake? Just close the page — nothing has happened yet.</p>`,
  );
}

export async function POST(req: Request): Promise<Response> {
  const { id, action, token } = parse(req);
  if (!isReportAction(action) || !verifyReportToken(id, action, token, reportActionSecret())) {
    return page(400, "Link expired", "<p>That link isn't valid any more. Open the report in Admin instead.</p>");
  }

  let outcome: DecisionOutcome;
  try {
    outcome = await applyEmailedDecision(id, action);
  } catch (err) {
    console.error("[report-action] failed:", err);
    return page(500, "Something went wrong", "<p>The decision was not saved. Please use Admin → Reports.</p>");
  }

  if (outcome.kind === "unknown") {
    return page(404, "Report not found", "<p>That report no longer exists.</p>");
  }
  if (outcome.kind === "already") {
    return page(
      200,
      "Already decided",
      `<p>“${esc(outcome.title)}” was already reviewed (${esc(outcome.status)}). Nothing changed.</p>`,
    );
  }

  // Rule 1: the decision is committed above. A cache that will not clear must
  // never turn a saved decision into an error page.
  await revalidateReportDecision(outcome.eventId, action);

  const done =
    action === "delete"
      ? `“${esc(outcome.title)}” is hidden. It's a draft now, not a deletion — Admin → Events puts it back.`
      : `“${esc(outcome.title)}” stays live and the report is closed.`;
  return page(200, action === "delete" ? "Taken down" : "Kept", `<p>${done}</p>`);
}

const BTN_DANGER =
  "display:inline-block;padding:14px 22px;border-radius:10px;border:1px solid #a05c3b;background:#a05c3b;color:#fff;font-size:15px;cursor:pointer;";
const BTN_OK =
  "display:inline-block;padding:14px 22px;border-radius:10px;border:1px solid #c9a961;background:#c9a961;color:#0d1526;font-size:15px;cursor:pointer;";

function page(status: number, title: string, bodyHtml: string): Response {
  return new Response(
    `<!doctype html><html><head>${EMAIL_HEAD}<title>${esc(title)} — City Pulse MN</title></head>
<body style="margin:0;padding:32px 20px;background:#0d1526;font-family:Georgia,serif;color:#f2ecdd;">
<div style="max-width:520px;margin:0 auto;">
<h1 style="font-size:20px;color:#c9a961;margin:0 0 12px;">${esc(title)}</h1>
${bodyHtml}
<p style="margin-top:26px;font-size:12.5px;"><a href="/admin/reports" style="color:#c9a961;">Open Admin → Reports</a></p>
</div></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );
}
