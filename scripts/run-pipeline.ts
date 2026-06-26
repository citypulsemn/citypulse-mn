/**
 * City Pulse MN — weekly research pipeline (the orchestrator).
 *
 * Run locally:   npm run pipeline
 * Run in CI:     .github/workflows/weekly-research.yml (cron, weekly)
 *
 * Flow: for each horizon band (near/mid/far) due this week, fan out one research
 * subagent per category → geocode + normalize → idempotent UPSERT as drafts →
 * archive past events. Re-running never duplicates (dedup on event_key); the
 * sliding bands re-research and enrich events as their date approaches.
 *
 * Needs env: DATABASE_URL, ANTHROPIC_API_KEY, and a Mapbox token
 * (MAPBOX_GEOCODING_TOKEN or NEXT_PUBLIC_MAPBOX_TOKEN).
 */
import { CATEGORY_KEYS } from "../lib/categories";
import { researchCategory } from "../lib/agents/research-agent";
import { geocode } from "../lib/geocode";
import { computeEventKey, normalizeTier } from "../lib/event-key";
import { upsertEvents, archivePastEvents, markCancelled, dedupeNearDuplicates } from "../lib/upsert";
import { partitionCancellations } from "../lib/cancellations";
import { dueWindows } from "../lib/horizon";
import { NEW_EVENT_STATUS } from "../lib/pipeline-config";
import { sql } from "../lib/db";
import type { DbEventInput } from "../lib/types";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is required");

  const windows = dueWindows(new Date());
  console.log(
    `[pipeline] ${windows.length} band(s) due: ` +
      windows.map((w) => `${w.label} (${w.startDate}→${w.endDate})`).join(", "),
  );

  let totalUpserted = 0;
  const perBand: Record<string, number> = {};

  for (const win of windows) {
    console.log(`\n[pipeline] === band: ${win.label} (${win.startDate} → ${win.endDate}) ===`);
    let bandTotal = 0;

    for (const category of CATEGORY_KEYS) {
      console.log(`[pipeline] ${win.label}/${category}…`);
      let found;
      try {
        found = await researchCategory(category, win.startDate, win.endDate, win.maxSearchUses);
      } catch (err) {
        console.error(`[pipeline] ${win.label}/${category} agent failed:`, err);
        continue; // one category failing shouldn't sink the run
      }

      const { active, cancelledKeys } = partitionCancellations(found);

      const normalized: DbEventInput[] = [];
      for (const ev of active) {
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
          status: NEW_EVENT_STATUS, // auto-published; revert to draft in the DB to hide
        });
      }

      const n = await upsertEvents(normalized);
      const cancelled = await markCancelled(cancelledKeys);
      bandTotal += n;
      if (cancelled > 0) console.log(`[pipeline] ${win.label}/${category}: cancelled ${cancelled}`);
      console.log(`[pipeline] ${win.label}/${category}: upserted ${n}`);
    }

    perBand[win.label] = bandTotal;
    totalUpserted += bandTotal;
  }

  const collapsed = await dedupeNearDuplicates();
  if (collapsed > 0) console.log(`[pipeline] collapsed ${collapsed} near-duplicate(s)`);

  const archived = await archivePastEvents();
  console.log(
    `\n[pipeline] done — upserted ${totalUpserted}, archived ${archived}`,
    perBand,
  );

  await sql?.end({ timeout: 5 });
}

main().catch((err) => {
  console.error("[pipeline] fatal:", err);
  process.exitCode = 1;
});
