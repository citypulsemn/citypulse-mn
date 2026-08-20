import { EMAIL_HEAD } from "./email-head";
import { esc } from "./digest";
import { rateAllow } from "./rate-limit";

/**
 * Operator notification for things that need a human: a community submission or a
 * listing report (Taren item 3). Before this the ONLY way to learn about either was
 * to remember to open /admin — pull, not push.
 *
 * Two layers by design, and this is the fragile one:
 *   1. the weekly ops-digest "Queue" section is the BACKSTOP (already shipped);
 *   2. this instant email is the fast path.
 * Because (1) exists, (2) is safe to fail — and it MUST fail safely. The row is
 * already committed before we get here, so a dropped notification costs a few days
 * of latency, never the user's submission. Callers ignore the return value except
 * for logging (ENGINEERING rule 1: a broken instrument must not kill its panel).
 *
 * Delivery: the Resend REST call, copied from confirm-send.ts (no SDK — `npm audit`
 * stays at 0), plus an OPTIONAL webhook so the same event can land on a phone lock
 * screen. The webhook is pure config: set NOTIFY_WEBHOOK_URL and it fires, leave it
 * unset and nothing happens and nothing complains.
 */

export type NotifyKind = "submission" | "report";

export interface NotifyItem {
  kind: NotifyKind;
  /** One-line headline — the event title, or the submitted event's title. */
  title: string;
  /** Supporting line: venue · city · when, or the report's reason. */
  detail: string;
  /** Admin path to act on it, e.g. "/admin/reports". */
  adminPath: string;
}

const LABEL: Record<NotifyKind, string> = {
  submission: "New event submission",
  report: "New listing report",
};

/** A single global bucket for outbound notifications.
 *
 *  Deliberately NOT per-IP: `rateAllow` fails OPEN on database trouble (by
 *  design — see lib/rate-limit.ts), and submitPerIp is per-address anyway, so a
 *  distributed flood could otherwise turn into a flood of email and burn the
 *  Resend quota. This caps the blast radius on OUR side regardless of source.
 *  Hitting it is not an error for the user — the digest still reports the item. */
const NOTIFY_BUCKET = "notify:operator";
const NOTIFY_LIMIT = 20;
const NOTIFY_WINDOW_MINUTES = 60;

export function renderNotifyEmail(
  item: NotifyItem,
  siteUrl: string,
): { subject: string; html: string; text: string } {
  const label = LABEL[item.kind];
  const link = `${siteUrl.replace(/\/$/, "")}${item.adminPath}`;
  const subject = `${label}: ${item.title}`.slice(0, 180);

  // Every dynamic value through `esc` — this content is PUBLIC INPUT (a stranger's
  // reason text, a submitted title), and it lands in an HTML email.
  const html = `<!doctype html><html><head>${EMAIL_HEAD}</head><body style="margin:0;padding:0;background:#0a1020;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a1020;"><tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="width:520px;max-width:100%;background:#0e1830;border-radius:14px;">
      <tr><td style="padding:26px 24px 8px;">
        <div style="font:700 20px/1 Arial,Helvetica,sans-serif;color:#c9a961;letter-spacing:2px;">CITY PULSE MN</div>
        <div style="font:600 13px/1.4 Arial,Helvetica,sans-serif;color:#7c8398;padding-top:6px;">${esc(label)}</div>
      </td></tr>
      <tr><td style="padding:14px 24px 4px;">
        <div style="font:600 17px/1.4 Arial,Helvetica,sans-serif;color:#f1ece0;">${esc(item.title)}</div>
        <div style="font:400 14px/1.6 Arial,Helvetica,sans-serif;color:#c8c2b4;padding-top:6px;">${esc(item.detail)}</div>
      </td></tr>
      <tr><td style="padding:18px 24px 8px;">
        <a href="${esc(link)}" style="font:600 15px/1.2 Arial,Helvetica,sans-serif;color:#0e1830;background:#c9a961;text-decoration:none;display:inline-block;padding:12px 20px;border-radius:8px;">Review it &rarr;</a>
      </td></tr>
      <tr><td style="padding:10px 24px 26px;">
        <div style="font:400 12px/1.6 Arial,Helvetica,sans-serif;color:#7c8398;">
          Nothing has been published or changed — this is waiting for you to decide.
        </div>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;

  const text = [
    `CITY PULSE MN — ${label}`,
    "",
    item.title,
    item.detail,
    "",
    `Review it: ${link}`,
    "",
    "Nothing has been published or changed — this is waiting for you to decide.",
  ].join("\n");

  return { subject, html, text };
}

/** The optional phone-push hop. Sends a small JSON body that Discord, Slack,
 *  ntfy and most webhook receivers all accept (`content` / `text` / raw title).
 *  No-op when NOTIFY_WEBHOOK_URL is unset — that is the normal state. */
async function postWebhook(item: NotifyItem, siteUrl: string): Promise<void> {
  const url = process.env.NOTIFY_WEBHOOK_URL;
  if (!url) return;
  const line = `${LABEL[item.kind]}: ${item.title} — ${siteUrl.replace(/\/$/, "")}${item.adminPath}`;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: line, text: line, title: LABEL[item.kind], message: line }),
    });
  } catch (err) {
    console.error("[notify] webhook failed:", err);
  }
}

/**
 * Tell the operator something is waiting. Returns whether the EMAIL was handed to
 * Resend — for logging only. Never throws: every failure path is caught here so a
 * caller can `await` it inside a form submission without risking the submission.
 */
export async function sendOperatorNotification(item: NotifyItem): Promise<boolean> {
  const siteUrl = process.env.SITE_URL ?? "https://citypulsemn.com";
  try {
    if (!(await rateAllow(NOTIFY_BUCKET, NOTIFY_LIMIT, NOTIFY_WINDOW_MINUTES))) {
      // Not an error: the weekly Queue section still surfaces the item.
      console.warn("[notify] hourly notification cap reached — relying on the ops digest");
      return false;
    }

    await postWebhook(item, siteUrl);

    const apiKey = process.env.RESEND_API_KEY;
    // NOTIFY_TO first so the operator inbox can differ from the ops-digest one;
    // falls back to OPS_DIGEST_TO, which already exists for the weekly mail.
    const to = process.env.NOTIFY_TO ?? process.env.OPS_DIGEST_TO;
    const from = process.env.DIGEST_FROM ?? "City Pulse MN <hello@citypulsemn.com>";
    if (!apiKey || !to) {
      // Honest infra log, not silence (the Jul 15 lesson) — but still not an error
      // for the user, and the digest will report the item on Monday regardless.
      console.error(
        `[notify] missing ${!apiKey ? "RESEND_API_KEY" : "NOTIFY_TO/OPS_DIGEST_TO"} — ${item.kind} not emailed: ${item.title}`,
      );
      return false;
    }

    const { subject, html, text } = renderNotifyEmail(item, siteUrl);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, html, text }),
    });
    if (!res.ok) {
      console.error(`[notify] send failed: ${res.status} ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    // The submission is already saved. Swallow, log, move on.
    console.error("[notify] error:", err);
    return false;
  }
}
