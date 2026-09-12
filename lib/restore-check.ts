/**
 * SECOND PASS ON A DRAFTED LISTING: what is the real date, if any?
 *
 * The verify pass answers "is our listing right" and it is good at that — on
 * 10 Sep 2026 the `wrong_event` verdicts it produced were correct in all eight
 * cases checked by hand against the organiser. So 130 listings were drafted.
 *
 * This asks the different, harder question: what SHOULD they say? A drafted
 * listing is a real event we have lost until someone finds its actual date, and
 * 98 of them were left needing exactly that.
 *
 * WHY IT IS ITS OWN PASS, WITH ITS OWN RULES. The `moved` verdicts from the
 * same backfill proposed a corrected TIME, and the one checked by hand was
 * wrong: Waiting for Godot plays 2:30 and 7:30, the agent said 7:00, and
 * applying it would have broken a correct row. The lesson is not "the agent is
 * unreliable" — it is that finding a date on an organiser's page is a different
 * job from picking the right showtime out of several, and the second one needs
 * to be allowed to fail loudly.
 *
 * Hence: the date and the time are reported SEPARATELY, and a corrected date
 * with an unconfirmed time is applied without stamping `verified_at`.
 */

import { isAggregatorSource, isNonScheduleSource } from "./source-trust";
import { venueIsUnknown } from "./venue-quality";

export interface RestoreItem {
  id: string;
  title: string;
  venue: string;
  city: string;
  /** What we had, wall-clock, before it was drafted. */
  was: string;
  /** What the verify pass said was wrong with it. */
  evidence: string;
}

export type RestoreOutcome = "corrected" | "not_happening" | "unclear";

export interface RestoreResult {
  id: string;
  outcome: RestoreOutcome;
  /** Wall-clock "YYYY-MM-DDTHH:MM". Only meaningful when outcome is corrected. */
  start?: string;
  /** Did the organiser actually publish that time, or is it inherited? */
  timeConfirmed?: boolean;
  /** The organiser page the answer came from. Required to act. */
  sourceUrl?: string;
  /** The venue, when the organiser names one. Required to republish a row whose
   *  own venue admits it is unknown — otherwise we would put the map pin back. */
  venue?: string;
  note?: string;
}

const WALL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/**
 * A real wall-clock date, not just the right shape. The regex alone accepts
 * "2026-13-99T99:99" — every field is two digits — so it is checked against the
 * calendar and made to round-trip. A month-13 date reaching Postgres would
 * throw mid-batch; one that silently coerced would be worse.
 */
function isRealWallClock(s: string): boolean {
  if (!WALL.test(s)) return false;
  const [date, time] = s.split("T");
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return false;
  const probe = new Date(Date.UTC(y, mo - 1, d, h, mi));
  // Round-trip catches the overflow cases the range check misses (Feb 31).
  return (
    probe.getUTCFullYear() === y &&
    probe.getUTCMonth() === mo - 1 &&
    probe.getUTCDate() === d
  );
}

export function buildRestorePrompt(items: RestoreItem[]): string {
  const list = items
    .map(
      (i) =>
        `- id: ${i.id}\n  listing: ${i.title} @ ${i.venue}, ${i.city}\n  we had: ${i.was}\n  why it was pulled: ${i.evidence.slice(0, 240)}`,
    )
    .join("\n");

  return `You are a CORRECTION agent for City Pulse MN, a Twin Cities events calendar.

Each listing below was taken down because a check found the organiser's own page contradicts it. We would like to put the real event back. Your job is to find what the ORGANISER says, and report it.

${list}

GO TO THE ORGANISER. The venue's own website, the festival's own site, the theatre's own calendar, the official ticketing page. A roundup article, a "things to do this weekend" list, a chamber-of-commerce round-up or an aggregator is NOT the organiser — those are what put the wrong date there in the first place. If the only thing you can find is an aggregator, that is "unclear".

For EACH listing, exactly one outcome:

- "corrected"     — the organiser publishes this event, and you found its real date. Give "start" as "YYYY-MM-DDTHH:MM" wall clock, local time. Give "source_url" — the ORGANISER's page you read it on. Set "time_confirmed": true ONLY if the organiser actually states a start time. If the page gives a date but no time, still use "corrected", put the date with the time we had, and set "time_confirmed": false.
- "not_happening" — the organiser's schedule covers this period and this event is not in it. A finished run from a previous season counts here: if a show ran Oct 2025 to Feb 2026, it is not happening in Oct 2026. Give "source_url" and say in "note" what the organiser's schedule actually shows.
- "unclear"       — you could not reach the organiser, or they publish nothing that settles it. This is a perfectly good answer and it is much better than a guess.

THE VENUE. Some of these were pulled not because the date was wrong but because
the listing could not say WHERE the event is — its venue field reads "TBD",
"(specific venue TBD)" or "Various Locations". Look at the "listing:" line: if
the venue there admits it is unknown, this listing CANNOT come back without a
real place, so give "venue" with the name the organiser publishes (a hall, a
park, a church, a street with blocks named). A city name is not a venue. If the
organiser does not name a place either, use "unclear" — do not invent one, and
do not repeat the hedge back to us.

RULES THAT MATTER MORE THAN COVERAGE:
- A DATE YOU DID NOT READ ON THE ORGANISER'S PAGE IS A GUESS. Never infer one from a pattern ("it's usually the second weekend"), from last year, or from a similar event. If you did not read it, the outcome is "unclear".
- MULTI-DAY EVENTS: give the FIRST day. Do not invent an end.
- MULTIPLE SHOWTIMES: if the organiser lists several times that day, that is exactly the case where a wrong pick does damage. Give the date, set "time_confirmed": false, and say in "note" what the times were.
- A RECURRING SERIES IS NOT ONE EVENT: if the organiser shows a run of dates, give the first one on or after today and say so in the note.

Output ONLY a JSON array inside a single \`\`\`json code block:
[{"id":"...","outcome":"corrected","start":"2026-10-10T10:00","time_confirmed":false,"source_url":"https://…","venue":"Carpenter Nature Center","note":"organiser lists Oct 10-11; no time published"},
 {"id":"...","outcome":"not_happening","source_url":"https://…","note":"that run ended Feb 2026"},
 {"id":"...","outcome":"unclear","note":"organiser site unreachable"}]`;
}

/**
 * Parse the reply. Anything malformed, unknown, or missing its evidence becomes
 * `unclear` — never a correction. An id we did not ask about is dropped.
 */
export function parseRestoreResults(text: string, asked: Set<string>): RestoreResult[] {
  const fenced = /```json\s*([\s\S]*?)```/i.exec(text);
  let parsed: unknown;
  try {
    parsed = JSON.parse((fenced ? fenced[1] : text).trim());
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const out: RestoreResult[] = [];
  const seen = new Set<string>();
  for (const raw of parsed) {
    const o = raw as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id : "";
    if (!asked.has(id) || seen.has(id)) continue;
    seen.add(id);

    const note = typeof o.note === "string" ? o.note.trim() : undefined;
    const sourceUrl = typeof o.source_url === "string" && /^https?:\/\//.test(o.source_url) ? o.source_url : undefined;
    const outcome = o.outcome;

    if (outcome === "corrected") {
      const start = typeof o.start === "string" ? o.start.trim() : "";
      // A correction without a readable date, or without the page it came from,
      // is not a correction. NO DEFAULT — this is where a fabricated date would
      // enter the database.
      if (!isRealWallClock(start) || !sourceUrl) {
        out.push({ id, outcome: "unclear", note: note ?? "correction missing a valid date or an organiser URL", sourceUrl });
        continue;
      }
      const venue = typeof o.venue === "string" && o.venue.trim() !== "" ? o.venue.trim() : undefined;
      out.push({ id, outcome: "corrected", start, timeConfirmed: o.time_confirmed === true, sourceUrl, venue, note });
      continue;
    }
    if (outcome === "not_happening") {
      // Removing a listing for good needs the page that says so.
      if (!sourceUrl) {
        out.push({ id, outcome: "unclear", note: note ?? "not_happening without an organiser URL", sourceUrl });
        continue;
      }
      out.push({ id, outcome: "not_happening", sourceUrl, note });
      continue;
    }
    out.push({ id, outcome: "unclear", note, sourceUrl });
  }
  return out;
}

/** What the caller should do. Kept separate from parsing so the policy is testable. */
export type RestoreAction =
  | {
      kind: "republish";
      id: string;
      start: string;
      sourceUrl: string;
      stampVerified: boolean;
      /** Set only when the organiser named a venue and we needed one. */
      venue?: string;
    }
  | { kind: "archive"; id: string; sourceUrl: string; note: string }
  | { kind: "leave"; id: string; note: string };

export interface RestorePolicyOpts {
  /** Today, for the sanity window. */
  now: Date;
  /** The row as it stands. Needed because a listing drafted for having no venue
   *  must not be republished still having no venue. */
  current?: { venue?: string | null; city?: string | null };
  /** Corrections further out than this are treated as suspect. */
  maxDaysAhead?: number;
}

export function actionForRestore(r: RestoreResult, opts: RestorePolicyOpts): RestoreAction {
  const maxDays = opts.maxDaysAhead ?? 400;
  if (r.outcome === "not_happening") {
    return { kind: "archive", id: r.id, sourceUrl: r.sourceUrl!, note: r.note ?? "organiser's schedule does not include it" };
  }
  if (r.outcome === "corrected") {
    // Defence in depth: the parser guarantees both, but this function is the
    // one that writes to a live row, so it re-checks rather than trusting.
    if (!r.start || !isRealWallClock(r.start) || !r.sourceUrl) {
      return { kind: "leave", id: r.id, note: "corrected result missing a valid date or an organiser URL" };
    }
    const t = Date.parse(`${r.start}:00`);
    if (!Number.isFinite(t)) return { kind: "leave", id: r.id, note: "unparseable corrected date" };
    const days = (t - opts.now.getTime()) / 86_400_000;
    // A date in the past is not a correction, and one years out is a misread.
    if (days < 0) return { kind: "leave", id: r.id, note: `corrected date ${r.start} is in the past` };
    if (days > maxDays) return { kind: "leave", id: r.id, note: `corrected date ${r.start} is more than ${maxDays} days out` };
    // A row drafted because it could not say WHERE must not come back still
    // unable to say where. The restore pass corrects dates; if the reason this
    // listing was pulled was the venue, a right date does not fix it — and
    // republishing would put back the map pin and the Directions button aimed
    // at a coordinate the listing calls unknown. See lib/venue-quality.ts.
    // Only when the caller told us the row. Absent `current`, this function has
    // no opinion on venues — treating "not told" as "no venue" would refuse
    // every caller that only cares about dates.
    const hadNoVenue = opts.current ? venueIsUnknown(opts.current.venue, opts.current.city) : false;
    const gotVenue = r.venue && !venueIsUnknown(r.venue, opts.current?.city) ? r.venue : undefined;
    if (hadNoVenue && !gotVenue) {
      return {
        kind: "leave",
        id: r.id,
        note: "still no venue — the organiser did not name a place, so this would republish a listing that cannot say where to go",
      };
    }

    return {
      kind: "republish",
      id: r.id,
      start: r.start!,
      sourceUrl: r.sourceUrl!,
      venue: gotVenue,
      // Only a time the organiser actually printed earns the stamp. A date-only
      // correction goes back with the time it had and stays unverified, so the
      // next pass looks again — that is the Waiting for Godot lesson.
      //
      // And the stamp also requires a source that IS a published schedule. A
      // Yelp page, a venue Facebook post or a Ticketmaster listing is fine to
      // cite and fine to take a date from — it is not a schedule, so it cannot
      // make a row "verified". Three rows got that stamp before this existed.
      stampVerified:
        r.timeConfirmed === true &&
        !isNonScheduleSource(r.sourceUrl) &&
        !isAggregatorSource(r.sourceUrl),
    };
  }
  return { kind: "leave", id: r.id, note: r.note ?? "unclear" };
}
