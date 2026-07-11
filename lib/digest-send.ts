import { getEvents } from "./events";
import { getSubscribedRecipients } from "./subscribe";
import { sql } from "./db";
import { digestEvents, renderDigestEmail, digestWeekLabel } from "./digest";
import { unsubscribeUrl, unsubSecret } from "./unsubscribe-token";
import { SITE_URL } from "./seo/site";

/**
 * Sends the weekly digest via the Resend batch API (no SDK — plain fetch, so
 * npm audit stays clean). Each recipient gets their own unsubscribe link and a
 * List-Unsubscribe header for one-click + deliverability. Without a key, or in
 * dry-run, it logs instead of sending. Every run records a digest_sends row.
 */

const RESEND_BATCH_ENDPOINT = "https://api.resend.com/emails/batch";
const CHUNK = 100; // Resend batch cap

export interface SendResult {
  attempted: number;
  sent: number;
  dryRun: boolean;
  ok: boolean;
  note?: string;
}

export interface DigestSendRow {
  sent_at: string;
  recipients: number;
  ok: boolean;
  note: string | null;
}

export async function sendWeeklyDigest(opts: { dryRun?: boolean } = {}): Promise<SendResult> {
  const dryRun = opts.dryRun ?? false;
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.DIGEST_FROM ?? "City Pulse MN <hello@citypulsemn.com>";
  const siteUrl = process.env.SITE_URL ?? SITE_URL;
  const secret = unsubSecret();

  const now = new Date();
  const picks = digestEvents(await getEvents(), now);
  const recipients = await getSubscribedRecipients();

  if (picks.length === 0) {
    return record({ attempted: recipients.length, sent: 0, dryRun, ok: true, note: "no events in window — skipped" });
  }
  if (recipients.length === 0) {
    return record({ attempted: 0, sent: 0, dryRun, ok: true, note: "no subscribers" });
  }

  const weekLabel = digestWeekLabel(now);
  const messages = recipients.map((r) => {
    const unsub = unsubscribeUrl(siteUrl, r.id, secret);
    const { subject, html, text } = renderDigestEmail({ events: picks, weekLabel, unsubscribeUrl: unsub, siteUrl });
    return {
      from,
      to: [r.email],
      subject,
      html,
      text,
      headers: {
        "List-Unsubscribe": `<${unsub}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    };
  });

  if (dryRun || !apiKey) {
    const note = dryRun ? "dry run" : "no RESEND_API_KEY — logged only";
    console.log(`[digest] ${note}: ${messages.length} emails, subject="${messages[0].subject}"`);
    return record({ attempted: recipients.length, sent: 0, dryRun: true, ok: true, note });
  }

  let sent = 0;
  let ok = true;
  let note: string | undefined;
  for (let i = 0; i < messages.length; i += CHUNK) {
    const chunk = messages.slice(i, i + CHUNK);
    const res = await fetch(RESEND_BATCH_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) {
      ok = false;
      note = `resend ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`;
      console.error("[digest]", note);
      break;
    }
    sent += chunk.length;
  }
  return record({ attempted: recipients.length, sent, dryRun: false, ok, note });
}

async function record(result: SendResult): Promise<SendResult> {
  try {
    if (sql) {
      await sql`insert into digest_sends (recipients, ok, note) values (${result.sent}, ${result.ok}, ${result.note ?? null})`;
    }
  } catch (err) {
    console.error("[digest] failed to record send:", err);
  }
  return result;
}

export async function getDigestSends(limit = 10): Promise<DigestSendRow[]> {
  if (!sql) return [];
  return await sql<DigestSendRow[]>`
    select
      to_char(sent_at at time zone 'America/Chicago', 'YYYY-MM-DD HH24:MI') as sent_at,
      recipients, ok, note
    from digest_sends
    order by sent_at desc
    limit ${limit}
  `;
}
