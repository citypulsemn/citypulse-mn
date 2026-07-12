import { CATEGORY_KEYS } from "./categories";
import type { CategoryKey } from "./types";

/**
 * Event classification (roadmap 4.1).
 *
 * THE PROBLEM THIS SOLVES: the research pipeline fans out one agent per
 * category, and each agent stamped its own category onto whatever it found. So
 * a concert discovered by the "food" agent (because it's at a brewery) became a
 * food event — which is why the Live Music collection was empty in July while
 * Festivals ballooned. Category was a function of the DISCOVERY PATH, not of the
 * event.
 *
 * THE FIX: classify from the event's own content. This module is pure,
 * deterministic, and unit-tested against a golden set of real events, so the
 * taxonomy can't silently drift and costs nothing to run.
 *
 * Design notes:
 *  - Weighted keyword signals over title + venue + description, with the title
 *    weighted most heavily (it's the truest summary of what an event IS).
 *  - Signals are scoped: venue-only signals (e.g. "brewery") are weak hints, not
 *    verdicts — a brewery hosting a concert is music, not food.
 *  - A "festival" only wins when nothing more specific does. Festival was the
 *    catch-all bucket, so it's deliberately made the WEAKEST claim: an arts
 *    festival is arts, a music festival is music.
 *  - When nothing scores, we keep the agent's suggestion (the caller's fallback)
 *    rather than guessing.
 */

export interface Classifiable {
  title: string;
  venue?: string;
  description?: string;
  category?: string; // the finding agent's guess — used only as a fallback
}

export interface Classification {
  category: CategoryKey;
  confidence: number; // 0 = fallback used, otherwise the winning score
  changed: boolean; // did we override the agent's category?
}

type Signal = { re: RegExp; w: number };

// Weighted signals per category. Word-boundary anchored to avoid substring traps
// (e.g. "art" must not match "party", "fair" must not match "fairly").
const SIGNALS: Record<CategoryKey, Signal[]> = {
  music: [
    { re: /\b(concert|concerts|live music|gig|dj|setlist|tour)\b/, w: 10 },
    { re: /\b(music fest\w*|music series|music night|music in the park)\b/, w: 10 },
    { re: /\b(band|bands|orchestra|symphony|philharmonic|choir|chorale|chorus|ensemble|quartet|quintet|trio)\b/, w: 9 },
    { re: /\b(jazz|blues|indie|hip[- ]?hop|rap|punk|metal|bluegrass|reggae|salsa|funk|r&b|edm|techno|classical|opera|acoustic)\b/, w: 8 },
    // "country" and "rock"/"soul"/"house"/"folk" are ambiguous English words —
    // require a musical context so "Country CLUB", "Rock Climbing", "Soul Food",
    // "House Tour" and "Folk Art" don't get filed as concerts.
    { re: /\b(country|rock|soul|house|folk)\s+(music|band|night|show|concert|fest\w*|jam)\b/, w: 8 },
    { re: /\b(music|concert)\b.*\b(country|rock|soul|house|folk)\b/, w: 6 },
    { re: /\b(singer|songwriter|vocalist|guitarist|drummer|rapper|musician|performs?|performing|headlin\w*|opening act)\b/, w: 6 },
    { re: /\b(open mic|jam session|karaoke|record release|album release|unplugged|recital)\b/, w: 8 },
    { re: /\b(presents|in concert|live at|on tour)\b/, w: 4 },
  ],
  sports: [
    { re: /\b(vs\.?|versus|@)\b.*\b(game|match)?\b/, w: 3 },
    { re: /\b(twins|vikings|timberwolves|wolves|lynx|wild|united|saints|gophers|loons)\b/, w: 9 },
    { re: /\b(game|match|tournament|championship|playoff|scrimmage|meet)\b/, w: 7 },
    { re: /\b(baseball|basketball|football|hockey|soccer|volleyball|lacrosse|tennis|golf|wrestling|boxing|mma)\b/, w: 9 },
    { re: /\b(marathon|half marathon|5k|10k|race|triathlon|cycling|regatta)\b/, w: 8 },
    { re: /\b(target field|target center|xcel energy center|us bank stadium|allianz field|chs field)\b/, w: 6 },
  ],
  family: [
    { re: /\b(kids?|children'?s?|toddler|preschool|all[- ]ages|family[- ]friendly|families)\b/, w: 12 },
    { re: /\b(story ?time|storytime|puppet|petting zoo|face painting|bounce house|playground|play date)\b/, w: 9 },
    { re: /\b(zoo|aquarium|children'?s museum|science museum|nature center|planetarium)\b/, w: 7 },
    { re: /\b(egg hunt|trick[- ]or[- ]treat|santa|easter bunny|summer camp|day camp)\b/, w: 8 },
    { re: /\b(drop[- ]in|make[- ]and[- ]take)\b/, w: 3 },
    { re: /\b(family)\b/, w: 5 },
  ],
  arts: [
    { re: /\b(theatre|theater|play|musical|drama|comedy|improv|stand[- ]?up|cabaret|burlesque)\b/, w: 8 },
    { re: /\b(exhibit|exhibition|gallery|museum|installation|retrospective|curated|curator)\b/, w: 9 },
    { re: /\b(art|arts|artist|painting|sculpture|photography|printmaking|ceramics|pottery)\b/, w: 7 },
    { re: /\b(ballet|dance|choreograph\w*|contemporary dance|tap|modern dance)\b/, w: 8 },
    { re: /\b(poetry|poet|reading|author|literary|book launch|spoken word)\b/, w: 7 },
    { re: /\b(film|screening|cinema|documentary|movie)\b/, w: 7 },
    { re: /\b(craft|workshop|art[- ]making|make[- ]and[- ]take)\b/, w: 5 },
  ],
  food: [
    { re: /\b(tasting|taste of|food truck|pop[- ]?up dinner|chef|dining|restaurant week|prix fixe)\b/, w: 9 },
    { re: /\b(farmers'? market|farmer'?s market|night market|food hall)\b/, w: 8 },
    { re: /\b(cider|wine|winery|cocktail|happy hour|pub crawl|beer tasting|beer garden|barrel[- ]aged)\b/, w: 7 },
    { re: /\b(dinner|brunch|breakfast|lunch|supper|bbq|barbecue|cook[- ]?off|bake sale|pancake)\b/, w: 7 },
    { re: /\b(food|culinary|eats|feast)\b/, w: 5 },
  ],
  festival: [
    // Deliberately weak: festival is the catch-all, so it should only win when
    // nothing more specific does. An "art fair" is arts; a "music festival" is music.
    { re: /\b(festival|fest)\b/, w: 5 },
    { re: /\b(county fair|state fair|carnival|parade|block party|street fair)\b/, w: 8 },
    { re: /\b(celebration|jubilee|days)\b/, w: 3 },
  ],
  weird: [
    { re: /\b(weird|bizarre|quirky|oddities|peculiar|unusual|offbeat|only in minnesota)\b/, w: 9 },
    { re: /\b(rubber duck|cardboard boat|lawn mower rac\w*|hot dish|birkebeiner|polar plunge)\b/, w: 9 },
    { re: /\braffle\b/, w: 9 },
    { re: /\b(competition|contest|championship of)\b.*\b(eating|beard|mustache|costume|air guitar)\b/, w: 9 },
    { re: /\b(seance|paranormal|ghost tour|haunted|cryptid|bigfoot|ufo|alien)\b/, w: 8 },
    { re: /\b(renaissance fair(e)?|medieval|cosplay|anime con|comic con|furry)\b/, w: 6 },
  ],
};

/**
 * PLACE WORDS. These name a VENUE, not a topic — "Day Block Brewing Live Music
 * Event" is music, not food. Because venue names routinely appear inside event
 * titles, these must stay weak *wherever* they occur, so they can never outvote
 * what the event actually is. (This was the bug the golden set caught: brewery
 * words in the title were beating "live music" and "choir".)
 */
const PLACE_WORDS: { re: RegExp; category: CategoryKey; w: number }[] = [
  { re: /\b(brewery|brewing|brewhouse|taproom|distillery|beer hall)\b/, category: "food", w: 2 },
  { re: /\b(beer|brew)\b/, category: "food", w: 2 },
];

// Venue-only hints: weak nudges (a venue suggests, it doesn't decide).
const VENUE_HINTS: { re: RegExp; category: CategoryKey; w: number }[] = [
  { re: /\b(first ave(nue)?|7th st(reet)? entry|turf club|icehouse|palace theatre|fine line|the cedar|dakota|amsterdam bar|hook and ladder|the armory|uptown theater|varsity theater|berlin)\b/, category: "music", w: 6 },
  { re: /\b(target field|target center|xcel energy|us bank stadium|allianz field|chs field|williams arena)\b/, category: "sports", w: 5 },
  { re: /\b(guthrie|orpheum|state theatre|pantages|jungle theater|children'?s theatre|walker art|mia\b|minneapolis institute of art|weisman|museum|gallery)\b/, category: "arts", w: 5 },
  { re: /\b(brewery|brewing|taproom|winery|distillery)\b/, category: "food", w: 3 }, // weak on purpose
  { re: /\b(zoo|aquarium|children'?s museum|nature center)\b/, category: "family", w: 5 },
];

function norm(s: string | undefined): string {
  return (s ?? "").toLowerCase();
}

/** Score every category from the event's own content. Exported for tests/admin. */
export function scoreCategories(ev: Classifiable): Record<CategoryKey, number> {
  const title = norm(ev.title);
  const venue = norm(ev.venue);
  const desc = norm(ev.description);

  const scores = Object.fromEntries(CATEGORY_KEYS.map((k) => [k, 0])) as Record<CategoryKey, number>;

  for (const key of CATEGORY_KEYS) {
    for (const sig of SIGNALS[key]) {
      // Title is the truest signal; description is corroboration; venue is a hint.
      if (sig.re.test(title)) scores[key] += sig.w * 2;
      if (sig.re.test(desc)) scores[key] += sig.w;
      if (sig.re.test(venue)) scores[key] += Math.round(sig.w * 0.5);
    }
  }

  for (const hint of VENUE_HINTS) {
    if (hint.re.test(venue)) scores[hint.category] += hint.w;
  }

  // Place words (brewery, taproom…) name a venue, not a topic. Score them
  // weakly wherever they appear — including in the title, since venue names are
  // routinely embedded there ("Day Block Brewing Live Music Event"). This keeps
  // a venue's name from outvoting what the event actually is.
  const all = `${title} ${venue} ${desc}`;
  for (const place of PLACE_WORDS) {
    if (place.re.test(all)) scores[place.category] += place.w;
  }

  return scores;
}

/**
 * Decide an event's category from its own content. Falls back to the agent's
 * suggestion (ev.category) when nothing scores.
 */
export function classifyEvent(ev: Classifiable): Classification {
  const scores = scoreCategories(ev);

  let best: CategoryKey | null = null;
  let bestScore = 0;
  for (const key of CATEGORY_KEYS) {
    if (scores[key] > bestScore) {
      bestScore = scores[key];
      best = key;
    }
  }

  const suggested = (ev.category ?? "") as CategoryKey;
  const fallback: CategoryKey = CATEGORY_KEYS.includes(suggested) ? suggested : "festival";

  if (!best || bestScore === 0) {
    return { category: fallback, confidence: 0, changed: false };
  }

  return {
    category: best,
    confidence: bestScore,
    changed: best !== fallback,
  };
}
