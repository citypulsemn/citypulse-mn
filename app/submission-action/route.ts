import { esc } from "@/lib/digest";
import { EMAIL_HEAD } from "@/lib/email-head";
import {
  verifySubmissionToken,
  reportActionSecret,
  isSubmissionAction,
  type SubmissionAction,
} from "@/lib/report-token";
import { publishSubmission, rejectSubmission } from "@/lib/submission-publish";
import { getSubmissionForDecision } from "@/lib/submissions";
import { describeCorrections, realCorrections, type SubmissionCorrections } from "@/lib/submission-check";

/**
 * One-tap submission decisions from the inbox email.
 *
 * GET  → a confirmation page. IT CHANGES NOTHING.
 * POST → applies the decision.
 *
 * Same split, same reason as /report-action: Outlook Safe Links and Gmail's
 * scanners fetch every URL in a message before a human sees it, so a GET that
 * published an event would do it on delivery. The token signs the ACTION as
 * well as the id, so a "reject" link cannot be edited into a "publish", and it
 * is namespaced `submission:` so a report token cannot be replayed here.
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

const VERB: Record<SubmissionAction, string> = {
  "publish-corrected": "Publish the corrected version",
  "publish-as-sent": "Publish exactly as submitted",
  reject: "Reject this submission",
};

export async function GET(req: Request): Promise<Response> {
  const { id, action, token } = parse(req);
  if (!isSubmissionAction(action) || !verifySubmissionToken(id, action, token, reportActionSecret())) {
    return page(400, "Link expired", "<p>That link isn't valid any more. Open the submission in Admin instead.</p>");
  }

  const sub = await getSubmissionForDecision(id);
  if (!sub) return page(404, "Not found", "<p>That submission is gone.</p>");
  if (sub.status !== "pending") {
    return page(200, "Already decided", `<p>This one was already marked <strong>${esc(sub.status)}</strong>. Nothing has changed.</p>`);
  }

  // Show exactly what will be published, so the tap is informed rather than
  // trusting. The corrections are the check's proposal and nothing more.
  const proposed = (sub.check_corrections ?? {}) as SubmissionCorrections;
  const corrections = realCorrections(sub, proposed);
  const lines = action === "publish-corrected" ? describeCorrections(sub, corrections) : [];
  const detail =
    action === "reject"
      ? "The submission is closed and nothing is published. The submitter is not notified — the form never promised a reply."
      : action === "publish-as-sent"
        ? "The event goes live with the submitter's own wording and dates, ignoring the check's corrections."
        : lines.length > 0
          ? "The event goes live with these corrections applied:"
          : "The check proposed no corrections, so this publishes it as submitted.";

  return page(
    200,
    VERB[action],
    `<p style="margin:0 0 6px;"><strong>${esc(sub.title)}</strong><br>
       <span style="color:#9aa3b5;">${esc(sub.venue)}, ${esc(sub.city)} · ${esc(sub.start_local)}</span></p>
     <p>${esc(detail)}</p>
     ${lines.length > 0 ? `<ul style="color:#cdd5e4;font-size:13.5px;">${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>` : ""}
     <form method="post" action="/submission-action?id=${encodeURIComponent(id)}&a=${esc(action)}&t=${encodeURIComponent(token)}">
       <button type="submit" style="${action === "reject" ? BTN_DANGER : BTN_OK}">${esc(VERB[action])}</button>
     </form>
     <p style="font-size:12.5px;color:#9aa3b5;margin-top:18px;">Tapped this by mistake? Just close the page — nothing has happened yet.</p>`,
  );
}

export async function POST(req: Request): Promise<Response> {
  const { id, action, token } = parse(req);
  if (!isSubmissionAction(action) || !verifySubmissionToken(id, action, token, reportActionSecret())) {
    return page(400, "Link expired", "<p>That link isn't valid any more. Open the submission in Admin instead.</p>");
  }

  const result =
    action === "reject"
      ? await rejectSubmission(id, { via: "email" })
      : await publishSubmission(id, { applyCorrections: action === "publish-corrected", via: "email" });

  if (!result.ok) {
    const why =
      result.reason === "already-decided"
        ? "<p>Someone already decided this one. Nothing has changed.</p>"
        : result.reason === "not-found"
          ? "<p>That submission is gone.</p>"
          : "<p>Publishing failed. The submission is untouched — open it in Admin.</p>";
    return page(result.reason === "failed" ? 500 : 200, "Nothing changed", why);
  }

  const done =
    action === "reject"
      ? "Rejected. Nothing was published."
      : result.corrected.length > 0
        ? `Published with ${result.corrected.length} correction(s): ${result.corrected.join(", ")}.`
        : "Published as submitted.";
  return page(200, "Done", `<p><strong>${esc(result.title)}</strong></p><p>${esc(done)}</p>`);
}

const BTN_OK =
  "display:inline-block;background:#3b7a57;color:#fff;border:0;border-radius:8px;padding:12px 18px;font-size:15px;cursor:pointer;";
const BTN_DANGER =
  "display:inline-block;background:#8c3b3b;color:#fff;border:0;border-radius:8px;padding:12px 18px;font-size:15px;cursor:pointer;";

function page(status: number, title: string, body: string): Response {
  return new Response(
    `<!doctype html><html><head>${EMAIL_HEAD}<title>${esc(title)}</title></head>
     <body style="margin:0;background:#0f1724;color:#e8edf7;font-family:ui-sans-serif,system-ui,sans-serif;">
       <div style="max-width:560px;margin:0 auto;padding:40px 20px;">
         <h1 style="font-size:20px;margin:0 0 14px;">${esc(title)}</h1>
         ${body}
       </div>
     </body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}
