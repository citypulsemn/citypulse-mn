import { sql } from "./db";
import { getSaverToken, setSaverToken } from "./saver";
import { restoreUrl, verifyRestoreToken, RESTORE_TTL_DAYS } from "./restore-token";
import { unsubSecret } from "./unsubscribe-token";
import { normalizeEmail, isValidEmail } from "./subscribe";
import { rateAllow, emailBucket, RATE_LIMITS } from "./rate-limit";
import { SITE_URL } from "./seo/site";

/**
 * SAVED-LIST DURABILITY (roadmap 5.4).
 *
 * Saves live in an anonymous cookie: clear the browser or switch phones and
 * the list is gone. The magic link makes the list durable — and it composes
 * with the 5.3 identity bridge instead of inventing a new one:
 *
 *   REQUEST: from /saved, enter an email → we remember this browser's saver
 *   token on the subscriber row (subscribers.saver_token) and email a signed,
 *   7-day link. CONSENT: a brand-new email is stored as status 'pending' —
 *   asking to keep your list is NOT subscribing to the digest (the sender
 *   only mails status='subscribed').
 *
 *   RESTORE: opening the link on any device verifies the HMAC, MERGES any
 *   saves this device already has into the linked identity (nothing is ever
 *   lost), and points this browser's cookie at it.
 *
 * No-enumeration rule: the request path returns the same success message
 * whether or not anything was stored or sent.
 */

export type RequestLinkResult = "sent" | "invalid" | "nothing_to_keep" | "send_failed";

export async function requestSavedLink(rawEmail: string): Promise<RequestLinkResult> {
  const email = normalizeEmail(rawEmail);
  if (!isValidEmail(email)) return "invalid";

  const token = await getSaverToken();
  if (!token) return "nothing_to_keep"; // no saver identity in this browser

  if (!sql) {
    console.warn(`[saved-link] no DATABASE_URL — dev no-op for ${email}`);
    return "sent";
  }

  // R2.1 — the email-bomb gate: at most 3 restore links per TARGET address
  // per hour, counted before any row is written. Over the cap we answer the
  // generic success and send nothing: the no-enumeration rule extends to
  // throttling (a blocked attacker learns nothing), and a real requester's
  // first 3 links are already in their inbox.
  const perEmail = RATE_LIMITS.savedLinkPerEmail;
  if (!(await rateAllow(emailBucket("saved-link", email), perEmail.limit, perEmail.windowMinutes))) {
    console.warn(`[saved-link] per-email rate limit hit for ${email} — not sending`);
    return "sent";
  }

  // R2.7 merge-on-request (Taren's call, Jul 20): if this email already
  // points at a DIFFERENT device's list, fold that list into this device's
  // token BEFORE repointing — the emailed link then restores the union, and
  // a failure mid-flight leaves the old pointer intact. Without this, typing
  // your email on a 1-save phone orphaned the 100-save laptop list.
  const [prior] = await sql<{ saver_token: string | null }[]>`
    select saver_token from subscribers where email = ${email}
  `;
  const priorToken = prior?.saver_token;
  if (priorToken && priorToken !== token) {
    await sql`
      insert into saved_events (user_token, event_id)
      select ${token}, event_id from saved_events
      where user_token = ${priorToken}
      on conflict do nothing
    `;
  }

  // Find-or-create, storing THIS browser's token. New emails are 'pending':
  // keeping a list is not consenting to a newsletter.
  const rows = await sql<{ id: number }[]>`
    insert into subscribers (email, source, status, saver_token)
    values (${email}, 'saved-link', 'pending', ${token})
    on conflict (email) do update
      set saver_token = ${token}
    returning id
  `;
  const id = rows[0]?.id;
  if (!id) return "sent"; // shouldn't happen; stay generic

  const url = restoreUrl(SITE_URL, id, unsubSecret());
  // NO-ENUMERATION, scoped correctly: the generic success hides whether an
  // ADDRESS exists — it must not hide whether OUR MAIL PIPE works. A send
  // failure is the same for every address, so reporting it leaks nothing.
  const sent = await sendRestoreEmail(email, url);
  return sent ? "sent" : "send_failed";
}

export type RestoreResult = "restored" | "invalid";

export async function mergeAndRestore(
  idRaw: string,
  expRaw: string,
  token: string,
): Promise<RestoreResult> {
  if (!sql) return "invalid";
  if (!/^\d+$/.test(idRaw)) return "invalid";
  const exp = Number(expRaw);
  if (!verifyRestoreToken(idRaw, exp, token, unsubSecret())) return "invalid";

  const rows = await sql<{ saver_token: string | null }[]>`
    select saver_token from subscribers where id = ${idRaw}
  `;
  const restored = rows[0]?.saver_token;
  if (!restored) return "invalid"; // link outlived the identity (e.g. unsubscribed)

  // MERGE-DON'T-LOSE: saves made on this device before restoring come along.
  // saved_events keys on user_token (subscribers is the table with a
  // saver_token column) — R0.4: this insert shipped with the wrong column
  // name and 500'd the flagship merge case for its whole life.
  const current = await getSaverToken();
  if (current && current !== restored) {
    await sql`
      insert into saved_events (user_token, event_id)
      select ${restored}, event_id from saved_events
      where user_token = ${current}
      on conflict do nothing
    `;
  }

  await setSaverToken(restored);
  return "restored";
}

/** Small, digest-styled email carrying the link. */
export function renderRestoreEmail(url: string): { subject: string; html: string; text: string } {
  const subject = "Your saved events on City Pulse MN";
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#0a1020;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a1020;"><tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="width:520px;max-width:100%;background:#0e1830;border-radius:14px;">
      <tr><td style="padding:26px 24px 8px;">
        <div style="font:700 20px/1 Arial,Helvetica,sans-serif;color:#c9a961;letter-spacing:2px;">CITY PULSE MN</div>
      </td></tr>
      <tr><td style="padding:14px 24px 4px;">
        <div style="font:400 15px/1.6 Arial,Helvetica,sans-serif;color:#f1ece0;">
          Here's the link to your saved events. Open it on any device — phone, laptop,
          a fresh browser — and your list comes with you. Anything you've saved on that
          device gets merged in too; nothing is lost.
        </div>
      </td></tr>
      <tr><td style="padding:18px 24px 8px;">
        <a href="${url}" style="font:600 15px/1.2 Arial,Helvetica,sans-serif;color:#0e1830;background:#c9a961;text-decoration:none;display:inline-block;padding:12px 20px;border-radius:8px;">Open my saved events &rarr;</a>
      </td></tr>
      <tr><td style="padding:10px 24px 26px;">
        <div style="font:400 12px/1.6 Arial,Helvetica,sans-serif;color:#7c8398;">
          This link works for ${RESTORE_TTL_DAYS} days and only moves your saved list —
          it doesn't sign you up for anything. Didn't request it? You can ignore this email.
        </div>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
  const text = [
    "CITY PULSE MN — your saved events",
    "",
    "Open this link on any device and your saved list comes with you",
    "(saves already on that device are merged in — nothing is lost):",
    "",
    url,
    "",
    `The link works for ${RESTORE_TTL_DAYS} days and only moves your saved list —`,
    "it doesn't sign you up for anything. Didn't request it? Ignore this email.",
  ].join("\n");
  return { subject, html, text };
}

/** True only if the email was actually handed to Resend. */
async function sendRestoreEmail(to: string, url: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.DIGEST_FROM ?? "City Pulse MN <hello@citypulsemn.com>";
  const { subject, html, text } = renderRestoreEmail(url);

  if (!apiKey) {
    // A missing key is an INFRA failure, not a secret to keep (live incident,
    // Jul 15: the form said "check your inbox" while nothing could send). The
    // link is still logged so an operator can hand it over.
    console.error(`[saved-link] no RESEND_API_KEY — could not send. Link for ${to}: ${url}`);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, html, text }),
    });
    if (!res.ok) {
      console.error(`[saved-link] send failed: ${res.status} ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[saved-link] send error:", err);
    return false;
  }
}
