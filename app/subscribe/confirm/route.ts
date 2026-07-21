import { verifyConfirmToken } from "@/lib/confirm-token";
import { unsubSecret } from "@/lib/unsubscribe-token";
import { confirmSubscriber } from "@/lib/subscribe";
import { SITE_URL } from "@/lib/seo/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Resubscribe confirmation landing (roadmap v5 F2.3). The link in the
 * "confirm you're back" email lands here; a valid, unexpired token promotes
 * the pending row to subscribed. GET only — a human clicking a link, not a
 * one-click list-management POST.
 */
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const id = url.searchParams.get("id") ?? "";
  const exp = Number(url.searchParams.get("exp"));
  const t = url.searchParams.get("t") ?? "";

  const validToken = /^\d+$/.test(id) && verifyConfirmToken(id, exp, t, unsubSecret());

  let ok = false;
  if (validToken) {
    try {
      const outcome = await confirmSubscriber(id);
      ok = outcome === "confirmed" || outcome === "already";
    } catch {
      // transient DB issue — fall through to the expired/try-again page
    }
  }

  return new Response(pageHtml(ok), {
    status: ok ? 200 : 400,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

function pageHtml(ok: boolean): string {
  const title = ok ? "You're back on the list" : "Link expired";
  const body = ok
    ? "You'll get the City Pulse MN weekly email again — the best of Twin Cities events, once a week. Unsubscribe anytime from the bottom of any issue."
    : "This confirmation link isn't valid or has expired. Head to the site and enter your email again to get a fresh one.";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${title} — City Pulse MN</title></head>
<body style="margin:0;background:#0a1020;font-family:Arial,Helvetica,sans-serif;">
<div style="max-width:520px;margin:12vh auto;padding:0 20px;text-align:center;">
  <div style="font:700 20px/1 Arial;color:#c9a961;letter-spacing:2px;margin-bottom:24px;">CITY PULSE MN</div>
  <div style="background:#0e1830;border:1px solid rgba(201,169,97,0.28);border-radius:14px;padding:34px 26px;">
    <h1 style="font:700 24px/1.3 Georgia,serif;color:#f1ece0;margin:0 0 12px;">${title}</h1>
    <p style="font:400 15px/1.6 Arial;color:#b8b2a4;margin:0 0 22px;">${body}</p>
    <a href="${SITE_URL}" style="font:600 15px/1.2 Arial;color:#0e1830;background:#c9a961;text-decoration:none;display:inline-block;padding:12px 22px;border-radius:8px;">Back to City Pulse &rarr;</a>
  </div>
</div></body></html>`;
}
