import Anthropic from "@anthropic-ai/sdk";
import type { CategoryKey } from "../types";
import { CATEGORY_KEYS } from "../categories";
import { buildResearchPrompt } from "./prompts";

/**
 * A category research subagent. Runs Claude (Sonnet) with the web_search tool
 * to find real events, then returns structured rows. Sonnet is used per the
 * "Opus plans, Sonnet executes" split — the orchestrator (the Trigger.dev task)
 * fans out one of these per category.
 */

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/** Raw event as returned by the agent, before geocoding/normalization. */
export interface AgentEvent {
  title: string;
  category: CategoryKey;
  venue: string;
  address: string;
  city: string;
  start: string;
  end: string;
  price: string;
  ticket_url: string;
  description: string;
  source_url: string;
  image?: string;
}

export async function researchCategory(
  category: CategoryKey,
  startDate: string,
  endDate: string,
  maxSearchUses = 8,
): Promise<AgentEvent[]> {
  const res = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8000,
    // Web search is a server tool; the SDK's tool union is version-specific,
    // so we type the array loosely.
    tools: [
      { type: "web_search_20250305", name: "web_search", max_uses: maxSearchUses },
    ] as unknown as Anthropic.Tool[],
    messages: [
      { role: "user", content: buildResearchPrompt(category, startDate, endDate) },
    ],
  });

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  return parseAgentEvents(text, category);
}

/** Extract the JSON array from the model's reply and coerce to AgentEvent[]. */
export function parseAgentEvents(text: string, category: CategoryKey): AgentEvent[] {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const raw = (fenced ? fenced[1] : text).trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const out: AgentEvent[] = [];
  for (const item of parsed) {
    const e = item as Record<string, unknown>;
    if (!e.title || !e.start) continue;
    const cat = (typeof e.category === "string" ? e.category : category) as CategoryKey;
    out.push({
      title: String(e.title),
      category: CATEGORY_KEYS.includes(cat) ? cat : category,
      venue: String(e.venue ?? ""),
      address: String(e.address ?? ""),
      city: String(e.city ?? ""),
      start: String(e.start),
      end: String(e.end ?? e.start),
      price: String(e.price ?? "See listing"),
      ticket_url: String(e.ticket_url ?? ""),
      description: String(e.description ?? ""),
      source_url: String(e.source_url ?? ""),
      image: e.image ? String(e.image) : undefined,
    });
  }
  return out;
}
