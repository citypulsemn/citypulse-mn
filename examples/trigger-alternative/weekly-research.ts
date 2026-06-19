// OPTIONAL ALTERNATIVE to scripts/run-pipeline.ts (the GitHub Actions path).
// Same logic, expressed as a Trigger.dev scheduled task. To adopt, see
// trigger.config.ts in this folder. Requires: npm i @trigger.dev/sdk
import { schedules, logger } from "@trigger.dev/sdk";
import { CATEGORY_KEYS } from "../../lib/categories";
import { researchCategory } from "../../lib/agents/research-agent";
import { geocode } from "../../lib/geocode";
import { computeEventKey, normalizeTier } from "../../lib/event-key";
import { upsertEvents, archivePastEvents } from "../../lib/upsert";
import { dueWindows } from "../../lib/horizon";
import { NEW_EVENT_STATUS } from "../../lib/pipeline-config";
import type { DbEventInput } from "../../lib/types";

/**
 * Weekly research as a Trigger.dev scheduled task. Mirrors run-pipeline.ts:
 * loops the horizon bands due this week, fans out per category, upserts drafts.
 */
export const weeklyResearch = schedules.task({
  id: "weekly-event-research",
  cron: "0 6 * * 1", // Mondays 06:00 UTC
  maxDuration: 3600,
  run: async () => {
    const windows = dueWindows(new Date());
    let totalUpserted = 0;
    const perBand: Record<string, number> = {};

    for (const win of windows) {
      logger.info(`band ${win.label}: ${win.startDate} → ${win.endDate}`);
      let bandTotal = 0;

      for (const category of CATEGORY_KEYS) {
        let found;
        try {
          found = await researchCategory(category, win.startDate, win.endDate, win.maxSearchUses);
        } catch (err) {
          logger.error(`${win.label}/${category} failed`, { err: String(err) });
          continue;
        }

        const normalized: DbEventInput[] = [];
        for (const ev of found) {
          const geo = await geocode(ev.address, ev.city);
          if (!geo) continue;
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
            status: NEW_EVENT_STATUS,
          });
        }

        bandTotal += await upsertEvents(normalized);
      }
      perBand[win.label] = bandTotal;
      totalUpserted += bandTotal;
    }

    const archived = await archivePastEvents();
    logger.info(`done — upserted ${totalUpserted}, archived ${archived}`, perBand);
    return { totalUpserted, perBand, archived };
  },
});
