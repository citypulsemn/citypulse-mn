/**
 * TITLE & FIELD HYGIENE (roadmap 4.7).
 *
 * Research agents embed metadata in titles — the venue, the schedule, format
 * tags, promo riders — because that's how the source page phrased it:
 *
 *   "Utepils Brewing Free Meat & Cheese Raffle (Weekly Tuesdays)"
 *   "Marketfest at Manitou Days — Weekly Thursdays (July 16)"
 *   "In the Heights (Artistry / Bloomington Center for the Arts)"
 *   "Trail of Small Wonders (Exhibition)"
 *   "Minnesota Twins vs. Los Angeles Angels – Beach Tote Bag Giveaway"
 *
 * A title should carry the event's NAME; the structured fields already hold
 * everything else. This module cleans titles for DISPLAY, at the read path:
 *
 * WHY READ-PATH, NOT INGEST: the dedup key canonicalizer strips *trailing*
 * parens before hashing (so those are key-safe), but mid-title parens and
 * dash-suffixes are hashed as-is. Rewriting stored titles would change future
 * keys and duplicate events on the next re-find. Cleaning on read gives every
 * consumer (cards, detail, digest, .ics, JSON-LD, OG images) clean titles from
 * one choke point, with zero key risk, no backfill, and the raw title kept in
 * the database as provenance.
 *
 * THE PRIME RULE: strip only RECOGNIZED noise; when unsure, keep. "(COSA Fest)"
 * is an alias, "(World Premiere)" is information, "– Weekend 1" distinguishes
 * two real weekends. Every judgment call lives in the golden tests.
 */

const MONTHS_RE =
  "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";

/** Schedule noise: "Weekly Tuesdays", "Every Friday", "July 16", "through Sep 22", "Ongoing". */
const SCHEDULE_RE = new RegExp(
  String.raw`^(?:` +
    String.raw`(?:weekly|daily|every|each)\s+\w+` + // Weekly Tuesdays / Every Friday
    String.raw`|(?:mondays|tuesdays|wednesdays|thursdays|fridays|saturdays|sundays)` +
    String.raw`|(?:${MONTHS_RE})\.?\s+\d{1,2}(?:\s*[-–—]\s*\d{1,2})?` + // July 16 / Jul 5-7
    String.raw`|(?:through|thru|until|starts?|opens?)\s+.+` +
    String.raw`|ongoing(?:\s+.+)?` +
    String.raw`|(?:${MONTHS_RE})\s+run` + // "September run"
    String.raw`|\d{4}(?:\s*[-–—]\s*\d{4})?\s+season.*` +
    String.raw`)$`,
  "i",
);

/** Pure format tags that add nothing a category chip doesn't. */
const FORMAT_TAG_RE =
  /^(?:exhibition|exhibit|screening|film screening|touring|matinee|rooftop|artist[- ]designed|ongoing exhibition|immersive exhibit)$/i;

/** Dash-suffix promo riders: giveaways and sponsor tails on sports/music listings. */
const PROMO_RE =
  /\b(?:giveaway|bobblehead|presented by|sponsored by|fan appreciation|theme night)\b/i;

/** Token-overlap: does the paren content mostly name the event's own venue/city? */
function namesOwnPlace(content: string, venue: string, city: string): boolean {
  const tokens = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2 && !["the", "and", "for", "at"].includes(w)),
    );
  const c = tokens(content);
  if (c.size === 0) return false;
  const place = new Set([...tokens(venue), ...tokens(city)]);
  let hit = 0;
  for (const w of c) if (place.has(w)) hit++;
  return hit / c.size >= 0.6; // most of the paren names the place we already show
}

function isNoiseParen(content: string, venue: string, city: string): boolean {
  const c = content.trim();
  return (
    SCHEDULE_RE.test(c) ||
    FORMAT_TAG_RE.test(c) ||
    namesOwnPlace(c, venue, city)
  );
}

/**
 * Clean a title for display. Conservative by construction: unrecognized
 * parentheticals and dash-segments are kept, and if cleaning guts the title
 * the original is returned.
 */
export function cleanEventTitle(title: string, venue = "", city = ""): string {
  let t = (title ?? "").trim();
  if (!t) return t;

  // 1) Remove recognized-noise parentheticals (anywhere in the title).
  t = t.replace(/\s*\(([^()]*)\)/g, (whole, content: string) =>
    isNoiseParen(content, venue, city) ? "" : whole,
  );

  // 2) Remove a dash-suffix ONLY when it's schedule or promo noise.
  //    "– Weekend 1" and "– Opening Day" are information and stay.
  const dash = t.match(/^(.*?)\s+[–—-]\s+([^–—-]+)$/);
  if (dash) {
    const tail = dash[2].trim();
    if (SCHEDULE_RE.test(tail) || PROMO_RE.test(tail)) t = dash[1].trim();
  }

  // 3) Normalize spaced dashes to a single style (en dash), leaving
  //    hyphenated words ("Artist-Designed") untouched.
  t = t.replace(/\s+[—-]\s+/g, " – ");

  // 4) Tidy leftovers: doubled spaces, orphaned trailing separators.
  t = t.replace(/\s{2,}/g, " ").replace(/[\s–—:,-]+$/g, "").trim();

  // Safety valve: never return a gutted title.
  if (t.length < 4) return title.trim();
  return t;
}

/**
 * Canonical city display: "Saint Paul", "St Paul", and "St. Paul" all render
 * as "St. Paul" (the live site showed two forms on one page). Area matching is
 * unaffected — lib/areas.ts normalizes periods and saint/st on its side.
 */
export function displayCity(city: string): string {
  const c = (city ?? "").trim();
  return c.replace(/^(?:saint|st\.?)\s+/i, "St. ");
}
