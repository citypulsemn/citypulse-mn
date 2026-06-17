// OPTIONAL ALTERNATIVE to scripts/run-pipeline.ts (the GitHub Actions path).
// Same logic, expressed as a Trigger.dev scheduled task. To adopt, see
// trigger.config.ts in this folder. Requires: npm i @trigger.dev/sdk
import { schedules, logger } from "@trigger.dev/sdk";
import { CATEGORY_KEYS } from "../../lib/categories";
import { researchCategory } from "../../lib/agents/research-agent";
import { geocode } from "../../lib/geocode";
import { computeEventKey, normalizeTier } from "../../lib/event-key";
import { upsertEvents, archivePastEvents } from "../../lib/upsert";
import type { DbEventInput } from "../../lib/types";

/**
 * The orchestrator (the "Opus plans" role). Runs weekly, fans out one research
 * subagent per category, normalizes + geocodes the results, and UPSERTs them as
 * drafts. You then flip drafts → published in the DB (the review gate).
 *
 * Idempotent: re-running never duplicates events (dedup on event_key).
 */
export const weeklyResearch = schedules.task({
  id: "weekly-event-research",
  // Mondays at 06:00 UTC. Adjust in the Trigger.dev dashboard or here.
  cron: "0 6 * * 1",
  maxDuration: 3600,
  run: async () => {
    const { startDate, endDate } = lookaheadWindow(14);
    logger.info(`Weekly research window: ${startDate} → ${endDate}`);

    let totalUpserted = 0;
    const perCategory: Record<string, number> = {};

    for (const category of CATEGORY_KEYS) {
      logger.info(`Researching ${category}…`);
      let found;
      try {
        found = await researchCategory(category, startDate, endDate);
      } catch (err) {
        logger.error(`${category} agent failed`, { err: String(err) });
        continue; // one category failing shouldn't sink the whole run
      }

      const normalized: DbEventInput[] = [];
      for (const ev of found) {
        const geo = await geocode(ev.address, ev.city);
        if (!geo) {
          logger.warn(`Skipping (no geocode): ${ev.title} @ ${ev.venue}`);
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
          status: "draft", // review gate: published by a human
        });
      }

      const n = await upsertEvents(normalized);
      perCategory[category] = n;
      totalUpserted += n;
      logger.info(`${category}: upserted ${n}`);
    }

    const archived = await archivePastEvents();
    logger.info(`Run complete. Upserted ${totalUpserted}, archived ${archived}.`);
    return { totalUpserted, perCategory, archived };
  },
});

/** Returns ISO dates for [today, today + days]. */
function lookaheadWindow(days: number): { startDate: string; endDate: string } {
  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + days);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}
