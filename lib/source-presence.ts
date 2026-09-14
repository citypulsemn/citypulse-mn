/**
 * Is this listing actually on the page it cites?
 *
 * WHY. On 14 Sep 2026 "Prairie Bathing Under a Harvest Moon" was live, stamped
 * verified, and did not exist. Three Rivers Park District runs seven programmes
 * on 26 September and none of them is that. What the listing really was:
 *
 *   Guided Forest Bathing Walk      Silverwood Park,  10 Oct
 *   Night on the Prairie            Eastman NC,       31 Oct
 *   "The Harvest Moon"              a BLOG POST from September 2018
 *
 * — three real things and a blog headline, blended into a fourth that is not
 * real. The date was not random either: the harvest moon genuinely does fall
 * near 26 Sep 2026. Real vocabulary, real date anchor, no event.
 *
 * It cited `threeriversparks.org/programs`, a live index page that names every
 * programme it runs. The title was never on it. That is the whole check, and it
 * costs one fetch and no model call.
 *
 * THE LESSON THAT SHAPES THE ALGORITHM. Matching tokens against the WHOLE PAGE
 * would have cleared this listing: "prairie" is on that page (Prairie Seed
 * Collection), so is "bathing" (Fall Colors Guided Forest Bathing), so is
 * "harvest" (Preserving the Harvest) and so is "moon" (Moonlit Magic). Every
 * word was present. None of them were present TOGETHER. So the unit of
 * comparison is one ENTRY — a line of the page — never the page as a whole.
 *
 * CONSERVATISM IS THE POINT. Calling a real listing fabricated is far worse
 * than missing a fake one, so every doubt resolves to `unchecked`: a short
 * title, a thin page, a failed fetch. And the worst this may ever do to a row
 * is FLAG it. It must never archive anything — see `scripts/check-sources.ts`.
 */

export type SourceCheck =
  /** A line on the page carries most of the title's distinctive words. */
  | { kind: "present"; score: number; matched: string }
  /** The page reads well, lists things, and none of them is this. */
  | { kind: "absent"; score: number; best: string }
  /** We could not form an opinion. Never treat this as either answer. */
  | { kind: "unchecked"; reason: string };

/**
 * Words that carry no identifying power. Deliberately SHORT: over-stripping
 * leaves a title with two tokens, and two tokens cannot support a confident
 * negative. Note what is NOT here — "night", "fall", "family", "park" all stay,
 * because "Night on the Prairie" and "Fall Colors Family Canoeing" are mostly
 * made of them.
 */
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "for", "to", "in", "on", "at", "with",
  "by", "from", "under", "over", "into", "its", "it", "is", "are", "as", "be",
  "this", "that", "our", "your", "you", "we", "us", "all", "more", "new",
  "presents", "presented", "featuring", "feat", "ft", "plus", "vs",
]);

/** A year on its own identifies nothing — every listing on the page has one. */
const YEAR = /^(19|20)\d{2}$/;

/**
 * The words in a title worth looking for. Lowercased, punctuation stripped,
 * de-duplicated, stopwords and years removed, anything under three characters
 * dropped.
 */
export function distinctiveTokens(title: string): string[] {
  const words = String(title ?? "")
    .toLowerCase()
    .replace(/[''’]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const out: string[] = [];
  for (const w of words) {
    if (w.length < 3) continue;
    if (STOPWORDS.has(w)) continue;
    if (YEAR.test(w)) continue;
    if (!out.includes(w)) out.push(w);
  }
  return out;
}

/**
 * Cut a page into the entries a reader would see as separate items. Index pages
 * put one event per line; long prose lines are split further so a paragraph
 * mentioning several events cannot pool their words into one "entry".
 */
export function pageEntries(pageText: string): string[] {
  return String(pageText ?? "")
    .split(/[\n\r]+|\s\|\s|•|·/)
    .flatMap((line) => (line.length > 180 ? line.split(/(?<=[.!?])\s+/) : [line]))
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

/** How much of `tokens` appears in one entry, 0..1. */
function scoreEntry(tokens: string[], entry: string): number {
  const hay = entry.toLowerCase().replace(/[''’]/g, "");
  let hits = 0;
  for (const t of tokens) if (hay.includes(t)) hits++;
  return hits / tokens.length;
}

/** Any "Month D" on a line, in the forms an index page writes them. */
const ANY_DATE = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}\b/i;

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/**
 * Does this page cover the day the listing claims?
 *
 * WHY THIS GATES EVERY NEGATIVE. The first version of this check flagged three
 * real Arboretum listings, and the fault was not the matching — it was that
 * `arb.umn.edu/events/calendar` is "Today at the Arb". A page showing TODAY
 * cannot prove anything about the 26th, and neither can a single-topic page or
 * a nonprofit's own fundraiser list. Absence of evidence was being read as
 * evidence of absence, which is the whole mistake this file exists to avoid.
 *
 * So a listing may only be called missing from a page that demonstrably covers
 * its date. Three Rivers' programs page says "September 26" seven times, and
 * that is what makes its silence about one programme mean something.
 */
export function pageCoversDate(pageText: string, isoDay: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDay ?? "").trim());
  if (!m) return false;
  const [, y, mo, d] = m;
  const month = MONTHS[Number(mo) - 1];
  if (!month) return false;
  const day = String(Number(d));
  const short = month.slice(0, 3);
  const hay = String(pageText ?? "").toLowerCase();
  const ord = "(?:st|nd|rd|th)?";
  const patterns = [
    new RegExp(`\\b${month}\\.?\\s+${day}${ord}\\b`), // September 26
    new RegExp(`\\b${short}t?\\.?\\s+${day}${ord}\\b`), // Sep 26 / Sept 26
    new RegExp(`\\b${day}${ord}\\s+${month}\\b`), // 26 September
    new RegExp(`\\b0?${Number(mo)}\\s*[\\/\\-]\\s*0?${day}\\b`), // 9/26
    new RegExp(`\\b${y}-${mo}-${d}\\b`), // 2026-09-26
  ];
  return patterns.some((re) => re.test(hay));
}

export interface PresenceOptions {
  /**
   * The listing's date, "YYYY-MM-DD". REQUIRED for an `absent` verdict —
   * without it the strongest available answer is `unchecked`, because a page
   * that does not cover the date cannot be meaningfully silent about the event.
   */
  day?: string;
  /** A line scoring at or above this counts as the listing. Default 0.6. */
  presentAt?: number;
  /**
   * Below this, and with enough tokens to be sure, the listing is not there.
   * Between the two is a grey band that reports `unchecked` — a title we have
   * embellished ("Fulton Brewery Oktoberfest – Weekend 1" against a page that
   * says "Fulton Oktoberfest") lands there, and should.
   */
  absentBelow?: number;
  /** Fewest distinctive words before a negative is trustworthy. Default 3. */
  minTokens?: number;
  /**
   * Fewest DATED ENTRIES for the listing's day before a negative is
   * trustworthy. Default 2 — one entry is a page that happens to mention the
   * date, not a page that covers it.
   */
  minDatedEntries?: number;
  /**
   * Fewest dated entries ANYWHERE on the page before it counts as an index
   * whose silence means something. Default 50 — see the note in the body.
   */
  minIndexEntries?: number;
  /** A page this short is a redirect, a cookie wall or an error. Default 400. */
  minPageChars?: number;
}

/**
 * The check. `pageText` must be the VISIBLE TEXT of the cited page — strip the
 * markup first, or every listing matches on its own `<title>` tag.
 */
export function checkTitleOnPage(
  title: string,
  pageText: string,
  opts: PresenceOptions = {},
): SourceCheck {
  const presentAt = opts.presentAt ?? 0.6;
  const absentBelow = opts.absentBelow ?? 0.5;
  const minTokens = opts.minTokens ?? 3;
  const minPageChars = opts.minPageChars ?? 400;

  const text = String(pageText ?? "");
  if (text.trim().length < minPageChars) {
    return { kind: "unchecked", reason: `page has only ${text.trim().length} characters of text` };
  }

  const tokens = distinctiveTokens(title);
  if (tokens.length === 0) {
    return { kind: "unchecked", reason: "title has no distinctive words" };
  }

  let best = 0;
  let bestEntry = "";
  for (const entry of pageEntries(text)) {
    const s = scoreEntry(tokens, entry);
    if (s > best) {
      best = s;
      bestEntry = entry;
    }
    if (best === 1) break;
  }

  const score = Number(best.toFixed(3));
  if (best >= presentAt) return { kind: "present", score, matched: bestEntry.slice(0, 160) };

  // A confident negative needs a page that actually covers the day in question.
  if (!opts.day) {
    return { kind: "unchecked", reason: "no listing date supplied — cannot tell whether the page covers it" };
  }
  // …and it must cover it as ENTRIES, not as a stray date in a footer or a
  // date-picker. arb.umn.edu/events/calendar mentions "September 26" while
  // carrying no events at all in its HTML — everything a reader sees there is
  // drawn by JavaScript, so the only text we can read is the navigation menu
  // ("Gardens & Grounds", "Garden Highlights", "Urban Garden Program"). A page
  // whose listings we cannot see is a page we have nothing to say about.
  // ONLY AN INDEX CAN CONVICT. The first full sweep flagged five listings and
  // four were real: a single-event page for Clue, the Guthrie's ticketing page,
  // a Gophers news article. Our titles carry decoration those pages never use
  // ("– Saturday Performance", "(Broadway on Hennepin)"), so they scored low
  // and looked missing. They were not missing; the page simply is not a list.
  //
  // What separated them from the genuine fabrication was not the score — it was
  // how much of a calendar the page enumerates:
  //
  //   threeriversparks.org/programs  208 dated entries   the real catch
  //   securesite.guthrietheater.org   32                 false positive
  //   gophersports.com news article   31                 false positive
  //   arb.umn.edu/events/calendar     14                 false positive
  //   hennepinarts.org/events/clue     9                 false positive
  //
  // So absence only means anything on a page that lists a whole calendar and
  // could therefore have listed this. The bar is set well above the false
  // positives on purpose: it costs coverage of small organiser calendars, and
  // a miss is the right direction to err.
  const entries = pageEntries(text);
  const distinctDated = new Set(
    entries.filter((e) => e.length >= 12 && ANY_DATE.test(e)).map((e) => e.toLowerCase()),
  );
  if (distinctDated.size < (opts.minIndexEntries ?? 50)) {
    return {
      kind: "unchecked",
      reason:
        `the page lists only ${distinctDated.size} dated entries — it is a single event, an article ` +
        `or a JavaScript calendar, not an index that could have listed this one`,
    };
  }

  // DISTINCT dated entries for THIS day. A nav element or tab strip carrying
  // the date can repeat down a page; counting the copies would let boilerplate
  // stand in for a listing. Two different lines is evidence, twelve copies of
  // one line is furniture.
  const dated = [
    ...new Set(
      entries
        .filter((e) => e.length >= 12 && pageCoversDate(e, opts.day!))
        .map((e) => e.toLowerCase()),
    ),
  ];
  if (dated.length < (opts.minDatedEntries ?? 2)) {
    return {
      kind: "unchecked",
      reason:
        dated.length === 0
          ? `the page lists nothing on ${opts.day} — it may show only today, one topic, or render its calendar with JavaScript`
          : `the page has only ${dated.length} entry for ${opts.day} — too thin to call a listing missing`,
    };
  }
  // …and enough distinctive words to have been wrong about.
  if (tokens.length < minTokens) {
    return {
      kind: "unchecked",
      reason: `only ${tokens.length} distinctive word${tokens.length === 1 ? "" : "s"} in the title — too few to call it missing`,
    };
  }
  if (best >= absentBelow) {
    return { kind: "unchecked", reason: `partial match (${score}) — the page may name it differently` };
  }
  return { kind: "absent", score, best: bestEntry.slice(0, 160) };
}

/** Markup in, visible text out. No dependency, and good enough for an index page. */
export function htmlToText(html: string): string {
  return String(html ?? "")
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article|br)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}
