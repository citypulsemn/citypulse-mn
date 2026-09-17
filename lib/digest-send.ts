import { getEventsUncached } from "./events";
import { getSubscribedRecipients } from "./subscribe";
import { sql } from "./db";
import { splitDigestEvents, renderDigestEmail, digestWeekLabel, selectMostSaved, missingPostalAddress } from "./digest";
import { selectSavedUpcoming, categoryAffinity, personalizePicks } from "./digest-personal";
import { getSavedEvents } from "./saved";
import { getMostSavedCounts } from "./stats";
import { placeOfTheWeek } from "./places";
import { unsubscribeUrl, unsubSecret } from "./unsubscribe-token";
import { SITE_URL } from "./seo/site";
import { isCi, envValue } from "./env";
import type { EventRecord } from "./types";

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
  // CAN-SPAM §7704(a)(5): every commercial email needs the sender's valid
  // physical postal address. Not hard-coded — it is a real-world fact this repo
  // cannot know, and a plausible invented one would be worse than none.
  const postalAddress = envValue("DIGEST_POSTAL_ADDRESS");
  const secret = unsubSecret();

  // R2.2 — a REAL run without a key can never succeed, so fail first and
  // loudly, before composing anything. The old behavior folded this into the
  // dry-run branch: ok true, exit 0, green workflow — and zero subscribers
  // mailed for as many weeks as it took someone to notice. send-ops-digest.ts
  // already exits 1 on this exact condition; now both senders agree.
  if (!dryRun && !apiKey) {
    const note = "no RESEND_API_KEY — NOTHING SENT";
    // STILL FAILS, ALWAYS. ok:false → exit 1 → red workflow, unchanged.
    //
    // What changed (16 Sep 2026) is only whether it leaves a ROW. In CI a
    // missing key means the deployment lost its secret and subscribers are
    // about to be silently skipped — that belongs in the history. On a laptop
    // it means someone typed `npm run digest` in a shell that was never going
    // to send anything, and recording it answers the question "did the weekly
    // email go out?" with a false alarm. Three of those landed on the admin
    // panel in six days while every real Thursday send was succeeding.
    //
    // Same principle `record` already applies to dry runs: the row must mean
    // "this happened".
    const local = !isCi();
    console.error(`[digest] ${note}${local ? " (local run — not recorded)" : ""}`);
    const result = { attempted: 0, sent: 0, dryRun: false, ok: false, note };
    return local ? result : record(result);
  }

  const now = new Date();
  const allEvents = await getEventsUncached();
  // Two halves of the week: what's in front of the reader now, and next week.
  // Before this the ranking's weekend bonus filled all 8 slots with Fri-Sun and
  // midweek events were never seen (measured: weekend was 45% of what was
  // available and 100% of what shipped).
  const { soon, later } = splitDigestEvents(allEvents, now);
  // If the weekend half is somehow empty, promote next week rather than render an
  // empty first section under a 'This weekend' heading.
  const picks = soon.length > 0 ? soon : later;
  const laterPicks = soon.length > 0 ? later : [];
  const recipients = await getSubscribedRecipients();

  if (picks.length === 0) {
    return record({ attempted: recipients.length, sent: 0, dryRun, ok: true, note: "no events in window — skipped" });
  }
  if (recipients.length === 0) {
    return record({ attempted: 0, sent: 0, dryRun, ok: true, note: "no subscribers" });
  }

  const weekLabel = digestWeekLabel(now);

  // v6 1.3 — digest depth. Both are GLOBAL (identical for every recipient), so
  // compute once here, not per-message. Place of the week is pure (the registry);
  // most-saved is a never-break read resolved against the events already loaded,
  // so a saved-then-archived event is never featured stale. Both degrade to
  // omitted — an outage or thin data must never cost anyone their email.
  const placeOfWeek = placeOfTheWeek(now);
  const byId = new Map(allEvents.map((e) => [e.id, e]));
  let mostSaved: EventRecord[] = [];
  try {
    mostSaved = selectMostSaved(await getMostSavedCounts(7), byId);
  } catch (err) {
    console.error("[digest] most-saved read failed (section omitted):", err);
  }

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
      laterEvents: laterPicks,
      weekLabel,
      unsubscribeUrl: unsub,
      siteUrl,
      postalAddress,
      savedThisWeek,
      placeOfWeek,
      mostSaved,
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
  const compliance = missingPostalAddress(postalAddress) ? " · NO POSTAL ADDRESS IN FOOTER (CAN-SPAM)" : "";
  if (compliance) console.warn("[digest] DIGEST_POSTAL_ADDRESS is not set — the footer carries no physical address");
  let note: string | undefined = `${personalized} personalized${compliance}`;
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

/**
 * Whole days since the last REAL digest send, or null when none is recorded.
 *
 * Drives the ops digest's staleness alert. On Aug 6 2026 the weekly send never
 * ran — GitHub's hosted runners never acquired the job, it hit the 15-minute
 * timeout and was cancelled with zero steps executed — and nobody noticed for 13
 * days, because the ops digest happily printed the note from the PREVIOUS send as
 * if it were current. A stale value rendering as a fresh one.
 *
 * `ok = true and recipients > 0` is the load-bearing filter. Dry runs return
 * before the insert today, but a legacy `dry run · 2 personalized` row (0
 * recipients) is still in the table from before that guard — and counting a
 * rehearsal as a send would mask exactly the gap this exists to catch.
 */
export async function getDaysSinceLastDigest(): Promise<number | null> {
  if (!sql) return null;
  const [row] = await sql<{ days: number | null }[]>`
    select floor(extract(epoch from (now() - max(sent_at))) / 86400)::int as days
    from digest_sends
    where ok = true and recipients > 0
  `;
  return row?.days ?? null;
}

/**
 * Did a REAL digest already go out today (Chicago day)? The retry run's guard.
 *
 * FAILS SAFE BY STANDING DOWN. On any error this returns `true` — i.e. "assume a
 * send happened, don't send again". That is the deliberate opposite of
 * `rateAllow`, which fails OPEN: there, a broken instrument must not block a
 * user's action, whereas here a false negative would mail the entire subscriber
 * list a second copy — irreversible, and the one thing worse than a missed send.
 * A missed retry is now caught by the ops digest's staleness alert on Monday; a
 * duplicate email cannot be un-sent.
 */
export async function hasSentDigestToday(): Promise<boolean> {
  if (!sql) {
    console.warn("[digest] no DATABASE_URL — cannot confirm today's send, standing down");
    return true;
  }
  try {
    const [row] = await sql<{ sent: boolean }[]>`
      select exists (
        select 1 from digest_sends
        where ok = true and recipients > 0
          and (sent_at at time zone 'America/Chicago')::date
              = (now() at time zone 'America/Chicago')::date
      ) as sent
    `;
    return row?.sent ?? true;
  } catch (err) {
    console.error("[digest] could not check today's send — standing down rather than risk a duplicate:", err);
    return true;
  }
}

/**
 * The two facts the ops tile needs: how stale the last SUCCESSFUL send is, and
 * whether the most recent ATTEMPT failed. They are different questions — a
 * failure this morning sits behind a success from yesterday, and only the first
 * of those means mail did not go out.
 *
 * Local no-key runs are not recorded at all (see the branch in
 * `sendWeeklyDigest`), so a failed row here means a real one: CI ran and could
 * not send.
 */
/**
 * The exact tag put on the four pre-fix rows that a laptop wrote (16 Sep 2026).
 * A constant rather than a loose string because two places must agree about it:
 * the annotation on those rows, and the filter below that ignores them. Rows
 * written after the fix carry no tag — a local run leaves no row at all.
 */
export const LOCAL_RUN_MARKER = "local run, not the scheduled job";

export async function getDigestHealth(): Promise<{
  lastSuccessDaysAgo: number | null;
  lastAttemptFailed: boolean;
  lastSuccessAt: string | null;
  lastRecipients: number | null;
  lastNote: string | null;
}> {
  const empty = {
    lastSuccessDaysAgo: null,
    lastAttemptFailed: false,
    lastSuccessAt: null,
    lastRecipients: null,
    lastNote: null,
  };
  if (!sql) return empty;
  const [ok] = await sql<{ days: number | null; at: string | null; recipients: number | null }[]>`
    select floor(extract(epoch from (now() - sent_at)) / 86400)::int as days,
           to_char(sent_at at time zone 'America/Chicago', 'Mon DD') as at,
           recipients
    from digest_sends where ok = true and recipients > 0
    order by sent_at desc limit 1`;
  // "Did the scheduled send fail?" — so rows that were never a scheduled send
  // are excluded. Without this the tile went straight back to red on the four
  // laptop runs that prompted the fix in the first place: a new instrument
  // re-importing the false alarm the old one had just been cleared of.
  const [latest] = await sql<{ ok: boolean; note: string | null }[]>`
    select ok, note from digest_sends
    where note is null or note not like ${"%" + LOCAL_RUN_MARKER + "%"}
    order by sent_at desc limit 1`;
  return {
    lastSuccessDaysAgo: ok?.days ?? null,
    lastAttemptFailed: latest ? latest.ok === false : false,
    lastSuccessAt: ok?.at ?? null,
    lastRecipients: ok?.recipients ?? null,
    lastNote: latest?.note ?? null,
  };
}
