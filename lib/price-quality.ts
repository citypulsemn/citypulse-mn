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
 * What to show a reader. Never empty — an event page with no Price row and an
 * event page that says "See listing" both keep our promise, and the second is
 * what the rest of the site already does.
 */
export function displayPrice(price: string | null | undefined): string {
  return priceIsUnknown(price) ? PRICE_FALLBACK : String(price).trim();
}
