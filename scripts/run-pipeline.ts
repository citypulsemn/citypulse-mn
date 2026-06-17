/**
 * City Pulse MN — weekly research pipeline (the orchestrator).
 *
 * Run locally:   npm run pipeline
 * Run in CI:     .github/workflows/weekly-research.yml (cron, weekly)
 *
 * Flow: fan out one research subagent per category → geocode + normalize →
 * idempotent UPSERT as drafts → archive past events. Re-running never
 * duplicates (dedup on event_key). You publish drafts via the DB (review gate).
 *
 * Needs env: DATABASE_URL, ANTHROPIC_API_KEY, and a Mapbox token
 * (MAPBOX_GEOCODING_TOKEN or NEXT_PUBLIC_MAPBOX_TOKEN).
 */
import { CATEGORY_KEYS } from "../lib/categories";
import { researchCategory } from "../lib/agents/research-agent";
import { geocode } from "../lib/geocode";
import { computeEventKey, normalizeTier } from "../lib/event-key";
import { upsertEvents, archivePastEvents } from "../lib/upsert";
import { sql } from "../lib/db";
import type { DbEventInput } from "../lib/types";

const LOOKAHEAD_DAYS = 14;

function lookaheadWindow(days: number) {
  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + days);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is required");

  const { startDate, endDate } = lookaheadWindow(LOOKAHEAD_DAYS);
  console.log(`[pipeline] window ${startDate} → ${endDate}`);

  let totalUpserted = 0;
  const perCategory: Record<string, number> = {};

  for (const category of CATEGORY_KEYS) {
    console.log(`[pipeline] researching ${category}…`);
    let found;
    try {
      found = await researchCategory(category, startDate, endDate);
    } catch (err) {
      console.error(`[pipeline] ${category} agent failed:`, err);
      continue; // one category failing shouldn't sink the run
    }

    const normalized: DbEventInput[] = [];
    for (const ev of found) {
      const geo = await geocode(ev.address, ev.city);
      if (!geo) {
        console.warn(`[pipeline] no geocode, skipping: ${ev.title} @ ${ev.venue}`);
        continue;
      }
      normalized.push({
        event_key: computeEventKey(ev.title, ev.venue, ev.start),
        title: ev.title,
        category,
        venue: ev.venue,
        address: ev.address,
        city: ev.city,
        lat: geo.lat,
        lng: geo.lng,
        start_at: ev.start,
        end_at: ev.end || null,
        price: ev.price || "See listing",
        priceTier: normalizeTier(ev.price),
        ticket_url: ev.ticket_url,
        description: ev.description,
        image: ev.image ?? "",
        source_url: ev.source_url,
        status: "draft", // review gate: a human flips drafts → published
      });
    }

    const n = await upsertEvents(normalized);
    perCategory[category] = n;
    totalUpserted += n;
    console.log(`[pipeline] ${category}: upserted ${n}`);
  }

  const archived = await archivePastEvents();
  console.log(
    `[pipeline] done — upserted ${totalUpserted}, archived ${archived}`,
    perCategory,
  );

  await sql?.end({ timeout: 5 });
}

main().catch((err) => {
  console.error("[pipeline] fatal:", err);
  process.exitCode = 1;
});
