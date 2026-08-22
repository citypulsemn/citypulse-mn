/**
 * VENUE CALENDARS — the primary-source importer for music (Aug 2026).
 *
 * The sports importer (lib/sports-feed.ts) fixed the category where a stranger
 * could instantly tell we were wrong. Music is the category where nobody could:
 * 220 upcoming listings, ONE of them ever verified against anything.
 *
 * WHY THIS IS HARDER THAN SPORTS. There is no league. There is no single feed.
 * Every room publishes its own calendar in its own markup, and three things that
 * were free in sports have to be earned here:
 *
 *   1. A day is not a key. A team plays at most one home game a night; First
 *      Avenue routinely runs the Mainroom and the Entry simultaneously, and a
 *      room can host an early and a late show. Listings key on (venue, day) and
 *      resolve to a LIST, then match on title.
 *   2. Titles are messy. "GCW presents RUDE AWAKENING" is our "Rude Awakening";
 *      "Alabama Shakes – Night 1" is their "Alabama Shakes". Exact matching is
 *      hopeless, so matching is fuzzy — and because it is fuzzy it is never
 *      allowed to be the reason something gets hidden. See the verdicts below.
 *   3. A venue calendar is authoritative only about ITS OWN rooms. First Avenue
 *      also promotes shows at the Armory and the Cedar; their absence from a
 *      First Avenue page says nothing about those buildings.
 *
 * THE SAFETY VALVE, and the reason this module has a verdict sports doesn't:
 *   - venue+day has NO shows at all → `phantom`. Strong evidence, safe to hide.
 *   - venue+day has shows, none match our title → `unmatched`. That is far more
 *     likely to be our fuzzy matcher failing than the venue forgetting a show,
 *     so it is FLAGGED FOR A HUMAN and nothing is touched.
 *
 * Pure: no network, no database, no clock. The script does the I/O.
 */

// ── Shapes ───────────────────────────────────────────────────────────────────

export interface VenueShow {
  /** Chicago day key, "YYYY-MM-DD". */
  day: string;
  /** Venue name exactly as the calendar prints it ("7th St Entry"). */
  venue: string;
  title: string;
  /** The venue's own page for this show — our attestation. */
  url: string;
  /** "HH:MM" once the detail page has been read; absent until then. */
  time?: string;
}

export interface ExistingShow {
  id: string;
  day: string;
  venue: string;
  title: string;
}

export type ShowVerdict =
  /** Found on the venue's own calendar that night. */
  | { kind: "ok"; id: string; title: string; url: string }
  /**
   * The show is real, but not where or when we say. The same act appears on the
   * calendar at another room or on another date — Altın Gün was on our site at
   * First Avenue when the calendar had it at Fine Line the same night. This is
   * the STRONGEST negative we get: we aren't inferring absence, we're looking at
   * the show somewhere else, and the right version gets created in the same pass.
   */
  | { kind: "moved"; id: string; title: string; actual: { day: string; venue: string } }
  /** The venue lists NOTHING that night. The listing describes nothing. */
  | { kind: "phantom"; id: string; title: string }
  /** The venue has shows that night but none we can match. Human decides. */
  | { kind: "unmatched"; id: string; title: string; alternatives: string[] }
  /** Outside the calendar's coverage, or a room it doesn't speak for. */
  | { kind: "unknown"; id: string; title: string };

export interface MusicPlan {
  verdicts: ShowVerdict[];
  /** Shows on the venue's calendar that we don't list at all. */
  missing: VenueShow[];
  window: { from: string; to: string } | null;
}

// ── Parsing ──────────────────────────────────────────────────────────────────

/** "2026-08-1" → "2026-08-01". Their day anchors don't zero-pad. */
export function padDay(raw: string): string {
  const m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return raw;
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}

const stripTags = (s: string) =>
  s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&#0?38;/g, "&").replace(/&#8217;/g, "'").replace(/\s+/g, " ").trim();

/**
 * First Avenue's month page. Their markup gives us the two things that matter
 * unambiguously: `<div id="day-YYYY-M-D">` anchors before each day's shows, and
 * a `venue_name` inside every `show_list_item`. We never infer a date.
 *
 * The venue block appears twice per show (a mobile and a desktop copy); we take
 * the first, which is why this walks blocks rather than globbing the page.
 */
export function parseFirstAvenueMonth(html: string): VenueShow[] {
  const flat = html.replace(/\s+/g, " ");
  const re =
    /<div id="day-(\d{4}-\d{1,2}-\d{1,2})">|<div class="show_list_item"[^>]*>([\s\S]*?)(?=<div class="show_list_item"|<div id="day-|$)/g;
  const out: VenueShow[] = [];
  let m: RegExpExecArray | null;
  let day: string | null = null;
  while ((m = re.exec(flat))) {
    if (m[1]) {
      day = padDay(m[1]);
      continue;
    }
    if (!day) continue; // a show before any day anchor has no date we can trust
    const block = m[2] ?? "";
    const venue = (block.match(/<div class="venue_name">\s*([^<]+?)\s*<\/div>/) ?? [])[1];
    const anchor = block.match(/<h4[^>]*>\s*<a href="([^"]+)">([\s\S]*?)<\/a>/);
    if (!venue || !anchor) continue;
    // Their headings sometimes put the presenter on its own line —
    // "<em>GCW presents</em><br>RUDE AWAKENING". Where that structure exists the
    // show's own name is what follows the break. Where it doesn't (most of the
    // time) we keep the venue's title verbatim rather than guessing at grammar.
    const raw = anchor[2];
    const afterBreak = raw.split(/<br\s*\/?>/i).pop() ?? raw;
    const title = stripTags(afterBreak) || stripTags(raw);
    if (!title) continue;
    out.push({ day, venue: stripTags(venue), title, url: anchor[1] });
  }
  return out;
}

/**
 * Show time from a First Avenue event page ("Doors Open 7PM / Show Starts 8PM").
 *
 * Prefers the SHOW time over doors — doors is when you may enter, not when the
 * thing starts. Returns null rather than guessing; the caller stores a null time
 * as all-day rather than inventing one (rule 6, and the sports TBD lesson).
 */
export function parseFirstAvenueTime(html: string): string | null {
  const flat = html.replace(/\s+/g, " ").replace(/<[^>]+>/g, "|").replace(/(\|\s*)+/g, "|");
  const show = flat.match(/Show Starts\s*\|\s*([0-9]{1,2})(?::([0-9]{2}))?\s*(AM|PM)/i);
  const doors = flat.match(/Doors Open\s*\|\s*([0-9]{1,2})(?::([0-9]{2}))?\s*(AM|PM)/i);
  const hit = show ?? doors;
  if (!hit) return null;
  let hour = Number(hit[1]);
  const min = hit[2] ?? "00";
  const mer = hit[3].toUpperCase();
  if (Number.isNaN(hour) || hour < 1 || hour > 12) return null;
  if (mer === "PM" && hour !== 12) hour += 12;
  if (mer === "AM" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${min}`;
}

// ── Title matching ───────────────────────────────────────────────────────────

/**
 * Words that carry no identity. Presenter framing ("X presents"), night markers
 * and support-act glue all vary between our listing and the venue's, so they
 * must not count for or against a match.
 */
const NOISE = new Set([
  "the", "a", "an", "and", "with", "presents", "present", "presented", "by",
  "featuring", "feat", "ft", "live", "tour", "night", "show", "concert", "at",
  "in", "of", "plus", "special", "guest", "guests", "on", "for", "an", "one",
]);

/**
 * Fold a title to comparable ASCII.
 *
 * Live music is full of names a naive [^a-z] filter destroys: Altın Gün became
 * "alt n", Eivør became "eiv r", Mon Rovîa became "mon rov a" — so each of them
 * failed to match ITSELF and was hidden-and-re-added on every run. NFD handles
 * the decomposable accents; the map covers the letters Unicode won't split.
 */
const TRANSLIT: Record<string, string> = {
  ı: "i", ø: "o", Ø: "o", ł: "l", æ: "ae", œ: "oe", ß: "ss",
  đ: "d", ð: "d", þ: "th", ħ: "h", ŋ: "n", ſ: "s",
};

export function foldTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[ıøØłœæßđðþħŋſ]/g, (c) => TRANSLIT[c] ?? c)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(title: string): string[] {
  return foldTitle(title)
    .split(/\s+/)
    .filter((t) => t && !NOISE.has(t) && !/^\d{1,2}$/.test(t));
}

/**
 * Do these two titles plausibly name the same show?
 *
 * Containment, not equality: the venue's title and ours are usually the same act
 * wrapped in different amounts of promotional text, so we ask whether the
 * SHORTER title's meaningful words are mostly present in the longer one. At
 * least one shared word must be distinctive (4+ characters), so "Night 2" and
 * "Live Show" can't match each other on filler alone.
 *
 * Deliberately generous. A false match costs us a verified stamp on the wrong
 * row; a false MISS costs nothing destructive, because an unmatched listing is
 * flagged for a person rather than hidden.
 */
export function showTitlesMatch(a: string, b: string): boolean {
  // Same title, same show. Checked first because the token rules below demand a
  // 4-character word to be sure of themselves, and plenty of bands are called
  // things like L7 or RAV — which used to mean a listing couldn't match itself.
  const fa = foldTitle(a);
  const fb = foldTitle(b);
  if (fa && fa === fb) return true;

  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  if (!ta.size || !tb.size) return false;
  const [small, large] = ta.size <= tb.size ? [ta, tb] : [tb, ta];
  const shared = [...small].filter((t) => large.has(t));
  if (!shared.length) return false;
  if (!shared.some((t) => t.length >= 4)) return false;
  return shared.length / small.size >= 0.6;
  // Deliberately NOT also requiring the overlap to be a large fraction of the
  // LONGER title. That was tried and it broke the commonest shape in live music:
  // "Mastodon" vs "Mastodon with Deafheaven and Alcest (18+)", "Chat Pile" vs
  // "Chat Pile with Soul Glo and Prize Horse" — headliner plus support, which is
  // most of a venue calendar. The residual risk is that a one-word listing could
  // match a longer bill containing that word; the distinctive-token rule above
  // and the fact that `unmatched` never hides anything are what bound it.
}

// ── Reconciliation ───────────────────────────────────────────────────────────

const keyOf = (venue: string, day: string) => `${venue.toLowerCase()}|${day}`;

export function showWindow(shows: VenueShow[]): { from: string; to: string } | null {
  if (!shows.length) return null;
  const days = shows.map((s) => s.day).sort();
  return { from: days[0], to: days[days.length - 1] };
}

export interface ReconcileShowsOptions {
  /**
   * Rooms this calendar actually speaks for. A listing at any other venue gets
   * `unknown` — First Avenue promoting a show at the Armory tells us nothing
   * about what else the Armory is doing that night.
   */
  authoritativeVenues: Set<string>;
}

export function reconcileShows(
  feed: VenueShow[],
  existing: ExistingShow[],
  todayKey: string,
  opts: ReconcileShowsOptions,
): MusicPlan {
  const window = showWindow(feed);

  // Collapse an early and a late show of the SAME billing in the SAME room on
  // the SAME night into one. Michael Che played two on 29 Aug; our event_key is
  // sha256(title|venue|day), so the two can't be told apart and the second was
  // "missing" on every single run, forever. One listing is the honest
  // representation of what we can actually store.
  const seenShow = new Set<string>();
  feed = feed.filter((s) => {
    const k = `${keyOf(s.venue, s.day)}|${foldTitle(s.title)}`;
    if (seenShow.has(k)) return false;
    seenShow.add(k);
    return true;
  });

  const byVenueDay = new Map<string, VenueShow[]>();
  for (const s of feed) {
    const k = keyOf(s.venue, s.day);
    const list = byVenueDay.get(k);
    if (list) list.push(s);
    else byVenueDay.set(k, [s]);
  }

  const inWindow = (day: string) => !!window && day >= window.from && day <= window.to;
  const matched = new Set<VenueShow>();
  const verdicts: ShowVerdict[] = [];

  for (const row of existing) {
    if (row.day < todayKey) continue;
    const base = { id: row.id, title: row.title };
    const authoritative = opts.authoritativeVenues.has(row.venue.toLowerCase());
    if (!authoritative || !inWindow(row.day)) {
      verdicts.push({ kind: "unknown", ...base });
      continue;
    }
    const candidates = byVenueDay.get(keyOf(row.venue, row.day)) ?? [];
    const hit = candidates.find((c) => showTitlesMatch(c.title, row.title));
    if (hit) {
      matched.add(hit);
      verdicts.push({ kind: "ok", ...base, url: hit.url });
      continue;
    }

    // Before concluding anything from absence, look for the show ELSEWHERE on
    // the calendar. Finding it turns a guess into evidence.
    const elsewhere = feed.find(
      (s) => (s.day !== row.day || s.venue.toLowerCase() !== row.venue.toLowerCase()) &&
        showTitlesMatch(s.title, row.title),
    );
    if (elsewhere) {
      verdicts.push({
        kind: "moved",
        ...base,
        actual: { day: elsewhere.day, venue: elsewhere.venue },
      });
    } else if (!candidates.length) {
      // The room is dark that night per its own calendar.
      verdicts.push({ kind: "phantom", ...base });
    } else {
      // Something IS on. Our matcher just couldn't tie it to this row, which is
      // more likely our fault than the venue's. Flag it; touch nothing.
      verdicts.push({
        kind: "unmatched",
        ...base,
        alternatives: candidates.map((c) => c.title),
      });
    }
  }

  const missing = feed.filter(
    (s) =>
      s.day >= todayKey &&
      opts.authoritativeVenues.has(s.venue.toLowerCase()) &&
      !matched.has(s),
  );

  return { verdicts, missing, window };
}
