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
import { researchCategory, researchVenueShard } from "../lib/agents/research-agent";
import type { AgentEvent } from "../lib/agents/research-agent";
import { classifyEvent } from "../lib/classify";
import { venuesFor, shardVenues, isVenueAnchored } from "../lib/venues";
import { normalizeAgentTime, isImprobableStart } from "../lib/time-integrity";
import { assessCoverage, formatCoverageAlerts } from "../lib/coverage";
import type { CoverageInput } from "../lib/coverage";
import { VENUES_PER_SHARD, VENUE_SWEEP_SEARCHES } from "../lib/pipeline-config";
import { geocode } from "../lib/geocode";
import { computeEventKey, normalizeTier } from "../lib/event-key";
import { upsertEvents, archivePastEvents, markCancelled, dedupeNearDuplicates, collapseMultiDayRuns } from "../lib/upsert";
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
  let totalCancelled = 0;
  let reclassified = 0; // events whose category the classifier corrected (4.1)
  let venueSwept = 0;   // events found by venue-anchored sweeps (4.2)
  let timeNormalized = 0; // times whose zone noise / date-only form was corrected (4.6)
  let improbableTimes = 0; // starts before 7 AM kept but flagged (4.6)
  const perBand: Record<string, number> = {};

  let runId: number | undefined;
  if (sql) {
    const rows = await sql<{ id: number }[]>`
      insert into pipeline_runs (started_at, ok) values (now(), false) returning id
    `;
    runId = rows[0]?.id;
  }

  for (const win of windows) {
    console.log(`\n[pipeline] === band: ${win.label} (${win.startDate} → ${win.endDate}) ===`);
    let bandTotal = 0;

    for (const category of CATEGORY_KEYS) {
      console.log(`[pipeline] ${win.label}/${category}…`);
      let found: AgentEvent[] = [];
      try {
        found = await researchCategory(category, win.startDate, win.endDate, win.maxSearchUses);
      } catch (err) {
        console.error(`[pipeline] ${win.label}/${category} agent failed:`, err);
        // Don't `continue` — a venue sweep below may still succeed for this category.
      }

      // ROADMAP 4.2 — venue-anchored sweeps. A single generic agent with a small
      // search budget cannot cover a fragmented category like music (every club
      // has its own calendar and nothing aggregates them), which is why the Live
      // Music collection had no First Ave / Palace / Turf Club shows at all. For
      // these categories we ALSO walk the venue registry in small shards, so
      // coverage follows the venue list rather than whatever a generic search
      // happens to surface. Dedup on event_key makes the overlap harmless.
      if (isVenueAnchored(category) && win.label === "near") {
        const shards = shardVenues(venuesFor(category), VENUES_PER_SHARD);
        for (const [i, shard] of shards.entries()) {
          const names = shard.map((v) => v.name).join(", ");
          console.log(`[pipeline] ${win.label}/${category} venue sweep ${i + 1}/${shards.length}: ${names}`);
          try {
            const swept = await researchVenueShard(
              category,
              shard,
              win.startDate,
              win.endDate,
              VENUE_SWEEP_SEARCHES,
            );
            console.log(`[pipeline]   swept ${swept.length} event(s)`);
            found = found.concat(swept);
            venueSwept += swept.length;
          } catch (err) {
            console.error(`[pipeline] ${win.label}/${category} venue sweep ${i + 1} failed:`, err);
          }
        }
      }

      if (found.length === 0) continue;

      const { active, cancelledKeys } = partitionCancellations(found);

      const normalized: DbEventInput[] = [];
      for (const ev of active) {
        // ROADMAP 4.6 — an agent's time is Twin Cities wall-clock, whatever zone
        // suffix it attached. Previously the raw string went straight into a
        // timestamptz column in a UTC session, shifting every event 5–6 hours
        // (the "5 AM Aquatennial" / "fair starts 7 PM the day before" bugs).
        const startT = normalizeAgentTime(ev.start);
        if (!startT) {
          console.warn(`[pipeline] unparseable start "${ev.start}", skipping: ${ev.title}`);
          continue;
        }
        const endT = ev.end ? normalizeAgentTime(ev.end) : null;
        if (startT.changed || endT?.changed) timeNormalized++;
        if (isImprobableStart(startT.wallClock, startT.allDay)) {
          improbableTimes++;
          console.warn(
            `[pipeline] ⏰ improbable start ${startT.wallClock.slice(11)} — "${ev.title}" (kept; check the source)`,
          );
        }

        const geo = await geocode(ev.address, ev.city);
        if (!geo) {
          console.warn(`[pipeline] no geocode, skipping: ${ev.title} @ ${ev.venue}`);
          continue;
        }

        // ROADMAP 4.1 — category comes from the EVENT, not from whichever agent
        // found it. (Previously we stamped `category` here, so a concert found by
        // the food agent became a food event; that's why Live Music was empty.)
        const { category: classified, changed } = classifyEvent({
          title: ev.title,
          venue: ev.venue,
          description: ev.description,
          category: ev.category ?? category,
        });
        if (changed) {
          reclassified++;
          console.log(`[pipeline]   ↻ "${ev.title}" ${category} → ${classified}`);
        }

        normalized.push({
          event_key: computeEventKey(ev.title, ev.venue, startT.wallClock),
          title: ev.title,
          category: classified,
          venue: ev.venue,
          address: ev.address,
          city: ev.city,
          lat: geo.lat,
          lng: geo.lng,
          start_at: startT.iso,
          all_day: startT.allDay,
          end_at: endT?.iso ?? null,
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
      totalCancelled += cancelled;
      if (cancelled > 0) console.log(`[pipeline] ${win.label}/${category}: cancelled ${cancelled}`);
      console.log(`[pipeline] ${win.label}/${category}: upserted ${n}`);
    }

    perBand[win.label] = bandTotal;
    totalUpserted += bandTotal;
  }

  const collapsed = await dedupeNearDuplicates();
  if (collapsed > 0) console.log(`[pipeline] collapsed ${collapsed} near-duplicate(s)`);

  // ROADMAP 4.4 — fold consecutive-day runs into one spanning event, and merge
  // same-day duplicates the geo rule misses (the agents guess different venues
  // for the same festival). Weekly series are NOT touched — only consecutive days
  // form a run, so a recurring date night stays as separate real events.
  const runs = await collapseMultiDayRuns();
  if (runs.collapsed > 0 || runs.merged > 0) {
    console.log(
      `[pipeline] multi-day: collapsed ${runs.collapsed} run(s), merged ${runs.merged} duplicate(s)`,
    );
  }

  const archived = await archivePastEvents();
  console.log(
    `\n[pipeline] done — upserted ${totalUpserted}, archived ${archived}, reclassified ${reclassified}, venue-swept ${venueSwept}, times normalized ${timeNormalized}, improbable ${improbableTimes}`,
    perBand,
  );

  // ROADMAP 4.3 — coverage check. The pipeline finishing "successfully" says
  // nothing about whether its OUTPUT is any good: the Live Music collection sat
  // empty for weeks through green runs. Grade the calendar every time and print
  // the gaps, so a thin category is visible in the run log (and CI) instead of
  // waiting for someone to notice the site looks wrong.
  let coverageAlerts = 0;
  if (sql) {
    const upcoming = await sql<CoverageInput[]>`
      select category,
             to_char(start_at at time zone 'America/Chicago', 'YYYY-MM-DD"T"HH24:MI') as start
      from events
      where status = 'published' and start_at >= now()
        and start_at <= now() + interval '28 days'
    `;
    const report = assessCoverage(upcoming, new Date(), 4);
    coverageAlerts = report.alerts.length;
    console.log("");
    for (const line of formatCoverageAlerts(report)) console.log(line);
    if (!report.healthy) {
      console.warn(
        `\n[coverage] ${coverageAlerts} category-week(s) below floor — see /admin/coverage`,
      );
    }
  }

  if (sql && runId != null) {
    await sql`
      update pipeline_runs set
        finished_at = now(), ok = true,
        upserted = ${totalUpserted}, cancelled = ${totalCancelled},
        archived = ${archived}, collapsed = ${collapsed},
        bands = ${sql.json(perBand)}
      where id = ${runId}
    `;
  }

  await sql?.end({ timeout: 5 });
}

main().catch((err) => {
  console.error("[pipeline] fatal:", err);
  process.exitCode = 1;
});
