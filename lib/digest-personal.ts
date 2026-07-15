import type { CategoryKey, EventRecord } from "./types";
import { CATEGORY_KEYS } from "./categories";

/**
 * PERSONALIZED DIGEST (roadmap 5.3) — pure logic.
 *
 * Two signals, both derived from the subscriber's own saved events (linked via
 * the saver_token bridge captured at subscribe time):
 *
 *  1. "You saved these — happening this week": their saved events that are
 *     actually imminent, leading the email. A reminder beats a recommendation.
 *  2. Category affinity: the categories they save most reorder the general
 *     picks — same curation, their taste first. Order within a category is
 *     preserved (the curator's ranking still matters).
 *
 * Everything degrades to the standard digest: no token, no saves, or nothing
 * imminent ⇒ the email is exactly what it was before 5.3.
 */

export const PERSONAL_WINDOW_DAYS = 7;
export const PERSONAL_MAX_SAVED = 5;

/**
 * The subscriber's saved events worth leading with: published, starting (or
 * still running) within the next week, soonest first, capped.
 */
export function selectSavedUpcoming(
  saved: EventRecord[],
  now: Date,
  days = PERSONAL_WINDOW_DAYS,
): EventRecord[] {
  const from = now.getTime();
  const to = from + days * 86_400_000;

  return saved
    .filter((e) => e.status === "published")
    .filter((e) => {
      const start = new Date(e.start).getTime();
      if (Number.isNaN(start)) return false;
      if (start >= from && start <= to) return true;
      // A multi-day run still in progress counts — they can still go.
      const end = e.multiDayEnd ?? e.end;
      if (end && start < from) {
        const endT = new Date(end).getTime();
        return !Number.isNaN(endT) && endT >= from;
      }
      return false;
    })
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, PERSONAL_MAX_SAVED);
}

/**
 * Categories ranked by how often this person saves them (ALL saves, not just
 * upcoming — taste is long-lived even when plans aren't). Ties keep the
 * site's canonical category order for stability.
 */
export function categoryAffinity(saved: EventRecord[]): CategoryKey[] {
  const counts = new Map<CategoryKey, number>();
  for (const e of saved) counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
  return [...CATEGORY_KEYS]
    .filter((c) => (counts.get(c) ?? 0) > 0)
    .sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0));
}

/**
 * Reorder the general picks so the subscriber's favorite categories come
 * first. STABLE within each category — curation order survives. Categories
 * they've never saved follow in their original order. And events already in
 * the personal section are dropped from the picks (no double-featuring).
 */
export function personalizePicks(
  picks: EventRecord[],
  affinity: CategoryKey[],
  alreadyShown: EventRecord[] = [],
): EventRecord[] {
  const shown = new Set(alreadyShown.map((e) => e.id));
  const remaining = picks.filter((e) => !shown.has(e.id));
  if (affinity.length === 0) return remaining;

  const rank = new Map<CategoryKey, number>();
  affinity.forEach((c, i) => rank.set(c, i));
  const rankOf = (e: EventRecord) => rank.get(e.category) ?? affinity.length;

  // Stable sort by affinity rank only — original order breaks ties.
  return remaining
    .map((e, i) => ({ e, i }))
    .sort((a, b) => rankOf(a.e) - rankOf(b.e) || a.i - b.i)
    .map(({ e }) => e);
}
