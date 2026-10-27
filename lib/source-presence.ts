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
  /**
   * `via: "fixture"` means the opponent's row and the nearest date confirmed
   * it, not the title — the full-title score is below `presentAt` in that case,
   * so a note reading `present:0.333` would look like a contradiction. It is
   * recorded because the gate's trust model differs from the title's: if it
   * ever proves too loose, one query has to be able to find everything it
   * confirmed.
   */
  | { kind: "present"; score: number; matched: string; via?: "fixture" }
  /** The page reads well, lists things, and none of them is this. */
  | { kind: "absent"; score: number; best: string }
  /** We could not form an opinion. Never treat this as either answer. */
  | { kind: "unchecked"; reason: string; why: UncheckedWhy };

/**
 * WHICH gate refused, as a token rather than as prose.
 *
 * WHY IT IS STRUCTURED. On 27 Oct 2026 the question "how much of the calendar
 * is structurally unverifiable?" could not be answered from data, because every
 * doubt collapsed into one `unchecked` bucket. Asked to work "the 177 blocked
 * hosts", a measurement found 478 never-checked listings of which only 59 were
 * blocked at all — the other 348 were readable pages that simply are not dated
 * indexes, because the venue renders its calendar with JavaScript. Three
 * different problems had been wearing one name, and the wrong one got the
 * attention. A regex over the reason prose would have been the obvious shortcut
 * and the obvious next fragility.
 */
export type UncheckedWhy =
  /** A redirect, a cookie wall or an error page: too little text to judge. */
  | "thin"
  /** The title is stopwords and short words; a negative would prove nothing. */
  | "weak-title"
  /** No listing date was supplied, so silence cannot be read as absence. */
  | "no-date-given"
  /**
   * Readable, and not a dated index. THE BIGGEST BUCKET BY FAR, and it is
   * mostly JavaScript: first-avenue.com's own venue page serves 200 and zero
   * dated entries, as do Fine Line's and Chanhassen's.
   */
  | "not-an-index"
  /** An index, but it does not enumerate the listing's day. */
  | "day-not-covered"
  /** A partial match in the grey band — the page may name it differently. */
  | "partial-match";

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
 * The part of a title before its decoration, or "" when it carries none.
 *
 * WHY. Our titles come off ticketing pages and carry the tour name —
 * "SOMBR: You Are The Reason Tour". A venue's own calendar lists the act:
 * "SOMBR". `scoreEntry` divides by OUR token count, so a verbatim match on the
 * act dilutes to 0.333 against a three-token title, and the listing reads as
 * missing from the page that plainly names it.
 *
 * On 27 Oct 2026 that was EVERY flag the first sweep in four weeks produced.
 * All three Target Center listings were named verbatim on the page they cite:
 *
 *   SOMBR: You Are The Reason Tour                 line "SOMBR"                0.333
 *   KATSEYE: THE WILDWORLD TOUR                    line "KATSEYE"              0.333
 *   Motionless In White: The Sweat and Blood Tour  line "Motionless In White"  0.400
 *
 * A LEAD SEGMENT ONLY — never a trailing one, never an arbitrary prefix. An
 * index shortens a title by dropping the tail, so the head is what survives.
 * Scoring any prefix would be strictly worse: "Music" is a prefix of "Music on
 * the Mall: Brass Band Night" and is also a category link on half the calendars
 * we read, so a nav word would clear a real absence.
 *
 * Scoring the page line against the title instead — the symmetric fix — was
 * measured and rejected. "Minnesota Twins vs Detroit Tigers" is half contained
 * in "Minnesota Twins vs Chicago White Sox", so a game genuinely missing from a
 * schedule page would clear on the strength of a different game, which is the
 * one thing this file exists to prevent.
 */
export function leadSegment(title: string): string {
  const m = /^(.{3,}?)\s*(?::|\s[-–—]\s)/.exec(String(title ?? "").trim());
  return m ? m[1].trim() : "";
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

/**
 * The opponent in a fixture title — everything after "vs."
 *
 * `vs` only, never ` at `. An away game is not a Twin Cities event, and " at "
 * is how half the non-sports titles on this calendar are written ("Holiday
 * Market at Union Depot"), which would let a venue name standing near the right
 * date confirm a listing the page never names.
 *
 * Trailing decoration goes: "(Game 2)", "[Sold Out]", "– Gold Out". Our titles
 * carry it and a schedule page never does.
 */
export function opponentSegment(title: string): string {
  const m = /\svs\.?\s+(.+)$/i.exec(String(title ?? "").trim());
  if (!m) return "";
  return m[1]
    .replace(/\s*[([][^)\]]*[)\]]\s*/g, " ")
    .replace(/\s*[-–—]\s.*$/, "")
    .trim();
}

/** Lower-cased and punctuation-flattened, for comparing a row against a name. */
function normalizeForRow(s: string): string {
  return String(s ?? "").toLowerCase().replace(/[''’]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

/** A marker entry on a line of its own: "vs" / "at" / "@". */
const MARKER_ONLY = /^(?:vs\.?|v|at|@)$/i;
const HOME_MARKER = /^(?:vs\.?|v)$/i;

/**
 * The distinctive words of a venue — the ones that identify THIS building.
 *
 * "arena", "center" and the rest are dropped because every block on a college
 * athletics page carries "Game Center", so a listing at Target Center would
 * match any Gophers fixture on the strength of the word "center" alone.
 * "Williams Arena (The Barn)" keeps `williams` and `barn`, and the page's own
 * "The Barn by Blue Cross and Blue Shield of Minnesota" answers to `barn`.
 */
const GENERIC_VENUE_WORDS = new Set([
  "arena", "center", "centre", "stadium", "field", "park", "theater", "theatre",
  "hall", "pavilion", "complex", "the", "at", "of", "and",
]);

export function venueMarks(venue: string): string[] {
  return normalizeForRow(venue)
    .split(" ")
    .filter((w) => w.length >= 2 && !GENERIC_VENUE_WORDS.has(w));
}

/**
 * Is the entry at `i` a fixture row for `opp` — and if so, which entry carries
 * the block's date, and how far does the block run?
 *
 * Two shapes, both taken from live pages, and nothing else is accepted:
 *
 *   A. the date immediately before the opponent, which is how
 *      gopherpucklive.com writes a home game:
 *          "Fri. Nov 13, 2026 7:00 PM 3M Arena at Mariucci" / "Alaska-Anchorage"
 *   B. a home/away marker immediately before the opponent, which is how
 *      gophersports.com writes one, with the date further down the block:
 *          "vs" / "Western Illinois" / arena / "TV: BTN" / "Nov 16 (Mon)"
 *
 * In shape B the date is found by scanning FORWARD and stopping at the next
 * block's marker — never by proximity. Proximity was the first draft and its
 * margin is one line: two extra lines in a block (a streaming line, a promo
 * line) make the PREVIOUS game's date nearer, and the gate then confirms the
 * wrong night. Requiring the row's own structure is also what stops a bare
 * category link — a "Denver" in a region nav standing a few lines from a dated
 * entry — from confirming anything at all.
 */
export function fixtureRow(
  entries: string[],
  i: number,
  opp: string,
): { dateIndex: number; blockStart: number; blockEnd: number } | null {
  if (!opp || i < 0 || i >= entries.length) return null;
  const bare = normalizeForRow(entries[i]);
  let marker = "";
  let name = bare;
  const inline = /^(vs|v|at)\s+(.*)$/.exec(bare);
  if (inline) {
    marker = inline[1];
    name = inline[2];
  } else if (/^\s*@/.test(entries[i])) {
    // Normalisation eats "@", so the raw entry has to be consulted for it.
    marker = "at";
    name = normalizeForRow(entries[i].replace(/^\s*@/, ""));
  }
  if (name !== opp) return null;

  const prev = (entries[i - 1] ?? "").trim();
  const prevIsMarker = MARKER_ONLY.test(prev);
  if (!marker && prevIsMarker) marker = prev.replace(/\.$/, "");
  // An away row names the same opponent and means somewhere else.
  if (marker && !HOME_MARKER.test(marker)) return null;

  if (i > 0 && !prevIsMarker && ANY_DATE.test(prev)) {
    return { dateIndex: i - 1, blockStart: i - 1, blockEnd: Math.min(entries.length - 1, i + 2) };
  }
  if (!marker) return null;
  const blockStart = prevIsMarker ? i - 1 : i;
  for (let j = i + 1; j < entries.length && j <= i + 12; j++) {
    if (MARKER_ONLY.test(entries[j].trim())) return null;
    if (ANY_DATE.test(entries[j])) return { dateIndex: j, blockStart, blockEnd: j };
  }
  return null;
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
  /**
   * The venue the listing claims, if the caller has it. Supplying it is what
   * lets the fixture gate tell one team's schedule page from its sibling's —
   * see the gate for why token overlap cannot.
   */
  venue?: string;
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
    return { kind: "unchecked", why: "thin", reason: `page has only ${text.trim().length} characters of text` };
  }

  const tokens = distinctiveTokens(title);
  if (tokens.length === 0) {
    return { kind: "unchecked", why: "weak-title", reason: "title has no distinctive words" };
  }

  const entries = pageEntries(text);
  let best = 0;
  let bestEntry = "";
  for (const entry of entries) {
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
    return { kind: "unchecked", why: "no-date-given", reason: "no listing date supplied — cannot tell whether the page covers it" };
  }
  // THE FIXTURE GATE — the largest block the sweep could not read.
  //
  // A team's own schedule page never repeats the home team. Our "Minnesota
  // Gophers Men's Basketball vs. Western Illinois" meets a page that writes the
  // game down five separate lines — "vs", "Western Illinois", the arena, the
  // radio station, "Nov 16 (Mon)" — so the full title scores 2 of its 6 words
  // and the page carries 31 dated entries, under the index bar. 33 listings on
  // 27 Oct 2026 were permanently unchecked for that reason, more than any other
  // single cause, and none of them was JavaScript: the schedule was in the HTML
  // the whole time, written in a shape nothing here knew how to read.
  //
  // IT CONFIRMS A GAME, NOT A DATE NEAR A NAME. Four things must agree, and the
  // first draft of this gate required only the last two. An adversarial review
  // broke that draft three separate ways, each of which confirmed a listing the
  // page did not attest — the worst failure this file can have, because
  // `present` means the sweep neither flags the listing nor withdraws its
  // `verified_at`:
  //
  //   1. a row naming the opponent AND NOTHING ELSE. Scoring the opponent's
  //      words instead gives "Michigan" a perfect 1.0 against a Michigan State
  //      row, confirming a game against the wrong Michigan.
  //   2. that row must be a FIXTURE ROW, established by its own structure —
  //      either its date sits immediately before it (gopherpucklive.com writes
  //      "Fri. Nov 13, 2026" then "Alaska-Anchorage") or a home/away marker
  //      sits immediately before it (gophersports.com writes "vs" on its own
  //      line). Without this a bare category link — a "Denver" in a region nav
  //      three lines from a dated entry — confirmed a listing, and because this
  //      gate runs BEFORE the index gate it could turn a real `absent` into
  //      `present` and silence an accusation by the insertion of " vs. ".
  //   3. the marker must say HOME. An away row names the same opponent and
  //      means somewhere else: "at" / "Western Illinois" / "Western Hall,
  //      Macomb, Ill." is byte-identical to a home row at the opponent line and
  //      differs only in its marker. We publish Twin Cities events; confirming
  //      one from a game 400 miles away would call a wrong venue corroborated.
  //   4. the date must belong to THIS block — found by scanning forward to the
  //      next marker, never by proximity. "Nearest date" was the first draft
  //      and its margin is one line wide: with two extra lines in a block (a
  //      streaming line, a promo line — real pages carry them unevenly) the
  //      PREVIOUS game's date becomes nearer, and the gate then confirmed the
  //      one live wrong listing while refusing the right one.
  //
  // And when the caller supplies the listing's venue, the block must name it.
  // That is what lifts this from "somebody on this page plays Western Illinois
  // that night" to "a home game against Western Illinois, at the arena we
  // claim, on the day we claim" — which is a stronger attestation than a title
  // match. Without it the gate cannot tell one team's schedule from its
  // sibling's: gophersports.com runs parallel men's and women's pages whose
  // opponents overlap, and token overlap cannot separate them, because the
  // site's own navigation names every sport (a bogus "Gophers Volleyball vs.
  // Western Illinois" scores 1.00 against the basketball page, higher than the
  // real title's 0.75 — measured, not guessed).
  //
  // It can only ever return `present`; it never convicts. The cost of demanding
  // a row that names the opponent and nothing else is that a title carrying a
  // nickname the page omits ("Penn State Nittany Lions" against a page that
  // says "Penn State") stays unchecked. That is a miss, not an accusation,
  // which is the direction this file errs.
  const opponent = opponentSegment(title);
  const oppTokens = opponent ? distinctiveTokens(opponent) : [];
  if (oppTokens.length > 0 && oppTokens.length < tokens.length) {
    const opp = normalizeForRow(opponent);
    const venueTokens = opts.venue ? venueMarks(opts.venue) : [];
    for (let i = 0; i < entries.length; i++) {
      const row = fixtureRow(entries, i, opp);
      if (!row) continue;
      const dated = entries[row.dateIndex];
      if (!pageCoversDate(dated, opts.day)) continue;
      // A ROW THAT PRINTS ITS YEAR MUST PRINT OURS. `pageCoversDate` matches on
      // month and day alone, deliberately, because index pages omit the year —
      // so without this a listing dated 2027-11-13 is confirmed by the 2026
      // season's row, and re-dating an event by a year is one of the three
      // fabrication shapes this project has actually shipped. Only a full
      // four-digit year counts, so "2026-27 season" yields 2026 alone and a
      // January 2027 fixture written that way is a miss, not an accusation.
      const rowYears = [...dated.matchAll(/\b(20\d{2})\b/g)].map((m) => m[1]);
      if (rowYears.length > 0 && !rowYears.includes(opts.day.slice(0, 4))) continue;
      if (venueTokens.length > 0) {
        const block = entries.slice(row.blockStart, row.blockEnd + 1).join(" ").toLowerCase();
        if (!venueTokens.some((t) => block.includes(t))) continue;
      }
      return {
        kind: "present",
        score: Number(best.toFixed(3)),
        matched: `${entries[i].slice(0, 80)} — ${dated.slice(0, 60)}`,
        via: "fixture",
      };
    }
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
  const distinctDated = new Set(
    entries.filter((e) => e.length >= 12 && ANY_DATE.test(e)).map((e) => e.toLowerCase()),
  );
  if (distinctDated.size < (opts.minIndexEntries ?? 50)) {
    return {
      kind: "unchecked",
      why: "not-an-index",
      reason:
        `the page lists only ${distinctDated.size} dated entries — it is a single event, an article ` +
        `or a JavaScript calendar, not an index that could have listed this one`,
    };
  }

  // DISTINCT dated entries for THIS day. A nav element or tab strip carrying
  // the date can repeat down a page; counting the copies would let boilerplate
  // stand in for a listing. Two different lines is evidence, twelve copies of
  // one line is furniture.
  const onDay = entries.map((e) => e.length >= 12 && pageCoversDate(e, opts.day!));
  const dated = [...new Set(entries.filter((_, i) => onDay[i]).map((e) => e.toLowerCase()))];
  if (dated.length < (opts.minDatedEntries ?? 2)) {
    return {
      kind: "unchecked",
      why: "day-not-covered",
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
      why: "weak-title",
      reason: `only ${tokens.length} distinctive word${tokens.length === 1 ? "" : "s"} in the title — too few to call it missing`,
    };
  }
  if (best >= absentBelow) {
    return { kind: "unchecked", why: "partial-match", reason: `partial match (${score}) — the page may name it differently` };
  }
  // LAST APPEAL: does the page list this under the act's name, without the tour
  // title? See `leadSegment` — that was every false flag of 27 Oct 2026. It can
  // only ever turn a negative into `unchecked`; it never clears anything to
  // `present`, because an act being on the calendar does not attest the date.
  //
  // AND THE LEAD MATCH MUST SIT BESIDE THE LISTING'S OWN DATE. A bare lead
  // match is not enough, because an index page's own HEADING is the lead of
  // every listing in its series: "Music on the Mall" is printed at the top of
  // the page that lists "Music on the Mall: Brass Band Night", so the gate
  // would make every night of a real series unconvictable — and inventing the
  // next night of a real series is one of the three fabrication shapes this
  // project has actually shipped (docs/SOURCE-CHECK.md). Requiring the act to
  // appear within NEAR entries of a line carrying the day turns the gate from
  // "this name is somewhere on the page" into "this name is on the page, on
  // this date", which is the thing we wanted to know.
  //
  // ponytail: a one-word lead that is also a bare category link beside a dated
  // entry ("Sports", "Music") would still clear a real absence. That costs a
  // miss, never an accusation — the direction this whole file errs in. Tighten
  // by demanding two lead tokens if a sweep ever shows it mattering.
  const lead = leadSegment(title);
  const leadTokens = lead ? distinctiveTokens(lead) : [];
  if (leadTokens.length > 0 && leadTokens.length < tokens.length) {
    // Target Center prints the date, then the promoter, then the act: a gap of
    // two. Three allows a venue or a door time in between without letting a
    // heading forty lines up stand in for a listing.
    const NEAR = 3;
    for (let i = 0; i < entries.length; i++) {
      if (scoreEntry(leadTokens, entries[i]) < presentAt) continue;
      if (!onDay.slice(Math.max(0, i - NEAR), i + NEAR + 1).some(Boolean)) continue;
      return {
        kind: "unchecked",
        why: "partial-match",
        reason:
          `the page does not carry "${title}" but does carry "${entries[i].slice(0, 80)}" ` +
          `beside a line for ${opts.day} — it lists this under the act's name, without the tour title`,
      };
    }
  }
  return { kind: "absent", score, best: bestEntry.slice(0, 160) };
}

/**
 * Is this a transient network failure rather than a bug in our code?
 *
 * Lives here rather than in the sweep script so it can be tested, because it
 * guards an `uncaughtException` handler and an over-broad predicate there would
 * silently swallow real defects.
 *
 * The first full sweep died at page 580 of 677: a pooled HTTP/2 connection
 * dropped AFTER its fetch had already settled, so the error surfaced on a
 * stream nobody was listening to and Node raised it as uncaught. There was no
 * promise left for the per-fetch try/catch to reject. Rule 1 says the
 * instrument must not be killable by the thing it measures — but only for
 * network noise. Anything else must still crash.
 */
export function isTransientNetworkError(err: unknown): boolean {
  const e = err as { code?: string; name?: string; message?: string } | null;
  if (!e || typeof e !== "object") return false;
  const s = `${e.code ?? ""} ${e.name ?? ""} ${e.message ?? ""}`;
  return /UND_ERR|SocketError|ECONNRESET|ECONNREFUSED|EPIPE|ECONNABORTED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|other side closed|\bterminated\b|socket hang up/i.test(
    s,
  );
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

/**
 * Which pages the sweep should spend its budget on, stalest first.
 *
 * The sweep can only afford so many fetches per run, so the ORDER it picks them
 * in decides what gets checked at all. Ordering by URL — which is what it did
 * until 21 Sep 2026 — means the same pages win every week and the tail is never
 * checked, which is worse than a small budget: it is a permanent hole with a
 * predictable shape. Anything citing a late-alphabet host was exempt from the
 * fabrication check by accident of spelling.
 *
 * Never-checked pages go first, then oldest-checked, then URL for a stable
 * order. A page counts as never-checked if ANY listing on it is unstamped —
 * a newly added listing on an old page deserves a look, and the cheap
 * conservative choice is to re-read the page.
 */
/**
 * How many pages one sweep may fetch, the default behind `--limit`.
 *
 * Exported so the staleness alarm can ask "did the last run read a plausible
 * share of what it was allowed to?" without a second copy of the number. The
 * tile and the sweep disagreeing about what a full run looks like would make
 * the alarm lie on exactly the week it mattered — the same reason
 * `DIGEST_STALE_DAYS` is passed into `judgeDigest` rather than duplicated.
 */
export const SWEEP_PAGE_BUDGET = 400;

export function stalestFirst(pages: { url: string; lastChecked: string | null }[]): string[] {
  return pages
    .slice()
    .sort((a, b) => {
      if (a.lastChecked === null && b.lastChecked === null) return a.url < b.url ? -1 : 1;
      if (a.lastChecked === null) return -1;
      if (b.lastChecked === null) return 1;
      if (a.lastChecked !== b.lastChecked) return a.lastChecked < b.lastChecked ? -1 : 1;
      return a.url < b.url ? -1 : 1;
    })
    .map((p) => p.url);
}

/** The oldest stamp across a page's listings; null if any is unstamped. */
export function pageLastChecked(rows: { source_checked_at: string | null }[]): string | null {
  let oldest: string | null = null;
  for (const r of rows) {
    if (!r.source_checked_at) return null;
    if (oldest === null || r.source_checked_at < oldest) oldest = r.source_checked_at;
  }
  return oldest;
}

/**
 * What happened on the last attempt at a page, as one short queryable token.
 *
 * WHY IT IS STORED. `source_checked_at` records WHEN a page was last read and
 * nothing recorded WHY it was not. So "how much of the calendar is
 * structurally unverifiable?" was unanswerable from data, and on 27 Oct 2026 it
 * was answered wrongly: a report of "177 listings behind hosts that 403 a
 * script" went out, and the measurement that followed found 478 never-checked
 * listings of which **59** were blocked. The other 348 were readable pages that
 * are not dated indexes — venue calendars drawn client-side. first-avenue.com's
 * own venue page answers 200 with ZERO dated entries, and so do Fine Line's and
 * Chanhassen Dinner Theatres'. Three unrelated problems wore one name, and the
 * smallest got the attention.
 *
 * `category:detail`, category first so it groups with a `like 'blocked:%'`
 * rather than a regex over prose. The detail is for a human reading one row.
 */
export function pageNote(a: {
  /** HTTP status, when we got an answer at all. */
  status?: number;
  /** Why we never got one: a timeout, a dropped socket, DNS. */
  network?: string;
  /** The verdict, when the page was read. */
  check?: SourceCheck;
}): string {
  if (a.network) return `unreachable:${a.network.slice(0, 40)}`;
  const s = a.status;
  if (typeof s === "number" && (s < 200 || s >= 300)) {
    // 401/403/429 are a bot policy, however they are dressed. new.artsmia.org
    // answers 429 to every path including robots.txt and never clears, so it is
    // a block wearing a rate limit's number — a retry there is dead code, which
    // was measured before one was written.
    if (s === 401 || s === 403 || s === 429) return `blocked:${s}`;
    if (s === 404 || s === 410) return `dead:${s}`;
    return `error:${s}`;
  }
  if (!a.check) return "error:no verdict recorded";
  if (a.check.kind === "present") return `present:${a.check.via ?? a.check.score}`;
  if (a.check.kind === "absent") return `absent:${a.check.score}`;
  return `unchecked:${a.check.why}`;
}

/** The category half of a `pageNote`, for grouping. */
export function noteCategory(note: string | null): string {
  if (!note) return "never attempted";
  const at = note.indexOf(":");
  return at === -1 ? note : note.slice(0, at);
}
