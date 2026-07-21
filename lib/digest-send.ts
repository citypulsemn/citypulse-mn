import { getEvents } from "./events";
import { getSubscribedRecipients } from "./subscribe";
import { sql } from "./db";
import { digestEvents, renderDigestEmail, digestWeekLabel } from "./digest";
import { selectSavedUpcoming, categoryAffinity, personalizePicks } from "./digest-personal";
import { getSavedEvents } from "./saved";
import { unsubscribeUrl, unsubSecret } from "./unsubscribe-token";
import { SITE_URL } from "./seo/site";

/**
 * Sends the weekly digest via the Resend batch API (no SDK — plain fetch, so
 * npm audit stays clean). Each recipient gets their own unsubscribe link and a
 * List-Unsubscribe header for one-click + deliverability. Dry-run logs instead
 * of sending; a REAL run without a key fails (ok:false → exit 1 → red workflow,
 * R2.2). Real runs record a digest_sends row; dry runs leave no trace (R2.7,
 * same philosophy as ops_digest_runs — the record must mean "this happened").
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

  // R2.2 — a REAL run without a key can never succeed, so fail first and
  // loudly, before composing anything. The old behavior folded this into the
  // dry-run branch: ok true, exit 0, green workflow — and zero subscribers
  // mailed for as many weeks as it took someone to notice. send-ops-digest.ts
  // already exits 1 on this exact condition; now both senders agree.
  if (!dryRun && !apiKey) {
    const note = "no RESEND_API_KEY — NOTHING SENT";
    console.error(`[digest] ${note}`);
    return record({ attempted: 0, sent: 0, dryRun: false, ok: false, note });
  }

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

  // ROADMAP 5.3 — personalization. Recipients who subscribed from a browser
  // where they'd saved events carry a saver_token; their email leads with
  // their own imminent saves and reorders the picks toward their taste.
  // Every failure degrades to the standard digest — personalization must
  // never cost anyone their email.
  const savedByToken = new Map<string, Awaited<ReturnType<typeof getSavedEvents>>>();
  const tokens = [...new Set(recipients.map((r) => r.saver_token).filter((t): t is string => Boolean(t)))];
  for (const token of tokens) {
    try {
      savedByToken.set(token, await getSavedEvents(token));
    } catch (err) {
      console.error("[digest] saved fetch failed (standard digest for that token):", err);
    }
  }
  let personalized = 0;

  const messages = recipients.map((r) => {
    const unsub = unsubscribeUrl(siteUrl, r.id, secret);
    const saved = r.saver_token ? (savedByToken.get(r.saver_token) ?? []) : [];
    const savedThisWeek = selectSavedUpcoming(saved, now);
    const myPicks = personalizePicks(picks, categoryAffinity(saved), savedThisWeek);
    if (savedThisWeek.length > 0) personalized++;
    const { subject, html, text } = renderDigestEmail({
      events: myPicks,
      weekLabel,
      unsubscribeUrl: unsub,
      siteUrl,
      savedThisWeek,
    });
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

  if (dryRun) {
    const note = `dry run · ${personalized} personalized`;
    console.log(`[digest] ${note}: ${messages.length} emails, subject="${messages[0].subject}"`);
    return record({ attempted: recipients.length, sent: 0, dryRun: true, ok: true, note });
  }

  let sent = 0;
  let ok = true;
  let note: string | undefined = `${personalized} personalized`;
  for (let i = 0; i < messages.length; i += CHUNK) {
    const chunk = messages.slice(i, i + CHUNK);
    const res = await fetch(RESEND_BATCH_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) {
      ok = false;
      // R2.7 — a partial failure names how far it got, not just why it stopped.
      note = `resend ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)} · sent ${sent} of ${recipients.length} before failure`;
      console.error("[digest]", note);
      break;
    }
    sent += chunk.length;
  }
  return record({ attempted: recipients.length, sent, dryRun: false, ok, note });
}

async function record(result: SendResult): Promise<SendResult> {
  // R2.7 — dry runs leave no row: the ops digest reads the latest note as
  // "the last digest", and a rehearsal must never pose as one. The recipients
  // column records ATTEMPTED (who we tried to mail — partial failures no
  // longer under-report); the note carries the sent count when they differ.
  if (result.dryRun) return result;
  try {
    if (sql) {
      await sql`insert into digest_sends (recipients, ok, note) values (${result.attempted}, ${result.ok}, ${result.note ?? null})`;
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
