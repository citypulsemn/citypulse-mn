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
import { validateReelContent } from "./validate";

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
    caption: copy.caption,
    broll: copy.broll.map(
      (b, i): BrollLine => ({
        label: b.label,
        terms: b.terms,
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
