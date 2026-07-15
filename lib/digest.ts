import { weeklyPicks } from "./content/weekly-picks";
import { DOW, MONTHS, timeLabel, evDate, dkey } from "./dates";
import { CATEGORIES } from "./categories";
import type { EventRecord } from "./types";

/**
 * Weekly email digest (roadmap 3.1). All rendering is pure and unit-tested.
 * The HTML is deliberately old-school email-safe: a centered table, inline
 * styles only, no external CSS or webfonts, brand navy/gold.
 */

const NAVY = "#0e1830";
const NAVY_CARD = "#16213f";
const GOLD = "#c9a961";
const CREAM = "#f1ece0";
const CREAM_DIM = "#b8b2a4";

export interface DigestData {
  subject: string;
  html: string;
  text: string;
}

export interface DigestOptions {
  events: EventRecord[];
  weekLabel: string;
  unsubscribeUrl: string;
  siteUrl: string;
  /** ROADMAP 5.3 — the subscriber's own saved events happening this week.
   *  When present and non-empty, a "You saved these" section leads the email.
   *  Absent/empty ⇒ the digest is exactly the standard one. */
  savedThisWeek?: EventRecord[];
}

/** The curated ~8-event set for the email: family + unique + top regulars. */
export function digestEvents(events: EventRecord[], now: Date): EventRecord[] {
  const picks = weeklyPicks(events, now, { regularCount: 6 });
  const ordered = [
    ...(picks.family ? [picks.family] : []),
    ...(picks.unique ? [picks.unique] : []),
    ...picks.regular,
  ];
  const seen = new Set<string>();
  const out: EventRecord[] = [];
  for (const e of ordered) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    out.push(e);
    if (out.length >= 8) break;
  }
  return out.sort((a, b) => evDate(a).getTime() - evDate(b).getTime());
}

/** "July 14 – 20" style label for the week starting at `now`. */
export function digestWeekLabel(now: Date): string {
  const end = new Date(now.getTime() + 6 * 86_400_000);
  const a = `${MONTHS[now.getMonth()]} ${now.getDate()}`;
  const b =
    now.getMonth() === end.getMonth()
      ? `${end.getDate()}`
      : `${MONTHS[end.getMonth()]} ${end.getDate()}`;
  return `${a} – ${b}`;
}

function eventUrl(siteUrl: string, id: string): string {
  return `${siteUrl}/event/${id}?utm_source=email&utm_medium=digest`;
}

function whenLabel(e: EventRecord): string {
  const d = evDate(e);
  return `${DOW[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()} · ${timeLabel(e)}`;
}

function esc(s: string): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function eventRowHtml(e: EventRecord, siteUrl: string): string {
  const cat = CATEGORIES[e.category];
  const loc = [e.venue, e.city].filter(Boolean).map(esc).join(" · ");
  return `
  <tr><td style="padding:0 0 14px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${NAVY_CARD};border:1px solid rgba(201,169,97,0.28);border-radius:10px;">
      <tr><td style="padding:16px 18px;">
        <div style="font:600 12px/1.2 Arial,Helvetica,sans-serif;color:${GOLD};text-transform:uppercase;letter-spacing:1px;">${esc(cat.label)}</div>
        <a href="${eventUrl(siteUrl, e.id)}" style="font:700 19px/1.3 Georgia,'Times New Roman',serif;color:${CREAM};text-decoration:none;display:block;margin:6px 0 6px;">${esc(e.title)}</a>
        <div style="font:400 14px/1.5 Arial,Helvetica,sans-serif;color:${CREAM_DIM};">${esc(whenLabel(e))}</div>
        <div style="font:400 14px/1.5 Arial,Helvetica,sans-serif;color:${CREAM_DIM};">${loc} · ${esc(e.price)}</div>
        <a href="${eventUrl(siteUrl, e.id)}" style="font:600 14px/1.2 Arial,Helvetica,sans-serif;color:${GOLD};text-decoration:none;display:inline-block;margin-top:10px;">Details &rarr;</a>
      </td></tr>
    </table>
  </td></tr>`;
}

export function renderDigestEmail(opts: DigestOptions): DigestData {
  const { events, weekLabel, unsubscribeUrl, siteUrl } = opts;
  const saved = opts.savedThisWeek ?? [];
  const top = events[0];
  const subject =
    saved.length > 0
      ? `You saved ${saved.length === 1 ? `"${saved[0].title}"` : `${saved.length} events`} — happening this week`
      : events.length === 0
        ? "This week in the Twin Cities"
        : events.length === 1
          ? `This week: ${top.title}`
          : `This week in the Twin Cities: ${top.title} + ${events.length - 1} more`;

  const rows = events.map((e) => eventRowHtml(e, siteUrl)).join("");
  const savedRows = saved.map((e) => eventRowHtml(e, siteUrl)).join("");
  const savedSection = saved.length === 0 ? "" : `
        <tr><td style="padding:16px 24px 0;">
          <div style="font:600 13px/1.2 Arial,Helvetica,sans-serif;color:${GOLD};text-transform:uppercase;letter-spacing:1.5px;">You saved these — happening this week</div>
        </td></tr>
        <tr><td style="padding:12px 24px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${savedRows}</table>
        </td></tr>
        <tr><td style="padding:2px 24px 0;">
          <div style="font:600 13px/1.2 Arial,Helvetica,sans-serif;color:${GOLD};text-transform:uppercase;letter-spacing:1.5px;">Also worth your time</div>
        </td></tr>`;

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#0a1020;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a1020;">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:${NAVY};border-radius:14px;overflow:hidden;">
        <tr><td style="padding:26px 24px 8px;">
          <div style="font:700 22px/1 Arial,Helvetica,sans-serif;color:${GOLD};letter-spacing:2px;">CITY PULSE MN</div>
          <div style="font:400 14px/1.5 Arial,Helvetica,sans-serif;color:${CREAM_DIM};margin-top:6px;">This week in the Twin Cities · ${esc(weekLabel)}</div>
        </td></tr>
        <tr><td style="padding:16px 24px 4px;">
          <div style="font:400 15px/1.6 Arial,Helvetica,sans-serif;color:${CREAM};">${saved.length > 0 ? "Your week, starting with the plans you already made." : "Here's what's worth your time across the metro this week."}</div>
        </td></tr>${savedSection}
        <tr><td style="padding:14px 24px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
        </td></tr>
        <tr><td style="padding:6px 24px 24px;">
          <a href="${siteUrl}?utm_source=email&utm_medium=digest" style="font:600 15px/1.2 Arial,Helvetica,sans-serif;color:${NAVY};background:${GOLD};text-decoration:none;display:inline-block;padding:12px 20px;border-radius:8px;">See everything on City Pulse &rarr;</a>
        </td></tr>
        <tr><td style="padding:18px 24px 26px;border-top:1px solid rgba(201,169,97,0.2);">
          <div style="font:400 12px/1.6 Arial,Helvetica,sans-serif;color:#7c8398;">
            You're getting this because you subscribed at citypulsemn.com.<br>
            <a href="${unsubscribeUrl}" style="color:#9aa1b4;text-decoration:underline;">Unsubscribe</a> · City Pulse MN · Twin Cities, Minnesota
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;

  const textLines = [
    `THIS WEEK IN THE TWIN CITIES — ${weekLabel}`,
    "",
    ...(saved.length > 0
      ? [
          "YOU SAVED THESE — HAPPENING THIS WEEK",
          "",
          ...saved.flatMap((e) => [
            e.title,
            `  ${whenLabel(e)}`,
            `  ${[e.venue, e.city].filter(Boolean).join(" · ")} · ${e.price}`,
            `  ${eventUrl(siteUrl, e.id)}`,
            "",
          ]),
          "ALSO WORTH YOUR TIME",
          "",
        ]
      : []),
    ...events.flatMap((e) => [
      e.title,
      `  ${whenLabel(e)}`,
      `  ${[e.venue, e.city].filter(Boolean).join(" · ")} · ${e.price}`,
      `  ${eventUrl(siteUrl, e.id)}`,
      "",
    ]),
    `See everything: ${siteUrl}`,
    "",
    `Unsubscribe: ${unsubscribeUrl}`,
    "City Pulse MN · Twin Cities, Minnesota",
  ];

  return { subject, html, text: textLines.join("\n") };
}
