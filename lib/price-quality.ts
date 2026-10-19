/**
 * Does this listing actually say what it costs?
 *
 * WHY. On 12 Sep 2026 Taren reported six listings "showing TBD". The venue
 * guard (lib/venue-quality.ts) had already cleared every upcoming row — 0 of
 * 1,038 — so this was a different field wearing the same failure: `price`.
 * 101 live rows read "Price TBD" or "Price Unknown" on the event page.
 *
 * The column already has an honest answer built in: `price text not null
 * default 'See listing'`. 446 rows carry it, submissions fall back to it
 * (lib/submissions.ts), and it tells a reader what to do next. "TBD" tells
 * them nothing except that we didn't look. The research agent was writing its
 * own placeholder over a default that was already better.
 *
 * The line is deliberately narrow, and it is the same line venue-quality
 * draws: a price is unknown when it SAYS it is unknown. "Varies" (30 live),
 * "See venue" (10), "Included with admission" (8), "Ticketed" (4) are all
 * vague and all useful — a reader learns something real from each. Vagueness
 * is not the defect; the admission of ignorance is.
 *
 * "TBD – see seversfestival.com" is the interesting edge: it admits ignorance
 * AND points somewhere. The pointer is the useful half, so it survives — only
 * a bare admission is replaced.
 */

/** The column's own default, and the honest answer when we don't know. */
export const PRICE_FALLBACK = "See listing";

/**
 * A price string that is nothing but an admission we don't know.
 *
 * Anchored end to end on purpose: this must fire on "TBD" and not on
 * "TBD – see seversfestival.com", which carries a real next step. Optional
 * "price"/"cost"/"admission" prefix because "Price TBD" and "Cost: unknown"
 * are the same shrug with a label stuck on.
 */
const SAYS_UNKNOWN =
  /^\s*(?:(?:price|cost|admission|tickets?)\s*[:\-–]?\s*)?(?:tbd|tba|t\.b\.d\.?|unknown|unclear|n\/?a|none listed|not (?:listed|available|announced|specified|published|set)|to be (?:announced|determined|confirmed|set)|\?+|-+|—+)\s*$/i;

/** True when the price field tells a reader nothing at all. */
export function priceIsUnknown(price: string | null | undefined): boolean {
  const p = String(price ?? "").trim();
  if (p === "") return true;
  return SAYS_UNKNOWN.test(p);
}

/**
 * True only when the price text itself says the event is free, with no
 * conditions. The Free price TIER is a substring match (lib/event-key.ts), so
 * "$18; children under 36\" free" and "Free with museum admission" are tier
 * Free — printing the bare word "Free" for those is a false claim. Measured
 * on live data (Oct 2026): 14 of 51 tier-Free rows were conditional.
 * Accepts "Free", "Free admission", "Free entry", and the two harmless
 * parentheticals "(general admission)" / "(donations appreciated|welcome|accepted)".
 */
const STRICTLY_FREE =
  /^free(?:\s+(?:admission|entry))?(?:\s*\((?:general admission|donations?\s+(?:appreciated|welcome|accepted))\))?[.!]?$/i;

export function isStrictlyFree(price: string | null | undefined): boolean {
  return STRICTLY_FREE.test(String(price ?? "").trim());
}

/** Every dollar amount in a price text. A bare number is an age or a count ("children 3 and under"), never a price. */
export function dollarAmounts(price: string): number[] {
  return [...price.matchAll(/\$\s?(\d+(?:\.\d{2})?)/g)].map((m) => parseFloat(m[1]));
}

/**
 * True when a reader can turn up and pay nothing. This decides the Free price
 * TIER — the filter chip and the "Free This Week" collection — so it is
 * looser than isStrictlyFree, which decides whether to print the bare word.
 *
 * The text must LEAD with "free" (or $0): "Free admission; pumpkin patch $5"
 * and "Free (parking $10)" are free to attend, extras cost. What comes right
 * after "free" can take it back: a limit on who ("for members", "kids",
 * "with Arboretum admission") or when ("Fri", "on Thursdays"), or a range
 * upward ("Free–$20", "Free or low cost"). "$22 general; children 3 and under
 * free" never leads with free, so it never qualifies. Every shape here was
 * read off the live table (Oct 2026): the tier used to be a substring match
 * on "free", and 209 of its 1,337 rows were one of the taken-back kinds.
 */
const LEADS_FREE = /^(?:free\b|\$0(?:\.00)?(?!\d))/i;
// Each lookahead also refuses whitespace, or "\s*" would back off a space and
// let "Free / RSVP" read as a limit.
const TAKEN_BACK =
  /^(?:free|\$0(?:\.00)?)\s*(?:[–\-]|to\s+\$|\/\s*(?!\s|rsvp|donation|free)|or\s+(?!\s|free)|\(?\s*(?:(?:for|only)\s+(?!\s|all\b|everyone\b|the\s+public\b)|with\s+(?!\s|registration|rsvp|reservation|ticket|sign|pre)|if\b|when\b|on\b|before\b|after\b|until\b|members?\b|kids?\b|children\b|youth\b|under\b|ages?\b|students?\b|seniors?\b|veterans?\b|(?:mon|tues?|wed|thu|thurs|fri|sat|sun)[a-z]*\b|first\b))/i;
// "Free (outdoor) / Ticketed (venue events)": a later " / " that is not RSVP or donations splits the price.
const SPLIT_LATER = /\s\/\s(?!rsvp|donation|free)/i;
const MEMBERS_ONLY = /\bmembers?\b/i;

export function isFreeToAttend(price: string | null | undefined): boolean {
  const p = String(price ?? "").trim();
  if (!LEADS_FREE.test(p) || TAKEN_BACK.test(p) || SPLIT_LATER.test(p)) return false;
  // "Free (Como Friends donors/members)": free for members is not free.
  return !(MEMBERS_ONLY.test(p) && !/non-?members?/i.test(p));
}

/**
 * What to show a reader. Never empty — an event page with no Price row and an
 * event page that says "See listing" both keep our promise, and the second is
 * what the rest of the site already does.
 */
export function displayPrice(price: string | null | undefined): string {
  return priceIsUnknown(price) ? PRICE_FALLBACK : String(price).trim();
}
