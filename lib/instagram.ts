import type { EventRecord } from "./types";
import { daysSpanned } from "./dates";
import { timeLabel } from "./dates";

/**
 * INSTAGRAM CARDS (roadmap 6.4) — the weekly @CityPulseMpls card copy,
 * generated from live event data under the operation's LOCKED CONTENT RULES:
 *
 *   1. Exactly FIVE events per card. A card that can't reach five is marked
 *      incomplete — never padded with rule-breaking or off-variant events.
 *   2. Three variants — Regular, Family, Weird — with NO OVERLAP between
 *      them. Family draws only from the family category, Weird only from
 *      weird, and Regular from the rest (music/festival/food/arts/sports),
 *      so disjointness holds by construction; an ID guard enforces it anyway.
 *   3. NO DRAG OR POLITICAL events, via a word-boundary blocklist with
 *      documented exceptions ("drag racing" and "March Madness" pass; "drag
 *      brunch" and "rally for X" don't). Filtering is TRANSPARENT: excluded
 *      events are reported with their reason, never silently dropped —
 *      the operator reviews everything before posting.
 *
 * Out of scope by design: b-roll (Pexels, operator-side), shot-type and
 * audio-lane rotation (ISO-week system, operator-side). This generates the
 * card COPY and captions only.
 */

export type CardVariant = "regular" | "family" | "weird";

export const CARD_SIZE = 5;

const REGULAR_CATEGORIES = ["music", "festival", "food", "arts", "sports"] as const;
/** Regular diversity: no more than this many events from one category. */
export const REGULAR_MAX_PER_CATEGORY = 2;

/** Word-boundary exclusion rules with exceptions, per the locked list. */
const EXCLUSIONS: { reason: string; test: (t: string) => boolean }[] = [
  {
    reason: "drag",
    // "drag show/brunch/queen/bingo…" excluded; "drag racing/strip/race" is
    // motorsports and passes.
    test: (t) => /\bdrag\b/.test(t) && !/\bdrag\s+(?:rac|strip)/.test(t),
  },
  {
    reason: "political",
    test: (t) =>
      /\b(?:protest|political|politics|election|campaign|senator|governor|mayoral|city council|caucus|gop|dfl|democrat|republican|maga)\b/.test(t) ||
      // "rally" is political unless it's motorsports ("rally car", "rallycross").
      (/\brally\b/.test(t) && !/\brally\s*(?:car|cross)/.test(t)) ||
      // "march" the verb/noun, not the month: excluded only when followed by
      // "for/on/against" ("March for Science"), never "March Madness" etc.
      /\bmarch\s+(?:for|on|against)\b/.test(t),
  },
];

/** Why an event is excluded from cards, or null if it's clean. */
export function exclusionReason(e: Pick<EventRecord, "title" | "description">): string | null {
  const text = `${e.title} ${e.description ?? ""}`.toLowerCase();
  for (const rule of EXCLUSIONS) if (rule.test(text)) return rule.reason;
  return null;
}

export interface CardSet {
  regular: EventRecord[];
  family: EventRecord[];
  weird: EventRecord[];
  /** Transparency report: what the rules removed, and why. */
  excluded: { event: EventRecord; reason: string }[];
  /** Variants that couldn't reach CARD_SIZE. */
  incomplete: CardVariant[];
}

/**
 * Build the week's three cards from a pool of events (feed it published
 * events in the chosen window). Deterministic: soonest-first within each
 * variant; Regular additionally capped per category for variety.
 */
export function buildCards(pool: EventRecord[], windowDays: string[]): CardSet {
  const daySet = new Set(windowDays);
  const inWindow = pool
    .filter((e) => e.status === "published")
    .filter((e) => daysSpanned(e).some((d) => daySet.has(d)))
    .sort((a, b) => a.start.localeCompare(b.start));

  const excluded: CardSet["excluded"] = [];
  const clean: EventRecord[] = [];
  for (const e of inWindow) {
    const reason = exclusionReason(e);
    if (reason) excluded.push({ event: e, reason });
    else clean.push(e);
  }

  const used = new Set<string>();
  const take = (list: EventRecord[]): EventRecord[] => {
    const out: EventRecord[] = [];
    for (const e of list) {
      if (out.length === CARD_SIZE) break;
      if (used.has(e.id)) continue; // the no-overlap guard
      out.push(e);
      used.add(e.id);
    }
    return out;
  };

  const family = take(clean.filter((e) => e.category === "family"));
  const weird = take(clean.filter((e) => e.category === "weird"));

  // Regular: the rest of the categories, soonest-first, with a per-category
  // cap so one busy genre doesn't fill the card.
  const perCat = new Map<string, number>();
  const regularPool = clean.filter(
    (e) => (REGULAR_CATEGORIES as readonly string[]).includes(e.category),
  ).filter((e) => {
    const n = perCat.get(e.category) ?? 0;
    if (n >= REGULAR_MAX_PER_CATEGORY) return false;
    perCat.set(e.category, n + 1);
    return true;
  });
  const regular = take(regularPool);

  const incomplete: CardVariant[] = [];
  if (regular.length < CARD_SIZE) incomplete.push("regular");
  if (family.length < CARD_SIZE) incomplete.push("family");
  if (weird.length < CARD_SIZE) incomplete.push("weird");

  return { regular, family, weird, excluded, incomplete };
}

/** "FRI 7/17" style day tag for a card line. */
function dayTag(e: EventRecord): string {
  const d = new Date(`${daysSpanned(e)[0]}T12:00:00Z`);
  const wd = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }).toUpperCase();
  return `${wd} ${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

/**
 * The two-line-per-event card copy:
 *   LINE 1: DAY M/D · Title
 *   LINE 2: Venue · time · price
 * NOTE: if the operation's locked format differs from this default, paste one
 * real card and match it here — the format lives in this one function.
 */
export function formatCard(events: EventRecord[]): string {
  return events
    .map((e) => {
      const price = e.price && e.price.toLowerCase() !== "unknown" ? e.price : "";
      const line2 = [e.venue, timeLabel(e), price].filter(Boolean).join(" · ");
      return `${dayTag(e)} · ${e.title}\n${line2}`;
    })
    .join("\n\n");
}

const CAPTION_TAGS: Record<CardVariant, string> = {
  regular: "#minneapolis #twincities #thingstodomn #mnevents #stpaul",
  family: "#minneapolismn #twincitiesfamily #familyfunmn #thingstodowithkids #mnkids",
  weird: "#weirdminneapolis #twincities #onlyinmn #mnevents #hiddenmn",
};

const CAPTION_HOOKS: Record<CardVariant, string> = {
  regular: "Your Twin Cities week, sorted",
  family: "Five family picks the kids will actually remember",
  weird: "The weirdest things happening in the Twin Cities this week",
};

/** Caption per Reel — hook, the bio-link tie-in to /this-weekend, hashtags. */
export function renderCaption(variant: CardVariant, weekLabel: string): string {
  return [
    `${CAPTION_HOOKS[variant]} (${weekLabel}) 👇`,
    "",
    "Full details for every pick — dates, tickets, maps — at the link in bio → citypulsemn.com/this-weekend",
    "",
    CAPTION_TAGS[variant],
  ].join("\n");
}
