/**
 * Canonicalization for the dedup key (Layer 2).
 *
 * Goal: make MORE true-duplicates produce the SAME event_key by cleaning the
 * inputs harder before they're hashed — without ever merging events that are
 * genuinely different. Everything here is deterministic and conservative.
 * Anything uncertain is intentionally left for the fuzzy review query
 * (see db/review-duplicates.sql) so a human resolves it, not this code.
 */

/** Base normalizer: lowercase, strip diacritics/punctuation, collapse spaces. */
export function normalizeKeyPart(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // diacritics
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}


/**
 * Fold a title to comparable ASCII, for MATCHING — never for keying.
 *
 * normalizeKeyPart above feeds event_key and must never change: editing it
 * would re-key every row in the database. This is its safer cousin, used by the
 * music importer and the contradiction check, and it goes further in the one
 * place that matters: letters Unicode will not decompose. NFKD leaves "ı" and
 * "ø" alone, so a bare a-z filter turned "Altın Gün" into "alt n" and "Eivør"
 * into "eiv r" — names that could not match themselves.
 */
const TRANSLIT: Record<string, string> = {
  ı: "i", ø: "o", Ø: "o", ł: "l", æ: "ae", œ: "oe", ß: "ss",
  đ: "d", ð: "d", þ: "th", ħ: "h", ŋ: "n", ſ: "s",
};

export function foldTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[ıøØłœæßđðþħŋſ]/g, (ch) => TRANSLIT[ch] ?? ch)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Known venue name variants → one canonical (NORMALIZED) form.
 * Keys are already normalized (lowercase, no punctuation). Edit freely as you
 * notice new variants during review — this is the highest-payoff lever because
 * the Twin Cities venue set is small and finite.
 *
 * Note: many "variants" already collapse via normalizeKeyPart and need no entry
 * here — e.g. "U.S. Bank Stadium" and "US Bank Stadium" both normalize to
 * "us bank stadium" on their own. Only add genuinely different spellings.
 */
export const VENUE_ALIASES: Record<string, string> = {
  "first ave": "first avenue",
  "first avenue mainroom": "first avenue",
  "the armory": "armory",
  "armory minneapolis": "armory",
  "the fine line": "fine line",
  "fine line music cafe": "fine line",
  "7th st entry": "7th street entry",
  "the cabooze": "cabooze",
  "xcel": "xcel energy center",
  "xcel energy ctr": "xcel energy center",
  "the palace theatre": "palace theatre",
  "the palace theater": "palace theatre",
  "palace theater": "palace theatre",
};

/** Normalize a venue, then fold known aliases to one canonical name. */
export function canonicalizeVenue(venue: string): string {
  const n = normalizeKeyPart(venue);
  return VENUE_ALIASES[n] ?? n;
}

/**
 * Conservative title cleanup. ONLY transformations that won't merge distinct
 * events:
 *   - strip trailing parentheticals / brackets: "(21+)", "(SOLD OUT)", "[FREE]"
 *   - drop a single leading "the "
 *   - normalize versus separators: "versus" / "vs" / "vs." / "v." → "vs"
 * Deliberately does NOT expand abbreviations or team names — that's review-only.
 */
export function canonicalizeTitle(title: string): string {
  let t = title.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");

  // strip one or more trailing (...) or [...] groups
  let prev: string;
  do {
    prev = t;
    t = t.replace(/[([][^()[\]]*[)\]]\s*$/u, "").trim();
  } while (t !== prev);

  // normalize versus separators (require a period for the bare "v" form)
  t = t.replace(/\b(?:versus|vs\.?|v\.)(?=\s|$)/g, "vs");

  // drop a single leading "the "
  t = t.replace(/^the\s+/, "");

  // finish with the base normalizer (removes remaining punctuation, collapses)
  return normalizeKeyPart(t);
}
