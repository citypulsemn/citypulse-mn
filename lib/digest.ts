import { EMAIL_HEAD } from "./email-head";
import { weeklyPicks } from "./content/weekly-picks";
import { DOW, MONTHS, timeLabel, evDate, dkey } from "./dates";
import { chiDayKey } from "./clock";
import { CATEGORIES } from "./categories";
import { KIND_META, type Place } from "./places";
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
  /** ROADMAP R2.1 — the newsletter sponsor. Omit ⇒ use the module DIGEST_SPONSOR
   *  (null by default = no slot). Pass null explicitly to force no sponsor. */
  sponsor?: DigestSponsor | null;
  /** ROADMAP v6 1.3 — the week's featured Place (`placeOfTheWeek(now)`). Absent/
   *  null ⇒ the section renders nothing. Same for every recipient. */
  placeOfWeek?: Place | null;
  /** ROADMAP v6 1.3 — the events readers saved most this week (`selectMostSaved`).
   *  Absent/empty ⇒ nothing renders (honest emptiness). Same for every recipient. */
  mostSaved?: EventRecord[];
  /** The second half of the week (Monday onward), from `splitDigestEvents`.
   *  Absent/empty ⇒ no second section renders — honest emptiness, not an empty
   *  heading. `events` stays the primary list, so old callers are unchanged. */
  laterEvents?: EventRecord[];
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

/**
 * Split the week into what a Thursday reader actually plans around: the days
 * right in front of them, and the week after.
 *
 * WHY (Aug 2026): the email was landing 8-for-8 weekend events. Not a window bug —
 * the window has always been the full 7 days. `scoreEvent` gives weekend events a
 * hardcoded +2, so with 8 slots and ~57 weekend candidates the weekend filled every
 * slot before a single midweek event was considered. Measured on a real send:
 * weekend was 45% of the 127 available events and 100% of the picks — while
 * THURSDAY had the most events of any day (33) and never appeared.
 *
 * The fix is a QUOTA, not a re-scoring. `scoreEvent` is shared with the Instagram
 * picks (lib/content/weekly-picks), so tilting it would silently change that too;
 * reserving slots per section changes only this email. The weekend bonus still
 * does its job WITHIN each section.
 *
 * Pure. Degrades honestly: if there is nothing after Sunday, `later` is empty and
 * the caller renders no second section rather than an empty heading.
 */
export interface DigestSplit {
  /** Through the coming Sunday — the send day, plus the weekend. */
  soon: EventRecord[];
  /** The following Monday onward, still inside the 7-day window. */
  later: EventRecord[];
}

/** Chicago day key of the first Monday STRICTLY after `now` — the boundary
 *  between "the days in front of you" and "next week". Noon-anchored so a DST
 *  transition can never shift the date. Pure. */
export function nextMondayKey(now: Date): string {
  const d = new Date(`${chiDayKey(now)}T12:00:00Z`);
  const delta = ((8 - d.getUTCDay()) % 7) || 7; // Thu → +4, Sun → +1, Mon → +7
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** Pick from a rank-ordered pool, keeping the spread the single list had:
 *  at most one per venue, at most two per day. Pure. */
function pickSpread(pool: EventRecord[], limit: number, taken: Set<string>): EventRecord[] {
  const out: EventRecord[] = [];
  const venues = new Set<string>();
  const perDay = new Map<string, number>();
  for (const e of pool) {
    if (out.length >= limit) break;
    if (taken.has(e.id)) continue;
    const venue = e.venue.trim().toLowerCase();
    const day = e.start.slice(0, 10);
    if (venue && venues.has(venue)) continue;
    if ((perDay.get(day) ?? 0) >= 2) continue;
    out.push(e);
    taken.add(e.id);
    if (venue) venues.add(venue);
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }
  return out;
}

export function splitDigestEvents(
  events: EventRecord[],
  now: Date,
  opts: { total?: number; laterTarget?: number } = {},
): DigestSplit {
  const total = opts.total ?? 8;
  const laterTarget = opts.laterTarget ?? 3;

  // Reuse weeklyPicks for the window + ranking so there is ONE definition of
  // "in this week" and one ranking. `all` is already rank-ordered.
  const pool = weeklyPicks(events, now, {}).all;
  const boundary = nextMondayKey(now);
  const soonPool = pool.filter((e) => e.start.slice(0, 10) < boundary);
  const laterPool = pool.filter((e) => e.start.slice(0, 10) >= boundary);

  const taken = new Set<string>();
  // Fill "later" FIRST, up to its quota — otherwise the weekend eats the slots
  // again and we are back where we started.
  const later = pickSpread(laterPool, Math.min(laterTarget, Math.max(total - 1, 0)), taken);
  // Whatever "later" could not fill goes back to "soon", so a thin next week
  // never shrinks the email.
  const soon = pickSpread(soonPool, total - later.length, taken);

  const byDate = (a: EventRecord, b: EventRecord) => evDate(a).getTime() - evDate(b).getTime();
  return { soon: soon.sort(byDate), later: later.sort(byDate) };
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

/** HTML-escape for email templates. Exported since R2.4 — the ops digest
 *  interpolates scraped titles and raw error strings into its HTML too. */
export function esc(s: string): string {
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

export interface DigestSponsor {
  /** Rendered as "Presented by {name}". */
  name: string;
  /** Optional click-through (the sponsor's own URL). Omit for a name-only mention. */
  url?: string;
  /** One short, concrete line under the name. Optional. */
  tagline?: string;
}

/**
 * NEWSLETTER SPONSOR SLOT (Monetization R2.1).
 *
 * null ⇒ NO sponsor, and the slot renders NOTHING — no empty band, no "your ad
 * here" placeholder (honest emptiness). Set this object when a sponsor signs;
 * edit it freely like editorial copy. Always rendered under a clear "Presented
 * by" label so it can never be mistaken for an event (no dark patterns).
 *
 *   export const DIGEST_SPONSOR: DigestSponsor | null = {
 *     name: "Surly Brewing", url: "https://surlybrewing.com",
 *     tagline: "Beer hall + patio in Prospect Park.",
 *   };
 */
export const DIGEST_SPONSOR: DigestSponsor | null = null;

/** Append digest-campaign UTM params to a sponsor's own URL (attribution for them). */
function sponsorUrl(url: string): string {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}utm_source=email&utm_medium=digest&utm_campaign=sponsor`;
}

/** The sponsor band as an email table row. "" when there is no sponsor. Pure. */
export function sponsorSlotHtml(sponsor: DigestSponsor | null): string {
  if (!sponsor) return "";
  const name = sponsor.url
    ? `<a href="${sponsorUrl(sponsor.url)}" style="color:${CREAM};text-decoration:none;">${esc(sponsor.name)} &rarr;</a>`
    : esc(sponsor.name);
  const tag = sponsor.tagline
    ? `<div style="font:400 13px/1.5 Arial,Helvetica,sans-serif;color:${CREAM_DIM};margin-top:3px;">${esc(sponsor.tagline)}</div>`
    : "";
  return `
        <tr><td style="padding:14px 24px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${NAVY_CARD};border:1px solid rgba(201,169,97,0.28);border-radius:10px;">
            <tr><td style="padding:13px 16px;">
              <div style="font:600 11px/1.2 Arial,Helvetica,sans-serif;color:${GOLD};text-transform:uppercase;letter-spacing:1.5px;">Presented by</div>
              <div style="font:700 16px/1.3 Georgia,'Times New Roman',serif;color:${CREAM};margin-top:4px;">${name}</div>${tag}
            </td></tr>
          </table>
        </td></tr>`;
}

/** The sponsor block for the plain-text part. "" when there is no sponsor. Pure. */
export function sponsorSlotText(sponsor: DigestSponsor | null): string {
  if (!sponsor) return "";
  const lines = [`PRESENTED BY: ${sponsor.name}`];
  if (sponsor.tagline) lines.push(`  ${sponsor.tagline}`);
  if (sponsor.url) lines.push(`  ${sponsorUrl(sponsor.url)}`);
  return lines.join("\n");
}

// ── Place of the week (Roadmap v6 1.3 — the evergreen Places bridge) ──────────

function placeUrl(siteUrl: string, place: Place): string {
  return `${siteUrl}/places/${place.kind}?utm_source=email&utm_medium=digest#${place.slug}`;
}

/** The "Place of the week" card as an email table row. "" when null (honest
 *  emptiness — no placeholder). Pure. `place` comes from `placeOfTheWeek(now)`. */
export function placeOfWeekHtml(place: Place | null, siteUrl: string): string {
  if (!place) return "";
  const ctx = `${KIND_META[place.kind].label} · ${esc(place.city)}`;
  const href = placeUrl(siteUrl, place);
  return `
        <tr><td style="padding:16px 24px 0;">
          <div style="font:600 13px/1.2 Arial,Helvetica,sans-serif;color:${GOLD};text-transform:uppercase;letter-spacing:1.5px;">Place of the week</div>
        </td></tr>
        <tr><td style="padding:12px 24px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${NAVY_CARD};border:1px solid rgba(201,169,97,0.28);border-radius:10px;">
            <tr><td style="padding:16px 18px;">
              <div style="font:600 12px/1.2 Arial,Helvetica,sans-serif;color:${GOLD};text-transform:uppercase;letter-spacing:1px;">${ctx}</div>
              <a href="${href}" style="font:700 19px/1.3 Georgia,'Times New Roman',serif;color:${CREAM};text-decoration:none;display:block;margin:6px 0 6px;">${esc(place.name)}</a>
              <div style="font:400 14px/1.5 Arial,Helvetica,sans-serif;color:${CREAM_DIM};">${esc(place.intro)}</div>
              <a href="${href}" style="font:600 14px/1.2 Arial,Helvetica,sans-serif;color:${GOLD};text-decoration:none;display:inline-block;margin-top:10px;">See it on the map &rarr;</a>
            </td></tr>
          </table>
        </td></tr>`;
}

/** The "Place of the week" block for the plain-text part. "" when null. Pure. */
export function placeOfWeekText(place: Place | null, siteUrl: string): string {
  if (!place) return "";
  return [
    "PLACE OF THE WEEK",
    `${place.name} — ${KIND_META[place.kind].label} · ${place.city}`,
    `  ${place.intro}`,
    `  ${placeUrl(siteUrl, place)}`,
  ].join("\n");
}

// ── Most saved this week (Roadmap v6 1.3 — honest reader social proof) ────────

/** Privacy/noise floor: never surface a "most saved" event below this many saves
 *  — the block stays dark until it reflects several readers, not one identifiable
 *  person (and not statistical noise). Raise/lower as save volume grows. */
export const MOST_SAVED_MIN = 3;
const MOST_SAVED_CAP = 3;

/**
 * Resolve raw save counts (`getMostSavedCounts`) to the events to feature: only
 * those meeting `min`, present in `byId` (the current published/upcoming set — a
 * saved-then-archived or past event is silently dropped, never featured stale),
 * highest first, capped. Pure + golden-tested; honest-emptiness — returns [] when
 * thin, which renders NOTHING.
 */
export function selectMostSaved(
  counts: { id: string; saves: number }[],
  byId: Map<string, EventRecord>,
  min = MOST_SAVED_MIN,
  cap = MOST_SAVED_CAP,
): EventRecord[] {
  return counts
    .filter((c) => c.saves >= min)
    .slice()
    .sort((a, b) => b.saves - a.saves)
    .map((c) => byId.get(c.id))
    .filter((e): e is EventRecord => Boolean(e))
    .slice(0, cap);
}

/** The "Most saved this week" section as email table rows. "" when empty. Pure. */
export function mostSavedHtml(events: EventRecord[], siteUrl: string): string {
  if (events.length === 0) return "";
  const rows = events.map((e) => eventRowHtml(e, siteUrl)).join("");
  return `
        <tr><td style="padding:16px 24px 0;">
          <div style="font:600 13px/1.2 Arial,Helvetica,sans-serif;color:${GOLD};text-transform:uppercase;letter-spacing:1.5px;">Most saved this week</div>
        </td></tr>
        <tr><td style="padding:12px 24px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
        </td></tr>`;
}

/** The "Most saved this week" block for the plain-text part. "" when empty. Pure. */
export function mostSavedText(events: EventRecord[], siteUrl: string): string {
  if (events.length === 0) return "";
  return [
    "MOST SAVED THIS WEEK",
    "",
    ...events.flatMap((e) => [
      e.title,
      `  ${whenLabel(e)}`,
      `  ${[e.venue, e.city].filter(Boolean).join(" · ")} · ${e.price}`,
      `  ${eventUrl(siteUrl, e.id)}`,
      "",
    ]),
  ].join("\n");
}

export function renderDigestEmail(opts: DigestOptions): DigestData {
  const { events, weekLabel, unsubscribeUrl, siteUrl } = opts;
  // R2.1 — default to the module sponsor; a caller may pass null to force none.
  const sponsor = opts.sponsor === undefined ? DIGEST_SPONSOR : opts.sponsor;
  const saved = opts.savedThisWeek ?? [];
  const top = events[0];
  const subject =
    saved.length > 0
      ? `You saved ${saved.length === 1 ? `"${saved[0].title}"` : `${saved.length} events`} — happening this week`
      : events.length === 0
        ? "This week in the Twin Cities"
        : events.length === 1
          ? `This week: ${top.title}`
          // Count BOTH halves — the email carries them, so the subject must say so.
          : `This week in the Twin Cities: ${top.title} + ${events.length + (opts.laterEvents?.length ?? 0) - 1} more`;

  const rows = events.map((e) => eventRowHtml(e, siteUrl)).join("");
  const savedRows = saved.map((e) => eventRowHtml(e, siteUrl)).join("");

  // The week's second half. Labels are deliberately literal: the boundary IS the
  // coming Monday, so "This weekend" / "Next week" is true for every possible
  // pick rather than a flourish we'd have to caveat.
  const later = opts.laterEvents ?? [];
  const laterRows = later.map((e) => eventRowHtml(e, siteUrl)).join("");
  const weekendHeading = later.length === 0 ? "" : `
        <tr><td style="padding:16px 24px 0;">
          <div style="font:600 13px/1.2 Arial,Helvetica,sans-serif;color:${GOLD};text-transform:uppercase;letter-spacing:1.5px;">This weekend</div>
        </td></tr>`;
  const laterSection = later.length === 0 ? "" : `
        <tr><td style="padding:18px 24px 0;">
          <div style="font:600 13px/1.2 Arial,Helvetica,sans-serif;color:${GOLD};text-transform:uppercase;letter-spacing:1.5px;">Next week</div>
        </td></tr>
        <tr><td style="padding:12px 24px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${laterRows}</table>
        </td></tr>`;
  const sponsorHtml = sponsorSlotHtml(sponsor);
  const sponsorText = sponsorSlotText(sponsor);
  // v6 1.3 — evergreen Places bridge + honest reader social proof. Both are
  // global (same for everyone) and degrade to "" when absent/thin.
  const placeHtml = placeOfWeekHtml(opts.placeOfWeek ?? null, siteUrl);
  const placeText = placeOfWeekText(opts.placeOfWeek ?? null, siteUrl);
  const savedTop = opts.mostSaved ?? [];
  const mostSavedHtmlBlock = mostSavedHtml(savedTop, siteUrl);
  const mostSavedTextBlock = mostSavedText(savedTop, siteUrl);
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

  const html = `<!doctype html><html><head>${EMAIL_HEAD}</head><body style="margin:0;padding:0;background:#0a1020;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a1020;">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:${NAVY};border-radius:14px;overflow:hidden;">
        <tr><td style="padding:26px 24px 8px;">
          <div style="font:700 22px/1 Arial,Helvetica,sans-serif;color:${GOLD};letter-spacing:2px;">CITY PULSE MN</div>
          <div style="font:400 14px/1.5 Arial,Helvetica,sans-serif;color:${CREAM_DIM};margin-top:6px;">This week in the Twin Cities · ${esc(weekLabel)}</div>
        </td></tr>
        <tr><td style="padding:16px 24px 4px;">
          <div style="font:400 15px/1.6 Arial,Helvetica,sans-serif;color:${CREAM};">${saved.length > 0 ? "Your week, starting with the plans you already made." : "Here's what's worth your time across the metro this week."}</div>
        </td></tr>${sponsorHtml}${savedSection}${weekendHeading}
        <tr><td style="padding:14px 24px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
        </td></tr>${laterSection}${mostSavedHtmlBlock}${placeHtml}
        <tr><td style="padding:6px 24px 16px;">
          <a href="${siteUrl}?utm_source=email&utm_medium=digest" style="font:600 15px/1.2 Arial,Helvetica,sans-serif;color:${NAVY};background:${GOLD};text-decoration:none;display:inline-block;padding:12px 20px;border-radius:8px;">See everything on City Pulse &rarr;</a>
        </td></tr>
        <tr><td style="padding:0 24px 22px;">
          <div style="font:400 13px/1.6 Arial,Helvetica,sans-serif;color:${CREAM_DIM};">Enjoying this? Forward it to a friend — or send them <a href="${siteUrl}/this-week?utm_source=email&utm_medium=forward" style="color:${GOLD};text-decoration:underline;">citypulsemn.com/this-week</a> to get their own.</div>
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
    ...(sponsorText ? [sponsorText, ""] : []),
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
    ...(later.length > 0 ? ["THIS WEEKEND", ""] : []),
    ...events.flatMap((e) => [
      e.title,
      `  ${whenLabel(e)}`,
      `  ${[e.venue, e.city].filter(Boolean).join(" · ")} · ${e.price}`,
      `  ${eventUrl(siteUrl, e.id)}`,
      "",
    ]),
    ...(later.length > 0
      ? ["NEXT WEEK", "", ...later.flatMap((e) => [
          e.title,
          `  ${whenLabel(e)}`,
          `  ${[e.venue, e.city].filter(Boolean).join(" · ")} · ${e.price}`,
          `  ${eventUrl(siteUrl, e.id)}`,
          "",
        ])]
      : []),
    ...(mostSavedTextBlock ? [mostSavedTextBlock, ""] : []),
    ...(placeText ? [placeText, ""] : []),
    `See everything: ${siteUrl}`,
    `Enjoying this? Forward it to a friend — or send them ${siteUrl}/this-week to get their own.`,
    "",
    `Unsubscribe: ${unsubscribeUrl}`,
    "City Pulse MN · Twin Cities, Minnesota",
  ];

  return { subject, html, text: textLines.join("\n") };
}
