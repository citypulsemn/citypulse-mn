import { CONFIRM_TTL_DAYS } from "./confirm-token";

/**
 * The "confirm you're back" email (roadmap v5 F2.3). Sent only when someone
 * who explicitly unsubscribed resubscribes — the reconfirmation step. Mirrors
 * saved-restore's render/send: plain fetch to Resend (no SDK, audit stays 0),
 * a missing key is an honest INFRA failure (false), not a swallowed no-op.
 */

export function renderConfirmEmail(url: string): { subject: string; html: string; text: string } {
  const subject = "Confirm you're back on the City Pulse MN list";
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#0a1020;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a1020;"><tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="width:520px;max-width:100%;background:#0e1830;border-radius:14px;">
      <tr><td style="padding:26px 24px 8px;">
        <div style="font:700 20px/1 Arial,Helvetica,sans-serif;color:#c9a961;letter-spacing:2px;">CITY PULSE MN</div>
      </td></tr>
      <tr><td style="padding:14px 24px 4px;">
        <div style="font:400 15px/1.6 Arial,Helvetica,sans-serif;color:#f1ece0;">
          You (or someone using this address) asked to start getting the weekly
          City Pulse MN email again after unsubscribing. One click and you're
          back on the list — the best of Twin Cities events, once a week.
        </div>
      </td></tr>
      <tr><td style="padding:18px 24px 8px;">
        <a href="${url}" style="font:600 15px/1.2 Arial,Helvetica,sans-serif;color:#0e1830;background:#c9a961;text-decoration:none;display:inline-block;padding:12px 20px;border-radius:8px;">Yes, add me back &rarr;</a>
      </td></tr>
      <tr><td style="padding:10px 24px 26px;">
        <div style="font:400 12px/1.6 Arial,Helvetica,sans-serif;color:#7c8398;">
          This link works for ${CONFIRM_TTL_DAYS} days. Didn't ask to come back?
          Just ignore this email — you'll stay unsubscribed and won't hear from us.
        </div>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
  const text = [
    "CITY PULSE MN — confirm you're back",
    "",
    "You (or someone using this address) asked to start getting the weekly",
    "City Pulse MN email again after unsubscribing. Confirm with this link:",
    "",
    url,
    "",
    `The link works for ${CONFIRM_TTL_DAYS} days. Didn't ask to come back? Ignore`,
    "this email — you'll stay unsubscribed.",
  ].join("\n");
  return { subject, html, text };
}

/** True only if the email was actually handed to Resend. */
export async function sendConfirmEmail(to: string, url: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.DIGEST_FROM ?? "City Pulse MN <hello@citypulsemn.com>";
  const { subject, html, text } = renderConfirmEmail(url);

  if (!apiKey) {
    // Missing key is an INFRA failure, not a secret to keep (the Jul 15 lesson).
    // Log the link so an operator can hand it over if needed.
    console.error(`[subscribe-confirm] no RESEND_API_KEY — could not send. Link for ${to}: ${url}`);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, html, text }),
    });
    if (!res.ok) {
      console.error(`[subscribe-confirm] send failed: ${res.status} ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[subscribe-confirm] send error:", err);
    return false;
  }
}
