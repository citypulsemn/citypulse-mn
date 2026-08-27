import Anthropic from "@anthropic-ai/sdk";
import type { CategoryKey } from "../types";
import { CATEGORY_KEYS } from "../categories";
import type { CandidateEvent, Variant, WeekWindow } from "./types";
import { buildTopUpPrompt } from "./prompts";
import { familyGateReason, localWall, screenEvent } from "./select-events";

/**
 * Web top-up for a short variant pool: when the DB gave fewer than 5 events,
 * a web-search agent finds the shortfall. Every row must carry a real source
 * URL; rows that don't are skipped with a warning, never patched — the same
 * honest-emptiness rule as the main pipeline.
 */

export interface TopUpDeps {
  completeWithSearch(prompt: string): Promise<string>;
}

// Lazy so importing this module (tests use fake deps) never requires
// ANTHROPIC_API_KEY — the SDK throws at construction without it.
let client: Anthropic | null = null;
function anthropicClient(): Anthropic {
  client ??= new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: 600_000,
    maxRetries: 3,
  });
  return client;
}

export const realTopUpDeps: TopUpDeps = {
  async completeWithSearch(prompt: string): Promise<string> {
    // Streamed for the same reason as research-agent.ts: web-search runs are
    // long, and non-streaming calls get cut mid-response ("Premature close").
    const stream = anthropicClient().messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 8000,
      tools: [
        { type: "web_search_20250305", name: "web_search", max_uses: 8 },
      ] as unknown as Anthropic.Tool[],
      messages: [{ role: "user", content: prompt }],
    });
    const res = await stream.finalMessage();
    return res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
  },
};

export interface TopUpResult {
  events: CandidateEvent[];
  warnings: string[];
}

/** Where a row's category is unusable, fall back to the variant's home turf. */
const FALLBACK_CATEGORY: Record<Variant, CategoryKey> = {
  regular: "arts",
  family: "family",
  weird: "weird",
};

const PRICE_TIERS: readonly CandidateEvent["priceTier"][] = ["Free", "$", "$$", "$$$"];

// Never guess "Free" from a bad tier — a wrong Free burns trust worse than a
// wrong dollar sign. Only the price text saying so earns it; otherwise mid-tier.
function coerceTier(tier: unknown, price: string): CandidateEvent["priceTier"] {
  if (typeof tier === "string" && (PRICE_TIERS as readonly string[]).includes(tier)) {
    return tier as CandidateEvent["priceTier"];
  }
  return /free/i.test(price) ? "Free" : "$$";
}

const ISO_START_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/**
 * Parse the agent's fenced JSON array (tolerating a bare unfenced array) into
 * CandidateEvents. Rows missing title/startAt/sourceUrl or with an unparseable
 * startAt are skipped with a warning. Garbage input is an honest empty result
 * with one warning — never a throw, never invented rows.
 */
export function parseTopUpEvents(text: string, fallbackCategory: CategoryKey): TopUpResult {
  const warnings: string[] = [];
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const raw = (fenced ? fenced[1] : text).trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { events: [], warnings: ["top-up reply was not valid JSON; no events used"] };
  }
  if (!Array.isArray(parsed)) {
    return { events: [], warnings: ["top-up reply was not a JSON array; no events used"] };
  }

  const events: CandidateEvent[] = [];
  parsed.forEach((item, i) => {
    const e = item as Record<string, unknown>;
    const label = typeof e?.title === "string" && e.title !== "" ? `"${e.title}"` : `row ${i + 1}`;
    if (!e?.title) {
      warnings.push(`${label}: missing title — skipped`);
      return;
    }
    if (!e.startAt || !ISO_START_RE.test(String(e.startAt))) {
      warnings.push(`${label}: missing or unparseable startAt — skipped`);
      return;
    }
    if (!e.sourceUrl) {
      warnings.push(`${label}: missing sourceUrl — skipped (unverified events never ship)`);
      return;
    }

    let category = e.category as CategoryKey;
    if (!CATEGORY_KEYS.includes(category)) {
      warnings.push(`${label}: category "${String(e.category)}" is not valid — using "${fallbackCategory}"`);
      category = fallbackCategory;
    }
    const price = String(e.price ?? "See listing");
    events.push({
      id: null,
      title: String(e.title),
      category,
      venue: String(e.venue ?? ""),
      city: String(e.city ?? ""),
      startAt: String(e.startAt),
      endAt: e.endAt ? String(e.endAt) : null,
      price,
      priceTier: coerceTier(e.priceTier, price),
      sourceUrl: String(e.sourceUrl),
      description: String(e.description ?? ""),
    });
  });

  return { events, warnings };
}

export async function topUpVariant(
  variant: Variant,
  window: WeekWindow,
  need: number,
  haveTitles: string[],
  deps: TopUpDeps = realTopUpDeps,
): Promise<TopUpResult> {
  if (need <= 0) return { events: [], warnings: [] };

  const text = await deps.completeWithSearch(buildTopUpPrompt(variant, window, need, haveTitles));
  const { events, warnings } = parseTopUpEvents(text, FALLBACK_CATEGORY[variant]);

  const have = new Set(haveTitles.map((t) => t.trim().toLowerCase()));
  const kept: CandidateEvent[] = [];
  for (const e of events) {
    // The locked brand rules are enforced in CODE here, not just by the
    // prompt's STRICTLY EXCLUDE wording — a model that ignores the prompt
    // must not be able to put a rule-breaking event on a card.
    const brand = screenEvent(e);
    if (brand) {
      warnings.push(`"${e.title}" dropped — ${brand}`);
      continue;
    }
    if (variant === "family") {
      const gate = familyGateReason(e);
      if (gate) {
        warnings.push(`"${e.title}" dropped — ${gate}`);
        continue;
      }
    }
    // Clamp to the window by dropping, never by shifting a date we didn't
    // attest. Judged on the Minneapolis wall date, same as partitionEvents.
    const day = (localWall(e) ?? e.startAt).slice(0, 10);
    if (day < window.start || day > window.end) {
      warnings.push(`"${e.title}" starts ${day}, outside ${window.start}..${window.end} — dropped`);
      continue;
    }
    if (have.has(e.title.trim().toLowerCase())) {
      warnings.push(`"${e.title}" duplicates an event already on the card — dropped`);
      continue;
    }
    kept.push(e);
  }
  return { events: kept, warnings };
}
