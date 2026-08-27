import type { ReelContent, WeekWindow } from "./types";
import { DETAILS_HARD_CAP } from "./format";

/**
 * Pre-render gate for one reel's content. Errors block the build; warnings
 * ride along into the ReelResult so the ops digest can surface them.
 */

export function countWords(s: string): number {
  const trimmed = s.trim();
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
}

const MAX_NAME_CHARS = 60;
// The toolkit says "5 words max" but its own example is 6 and the published
// reels run to 7 ("Kids Earn Market Money at Pop Club", r59) — 7 is the cap
// the owner actually ships. Weird's periods-as-beats run longer (char-capped).
const MAX_NAME_WORDS = 7;
const MAX_CAPTION_WORDS = 100; // exclusive — 100 words is already too many
const BROLL_LINES = 7;
const TERMS_PER_LINE = 3;
const MIN_TERM_WORDS = 2;
const MAX_TERM_WORDS = 5; // 4 normally; 5 when a shot-type modifier is baked in

const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;

/** Not-Minneapolis giveaways — stock footage that screams "somewhere else". */
const BANNED_BROLL = [
  "palm", "beach", "ocean", "tropical", "mountain", "europe", "european",
  "cobblestone", "terracotta", "desert", "coastline",
];

/**
 * Season mismatches are warnings, not errors — indoor events legitimately
 * vary. All four seasons covered (the toolkit's seasonal lock names all four):
 * warm-water terms flag in fall/winter, snow terms flag in spring/summer.
 */
const SUMMER_MISMATCH = ["snow", "ice skating", "frozen", "foliage", "autumn", "sledding"];
const WINTER_MISMATCH = ["kayak", "paddleboard", "swimming", "patio dining", "beach"];
const SPRING_MISMATCH = ["snow", "frozen", "foliage", "autumn", "sledding", "ice skating"];
const FALL_MISMATCH = ["kayak", "paddleboard", "swimming", "splash pad"];

export function validateReelContent(
  content: ReelContent,
  window: WeekWindow,
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { card, caption, broll } = content;

  if (card.events.length !== 5) {
    errors.push(`card has ${card.events.length} events (need exactly 5)`);
  }

  card.events.forEach((ev, i) => {
    const n = i + 1;
    if (ev.name.trim() === "") {
      errors.push(`event ${n}: empty name`);
    } else if (ev.name.length > MAX_NAME_CHARS) {
      errors.push(`event ${n}: name over ${MAX_NAME_CHARS} chars (${ev.name.length})`);
    }
    if (content.variant !== "weird" && countWords(ev.name) > MAX_NAME_WORDS) {
      errors.push(`event ${n}: name over ${MAX_NAME_WORDS} words (${countWords(ev.name)})`);
    }
    if (ev.details.includes("\n")) {
      errors.push(`event ${n}: details contains a newline`);
    }
    if (ev.details.length > DETAILS_HARD_CAP) {
      errors.push(`event ${n}: details over ${DETAILS_HARD_CAP} chars (${ev.details.length})`);
    }
    const segments = ev.details.split(" · ");
    const last = (segments[segments.length - 1] ?? "").trim();
    if (segments.length < 2 || last === "" || last === "$") {
      errors.push(`event ${n}: details missing final price segment`);
    }
  });

  const cardText = [card.header, card.cta, ...card.events.flatMap((e) => [e.name, e.details])]
    .join("\n");
  if (EMOJI_RE.test(cardText)) errors.push("card contains emoji");

  const captionWords = countWords(caption);
  if (captionWords >= MAX_CAPTION_WORDS) {
    errors.push(`caption is ${captionWords} words (must be under ${MAX_CAPTION_WORDS})`);
  }
  if (caption.includes("#")) errors.push("caption contains a hashtag");
  if (EMOJI_RE.test(caption)) errors.push("caption contains emoji");
  // Em/en dashes and the spaced hyphen are the tells; "Kid-Friendly" is fine.
  if (/[—–]/.test(caption) || caption.includes(" - ")) {
    errors.push("caption contains a dash (em dash, en dash, or spaced hyphen)");
  }

  if (broll.length !== BROLL_LINES) {
    errors.push(`broll has ${broll.length} lines (need exactly ${BROLL_LINES})`);
  }

  const month = Number(window.start.slice(5, 7));
  const mismatchTerms =
    month >= 6 && month <= 8 ? SUMMER_MISMATCH
    : month === 12 || month <= 2 ? WINTER_MISMATCH
    : month >= 3 && month <= 5 ? SPRING_MISMATCH
    : FALL_MISMATCH;

  broll.forEach((line, i) => {
    const label = line.label || `line ${i + 1}`;
    if (line.terms.length !== TERMS_PER_LINE) {
      errors.push(`broll ${label}: ${line.terms.length} terms (need exactly ${TERMS_PER_LINE})`);
    }
    for (const term of line.terms) {
      const words = countWords(term);
      if (words < MIN_TERM_WORDS || words > MAX_TERM_WORDS) {
        errors.push(
          `broll ${label}: term "${term}" is ${words} words (need ${MIN_TERM_WORDS} to ${MAX_TERM_WORDS})`,
        );
      }
      const lower = term.toLowerCase();
      const banned = BANNED_BROLL.find((b) => lower.includes(b));
      if (banned) {
        errors.push(`broll ${label}: term "${term}" contains banned word "${banned}"`);
      }
      const mismatch = mismatchTerms.find((m) => lower.includes(m));
      if (mismatch) {
        warnings.push(`broll ${label}: term "${term}" looks out of season ("${mismatch}")`);
      }
    }
    const expected = ((window.shotTypeKey + i) % 4) as 0 | 1 | 2 | 3;
    if (line.shotType !== expected) {
      errors.push(`broll ${label}: shotType ${line.shotType}, rotation expects ${expected}`);
    }
  });

  return { errors, warnings };
}
