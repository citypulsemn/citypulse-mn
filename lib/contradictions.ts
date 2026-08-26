import { foldTitle } from "./canonicalize";

/**
 * THINGS THE CALENDAR CAN CATCH BY LOOKING AT ITSELF.
 *
 * Both importers (sports, music) verify against an outside source. That only
 * works where an outside source exists — and 620 listings across arts, family,
 * festival, food and weird have none. This module needs no source at all: it
 * asks whether the calendar contradicts ITSELF.
 *
 * The idea is owed to the Aug 2026 sports incident. On 14 September the site
 * advertised a Yankees game at 6:40 and an Orioles game at 7:10, both at Target
 * Field. No feed was required to know one of them was false — a stadium holds
 * one game. That query costs nothing and would have caught it in June, months
 * before a reader did.
 *
 * TWO FINDINGS, because they are two different jobs:
 *   - `duplicate`  same event listed twice under different titles. A dedupe
 *                  problem: nothing is false, the calendar just repeats itself.
 *   - `conflict`   two DIFFERENT things claimed in one room at one time. A
 *                  truth problem: at most one of them is happening.
 *
 * Nothing here changes any data. It is an instrument, and it reports.
 */

// ── Inputs ───────────────────────────────────────────────────────────────────

export interface CalendarRow {
  id: string;
  venue: string;
  title: string;
  /** Chicago wall clock, "YYYY-MM-DDTHH:MM". */
  start: string;
  category: string;
  /** Confirmed against a primary source (a league feed, a venue calendar). */
  verified?: boolean;
}

export interface FindingSide {
  id: string;
  title: string;
  /** "HH:MM" */
  at: string;
}

export interface Finding {
  kind: "duplicate" | "conflict";
  venue: string;
  day: string;
  category: string;
  minutesApart: number;
  a: FindingSide;
  b: FindingSide;
}

export interface ContradictionReport {
  duplicates: Finding[];
  conflicts: Finding[];
  /** Listings whose venue is a placeholder rather than a place. */
  placeholderVenues: { id: string; title: string; venue: string; day: string }[];
  /** Pairs skipped because the venue runs concurrent programming, with why. */
  skipped: { venue: string; pairs: number }[];
}

// ── Rules ────────────────────────────────────────────────────────────────────

/**
 * How close two starts must be before one room can't hold both.
 *
 * Four hours. It has to be a window rather than an exact match, because the
 * case that started this — Yankees 18:40 beside Orioles 19:10 — is thirty
 * minutes apart, and an exact-time check sails straight past it. Four hours also
 * leaves a real matinee/evening pair alone: a 2 PM and a 7:30 PM performance are
 * 5.5 hours apart and both true.
 */
export const CLASH_WINDOW_MINUTES = 4 * 60;

/**
 * Venues that genuinely run several things at once, where an overlap is not a
 * contradiction: multi-stage houses, campuses, and rooms that programme an early
 * show and a late one.
 *
 * This list SUPPRESSES findings, so it stays short and every entry earns its
 * place. Skipped pairs are counted and reported rather than silently dropped —
 * an allowlist that hides its own effect is how a check quietly stops working.
 */
export const CONCURRENT_VENUES: Record<string, string> = {
  // Campuses: general admission runs alongside specific programming all day.
  "como park zoo conservatory": "zoo campus — admission runs alongside programmes",
  "minnesota zoo": "zoo campus",
  "minnesota state fair": "fairgrounds — dozens of simultaneous stages",
  "minnesota state fairgrounds": "fairgrounds — dozens of simultaneous stages",
  "nickelodeon universe mall of america": "indoor park inside a mall",
  "mall of america": "mall — concurrent events by design",
  "science museum of minnesota": "museum — exhibits plus programmes",
  "walker art center": "museum — galleries plus performances",
  "minneapolis institute of art": "museum — galleries plus programmes",
  // Multi-stage theatres.
  "chanhassen dinner theatres": "main stage plus the Studio Theatre",
  "guthrie theater": "Wurtele, McGuire and Dowling run concurrently",
  "childrens theatre company": "two stages",
  "ordway center for the performing arts": "Music Theater plus Concert Hall",
  // Rooms that book an early show and a late one on the same night.
  // Matching is EXACT, so a venue string that names a specific room needs its
  // own entry. That is deliberate: "Guthrie Theater" is a three-stage complex,
  // but "Guthrie Theater – Wurtele Thrust Stage" is one room, and two shows in
  // it at 1 PM is a real finding we must not suppress.
  "berlin": "early set, late set and an open jam most nights",
  "berlin minneapolis": "early set, late set and an open jam most nights",
  "icehouse": "early and late sets",
  "dakota jazz club": "two seatings a night",
  "crooners supper club": "multiple rooms, multiple seatings",
};

/**
 * Venue strings that name no place. "TBD" is not a venue; a listing carrying one
 * cannot be acted on by a reader, which makes it the same class of problem as an
 * invented time.
 */
const PLACEHOLDER_VENUE = /^(tbd|tba|various|various locations?|multiple venues?|to be announced|n\/?a|unknown|online|virtual)$/;

const norm = (s: string) => foldTitle(s).replace(/\s+/g, " ").trim();

/** Words that carry no identity, so they must not make two titles look alike. */
const NOISE = new Set([
  "the", "a", "an", "and", "at", "in", "of", "on", "for", "with", "to",
  "event", "events", "show", "shows", "live", "night", "day", "weekend",
  "presents", "featuring", "feat", "special", "annual", "series",
]);

function tokens(title: string): Set<string> {
  return new Set(
    norm(title).split(" ").filter((t) => t && !NOISE.has(t) && t.length > 1),
  );
}

/**
 * Are these two titles plausibly the SAME event written twice?
 *
 * Deliberately conservative in the direction that matters: when unsure, we call
 * it a CONFLICT rather than a duplicate, because a conflict gets a human's
 * attention and a duplicate is comparatively benign. Calling a real conflict a
 * duplicate would file "two different bands in one room" under housekeeping.
 */
export function looksLikeSameEvent(a: string, b: string): boolean {
  const na = norm(a);
  const nb = norm(b);
  if (na && na === nb) return true;
  // One title containing the other whole ("Dan Israel" inside "Free Music in
  // the Parks – Dan Israel") is the commonest duplicate shape on this site.
  if (na.length >= 6 && nb.length >= 6 && (na.includes(nb) || nb.includes(na))) return true;

  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.size || !tb.size) return false;
  const shared = [...ta].filter((t) => tb.has(t));
  if (!shared.some((t) => t.length >= 4)) return false;
  const smaller = Math.min(ta.size, tb.size);
  const larger = Math.max(ta.size, tb.size);
  // Both directions must agree. Requiring only the smaller side to be covered
  // would let a one-word title dissolve into any longer bill that contains it,
  // which is exactly how a genuine clash gets mislabelled as housekeeping.
  return shared.length / smaller >= 0.6 && shared.length / larger >= 0.4;
}

const minutesOf = (wall: string) =>
  Number(wall.slice(11, 13)) * 60 + Number(wall.slice(14, 16));

/**
 * Find every place the calendar disagrees with itself.
 *
 * Pure. Takes the rows, returns findings, changes nothing.
 */
export function findContradictions(rows: CalendarRow[]): ContradictionReport {
  const duplicates: Finding[] = [];
  const conflicts: Finding[] = [];
  const placeholderVenues: ContradictionReport["placeholderVenues"] = [];
  const skippedCount = new Map<string, number>();

  // Group by venue + Chicago day. Grouping on the venue STRING, not a
  // canonical form: two spellings of one room are their own bug (the dedupe
  // pass), and folding them here would hide it behind a clash report.
  const groups = new Map<string, CalendarRow[]>();
  for (const r of rows) {
    const day = r.start.slice(0, 10);
    if (PLACEHOLDER_VENUE.test(norm(r.venue))) {
      placeholderVenues.push({ id: r.id, title: r.title, venue: r.venue, day });
      continue; // a non-place can't clash with anything
    }
    const key = `${r.venue}|${day}`;
    const list = groups.get(key);
    if (list) list.push(r);
    else groups.set(key, [r]);
  }

  for (const [key, list] of groups) {
    if (list.length < 2) continue;
    const [venue, day] = [key.slice(0, key.lastIndexOf("|")), key.slice(key.lastIndexOf("|") + 1)];
    const concurrent = CONCURRENT_VENUES[norm(venue)];

    const sorted = [...list].sort((x, y) => x.start.localeCompare(y.start));
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i];
        const b = sorted[j];
        const apart = Math.abs(minutesOf(b.start) - minutesOf(a.start));
        if (apart > CLASH_WINDOW_MINUTES) continue;
        if (concurrent) {
          skippedCount.set(venue, (skippedCount.get(venue) ?? 0) + 1);
          continue;
        }
        const kind = looksLikeSameEvent(a.title, b.title) ? "duplicate" : "conflict";

        // Two DIFFERENT things, both confirmed against a primary source, are not
        // a contradiction — they are a room that runs concurrent programming and
        // we simply hadn't noticed. The Turf Club books three acts some nights;
        // Fine Line follows a show with a club night. The venue's own calendar
        // says so, so the calendar isn't disagreeing with itself.
        //
        // This is what keeps CONCURRENT_VENUES from growing forever: every venue
        // we bring under a primary source stops needing an entry. It suppresses
        // only conflicts — two verified rows with near-identical titles are still
        // worth reporting as a duplicate.
        if (kind === "conflict" && a.verified && b.verified) {
          skippedCount.set(venue, (skippedCount.get(venue) ?? 0) + 1);
          continue;
        }

        const finding: Finding = {
          kind,
          venue,
          day,
          category: a.category,
          minutesApart: apart,
          a: { id: a.id, title: a.title, at: a.start.slice(11, 16) },
          b: { id: b.id, title: b.title, at: b.start.slice(11, 16) },
        };
        (kind === "duplicate" ? duplicates : conflicts).push(finding);
      }
    }
  }

  const order = (f: Finding) => f.day + f.venue;
  duplicates.sort((x, y) => order(x).localeCompare(order(y)));
  // Conflicts first by how tight the clash is — same minute is the least
  // deniable — then by date.
  conflicts.sort((x, y) => x.minutesApart - y.minutesApart || order(x).localeCompare(order(y)));

  return {
    duplicates,
    conflicts,
    placeholderVenues: placeholderVenues.sort((p, q) => p.day.localeCompare(q.day)),
    skipped: [...skippedCount]
      .map(([venue, pairs]) => ({ venue, pairs }))
      .sort((p, q) => q.pairs - p.pairs),
  };
}

/**
 * One line per finding, for the ops digest and the CLI. Kept here so the email
 * and the terminal can never drift into describing the same finding differently.
 */
export function formatFinding(f: Finding): string {
  const when = f.minutesApart === 0 ? `both ${f.a.at}` : `${f.a.at} vs ${f.b.at}`;
  return `${f.day} · ${f.venue} (${when}): "${trim(f.a.title)}" / "${trim(f.b.title)}"`;
}

function trim(s: string, n = 44): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
