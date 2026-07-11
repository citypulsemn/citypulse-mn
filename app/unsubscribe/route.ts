import { verifyUnsubToken, unsubSecret } from "@/lib/unsubscribe-token";
import { markUnsubscribed } from "@/lib/subscribe";
import { SITE_URL } from "@/lib/seo/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const id = url.searchParams.get("id") ?? "";
  const t = url.searchParams.get("t") ?? "";

  const valid = /^\d+$/.test(id) && verifyUnsubToken(id, t, unsubSecret());
  if (valid) {
    try {
      await markUnsubscribed(id);
    } catch {
      // already-unsubscribed or transient DB issue — still show success.
    }
  }

  return new Response(pageHtml(valid), {
    status: valid ? 200 : 400,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function GET(req: Request) {
  return handle(req);
}

// RFC 8058 one-click unsubscribe (List-Unsubscribe-Post) uses POST.
export async function POST(req: Request) {
  return handle(req);
}

function pageHtml(ok: boolean): string {
  const title = ok ? "You're unsubscribed" : "Link expired";
  const body = ok
    ? "You won't receive any more City Pulse MN weekly emails. Changed your mind? You can resubscribe anytime at the bottom of the site."
    : "This unsubscribe link isn't valid. If you keep getting emails you don't want, reply to one and we'll remove you.";
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
