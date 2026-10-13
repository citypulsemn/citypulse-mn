import Anthropic from "@anthropic-ai/sdk";
import type {
  BrollLine,
  CardEventLine,
  PostDay,
  ReelContent,
  Variant,
  VariantSelection,
  WeekWindow,
} from "./types";
import { buildCopywriterPrompt } from "./prompts";
import { CTA_LINE, detailsLine, headerFor } from "./format";
import { MAX_TERM_WORDS, validateReelContent } from "./validate";
import { logUsage } from "../api-usage";

/**
 * The copywriter step: one Claude call turns a variant's 5 selected events
 * into card names, a caption, and a b-roll term plan. Details lines, header,
 * and CTA are deterministic (format.ts) — the model only writes the parts
 * that need a voice. Output is gated by validate.ts with exactly one retry;
 * a reel that still fails is thrown, never shipped.
 */

export interface CopywriterDeps {
  complete(prompt: string): Promise<string>;
}

// Constructed lazily so importing this module (e.g. in tests with fake deps)
// never requires ANTHROPIC_API_KEY — the SDK throws at construction without it.
let client: Anthropic | null = null;
function anthropicClient(): Anthropic {
  client ??= new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: 600_000,
    maxRetries: 3,
  });
  return client;
}

export const realCopywriterDeps: CopywriterDeps = {
  async complete(prompt: string): Promise<string> {
    // No web search here, so a plain non-streaming call is fine.
    const res = await anthropicClient().messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    });
    // See the note in authenticity.ts: its own client, so its own accounting.
    logUsage("reels:copy", "claude-sonnet-4-6", res.usage);
    return res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
  },
};

export interface CopyJson {
  names: string[];
  caption: string;
  broll: { label: string; terms: string[] }[];
}

const snippet = (t: string) => (t.length > 200 ? `${t.slice(0, 200)}…` : t);

/**
 * Extract the copywriter's fenced JSON (tolerating a bare unfenced object).
 * Shape problems throw descriptively; COUNT problems (wrong number of names
 * or b-roll lines) are left for the validator so they hit the retry path.
 */
export function parseCopyJson(text: string): CopyJson {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const raw = (fenced ? fenced[1] : text).trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`copywriter reply is not valid JSON (fenced or raw): "${snippet(raw)}"`);
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`copywriter reply is not a JSON object: "${snippet(raw)}"`);
  }

  const obj = parsed as Record<string, unknown>;
  const missing = ["names", "caption", "broll"].filter((k) => !(k in obj));
  if (missing.length > 0) {
    throw new Error(`copywriter reply is missing key(s): ${missing.join(", ")}`);
  }
  if (!Array.isArray(obj.names)) throw new Error(`copywriter reply "names" is not an array`);
  if (typeof obj.caption !== "string") throw new Error(`copywriter reply "caption" is not a string`);
  if (!Array.isArray(obj.broll)) throw new Error(`copywriter reply "broll" is not an array`);

  return {
    names: obj.names.map(String),
    caption: obj.caption,
    broll: obj.broll.map((item) => {
      const b = item as Record<string, unknown>;
      return {
        label: String(b?.label ?? ""),
        terms: Array.isArray(b?.terms) ? b.terms.map(String) : [],
      };
    }),
  };
}

/**
 * A word a range can run between: anything with a digit, a clock word, a
 * weekday or a month, written out or in the usual short form. "May" and
 * "Sat" are words too; reading them as values only costs a retry, never a
 * meaning. ("Markets" is not March: the short forms match whole words only.)
 */
const VALUE_WORD =
  /\d|^(?:a\.?m|p\.?m|noon|midnight|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?|jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?$/i;
const bare = (word: string) => word.replace(/^[^\w$]+|[^\w.]+$/g, "");
// A neighbour ends at whitespace OR at another dash: in "2–for–1" the word
// beside the first dash is "for", not "for–1", or the deal reads "2 to for to 1".
const lastWord = (s: string) => bare(/([^\s—–]+)[ \t]*$/.exec(s)?.[1] ?? "");
const firstWord = (s: string) => bare(/^[ \t]*([^\s—–]+)/.exec(s)?.[1] ?? "");
const LINE_END = /^(?:\r?\n|$)/;
// Nothing to join onto: the start of a line, or an opening bracket or quote.
const OPENING = /(?:^|\n|[(\["'“‘])$/;

/**
 * Dashes in a caption are a house-style rule, not an honesty rule, so the
 * ordinary one is repaired rather than fatal. Before this, a model that wrote
 * a dash on both attempts cost the whole reel (the regular reel, two Fridays
 * running: 2026-09-04 and 2026-09-11).
 *
 * The repair must never change what the caption says, so it is decided by
 * the words on either side of the dash:
 *  - between two ordinary words it is an aside ("Big weekend — five picks")
 *    and becomes a comma;
 *  - an UNSPACED en dash between two values is a range ("10 AM–2 PM",
 *    "Oct 9–Nov 1", "Tuesday–Friday"), and the locked details lines the
 *    model reads are full of them. It becomes " to ": a comma would print
 *    two start times the data never gave;
 *  - every other dash that touches a value ("Doors 9 - 5", "Doors at 7 —
 *    21 and up", "Fri - Sun"), and an unspaced en dash between two plain
 *    words ("Minneapolis–St. Paul" is a name), cannot be read safely here.
 *    Those are LEFT IN, so the validator rejects the caption and the model
 *    is asked again, exactly as before.
 * Line breaks are never consumed, and no comma is left dangling at the start
 * or end of a line or against other punctuation. Hyphens inside words
 * ("Kid-Friendly") are untouched.
 */
export function tidyCaption(caption: string): string {
  return caption
    .replace(/[ \t]*[—–][ \t]*| - /g, (dash, at: number, whole: string) => {
      const before = whole.slice(0, at);
      const after = whole.slice(at + dash.length);
      const unspacedEn = dash === "–";
      const valueBefore = VALUE_WORD.test(lastWord(before));
      const valueAfter = VALUE_WORD.test(firstWord(after));
      if (unspacedEn && valueBefore && valueAfter) return " to ";
      if (valueBefore || valueAfter) return dash;
      if (unspacedEn && /[A-Za-z]$/.test(before) && /^[A-Za-z]/.test(after)) return dash;
      if (OPENING.test(before) || LINE_END.test(after) || /^[.,!?;:]/.test(after)) return "";
      if (/[.,!?;:]$/.test(before)) return " ";
      return ", ";
    })
    .replace(/,(?:[ \t]*,)+/g, ",");
}

/**
 * A b-roll term is a stock-footage search string, and its length is a search
 * heuristic. One word over the cap used to cost the reel (the family reel,
 * twice: 2026-08-31 and 2026-09-25). The subject leads and the shot
 * modifiers trail ("Mall of America ride close up"), so the tail is what goes.
 * A too-SHORT term is left for the validator: there is nothing honest to add.
 */
export function clampTerm(term: string): string {
  return term.trim().split(/\s+/).slice(0, MAX_TERM_WORDS).join(" ");
}

function assemble(
  day: PostDay,
  variant: Variant,
  window: WeekWindow,
  details: string[],
  copy: CopyJson,
): ReelContent {
  // Zip over the LONGER side so a surplus or shortfall of names surfaces as a
  // validation error (empty name / wrong event count) instead of vanishing.
  const rows = Math.max(copy.names.length, details.length);
  const events: CardEventLine[] = [];
  for (let i = 0; i < rows; i++) {
    events.push({ name: copy.names[i] ?? "", details: details[i] ?? "" });
  }
  return {
    day,
    variant,
    card: { variant, header: headerFor(day, variant, window), events, cta: CTA_LINE },
    caption: tidyCaption(copy.caption),
    broll: copy.broll.map(
      (b, i): BrollLine => ({
        label: b.label,
        terms: b.terms.map(clampTerm),
        shotType: ((window.shotTypeKey + i) % 4) as BrollLine["shotType"],
      }),
    ),
  };
}

export async function writeReelContent(
  day: PostDay,
  variant: Variant,
  window: WeekWindow,
  selection: VariantSelection,
  deps: CopywriterDeps = realCopywriterDeps,
): Promise<ReelContent> {
  // Guard before spending model calls: a short selection can never validate
  // (the details rows are fixed), and mismatched arguments are a caller bug.
  if (selection.events.length !== 5) {
    throw new Error(
      `${day}/${variant}: selection has ${selection.events.length} events — ` +
        `top-up must bring it to exactly 5 before copywriting`,
    );
  }
  if (selection.variant !== variant || window.postDay !== day) {
    throw new Error(
      `${day}/${variant}: mismatched arguments (selection is ${selection.variant}, ` +
        `window is ${window.postDay})`,
    );
  }
  const details = selection.events.map((e) => detailsLine(e, window));
  const prompt = buildCopywriterPrompt(day, variant, window, selection.events, details);

  let content = assemble(day, variant, window, details, parseCopyJson(await deps.complete(prompt)));
  let { errors } = validateReelContent(content, window);
  if (errors.length === 0) return content;

  const retryPrompt =
    `${prompt}\n\nYour previous output failed validation: ${errors.join("; ")}. ` +
    `Return corrected JSON only.`;
  content = assemble(day, variant, window, details, parseCopyJson(await deps.complete(retryPrompt)));
  ({ errors } = validateReelContent(content, window));
  if (errors.length > 0) {
    throw new Error(
      `${day}/${variant} reel content failed validation after retry: ${errors.join("; ")}`,
    );
  }
  return content;
}
