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
 *
 * ── THE FREE PATH (Nov 2026) ───────────────────────────────────────────────
 * The research can be done in a scheduled session instead of bought:
 *
 *   npm run pipeline -- --emit-queue=<dir>/queue.json     (one write, no model)
 *   ... session answers each task in <dir>/<id>.md ...
 *   npm run pipeline -- --from=<dir> --dry-run            (reads only)
 *   npm run pipeline -- --from=<dir>                      (applies)
 *
 * The scheduled paid run then stands down if a full pass already landed:
 *
 *   npm run pipeline -- --skip-if-researched-recently=24
 *
 * See docs/PIPELINE.md and lib/research-queue.ts.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { flagProblem } from "../lib/cli-flags";
import {
  buildResearchQueue,
  replyIsReadable,
  researchStandDownFor,
  type ResearchTask,
} from "../lib/research-queue";
import { recentResearchPasses } from "../lib/upsert";
import { CATEGORY_KEYS } from "../lib/categories";
import { runUsageTotals } from "../lib/api-usage";
import { researchCategory, researchVenueShard, parseAgentEvents } from "../lib/agents/research-agent";
import type { AgentEvent } from "../lib/agents/research-agent";
import { classifyEvent } from "../lib/classify";
import { venuesFor, shardVenues, isVenueAnchored } from "../lib/venues";
import { normalizeAgentTime, isImprobableStart } from "../lib/time-integrity";
import { isPlaceholderTitle } from "../lib/contradictions";
import { assessCoverage, formatCoverageAlerts } from "../lib/coverage";
import type { CoverageInput } from "../lib/coverage";
import { VENUES_PER_SHARD, VENUE_SWEEP_SEARCHES } from "../lib/pipeline-config";
import { roomPin, knownRoomAddress } from "../lib/room-pin";
import { geocode } from "../lib/geocode";
import { roomKey } from "../lib/contradictions";
import { computeEventKey, normalizeTier } from "../lib/event-key";
import { upsertEvents, archivePastEvents, markCancelled, dedupeNearDuplicates, collapseMultiDayRuns } from "../lib/upsert";
import { pruneRateEvents } from "../lib/rate-limit";
import { deltaTag, stampedeReason, PIPELINE_STAMPEDE } from "../lib/ops-digest";
import { partitionCancellations } from "../lib/cancellations";
import { dueWindows } from "../lib/horizon";
import { NEW_EVENT_STATUS } from "../lib/pipeline-config";
import { statusForNewEvent, heldBackReason } from "../lib/source-trust";
import { venueIsUnknown, unknownVenueReason } from "../lib/venue-quality";
import { sql } from "../lib/db";
import { revalidateAndReport } from "../lib/revalidate-client";
import type { DbEventInput } from "../lib/types";
import { recordRunSpend } from "../lib/model-spend";

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);

/** What `--emit-queue` writes and `--from` reads back. */
interface QueueFile {
  generatedAt: string;
  windows: ReturnType<typeof dueWindows>;
  tasks: ResearchTask[];
}

/**
 * Read a session's answers, naming every task that has none. The windows come from
 * the queue, not from today, so a pass that crosses midnight still applies what it
 * researched.
 */
function readAnswers(dir: string): {
  queue: QueueFile;
  byBand: Map<string, AgentEvent[]>;
  done: number;
} {
  const queue = JSON.parse(readFileSync(join(dir, "queue.json"), "utf8")) as QueueFile;
  const byBand = new Map<string, AgentEvent[]>();
  let done = 0;
  for (const t of queue.tasks) {
    const file = join(dir, `${t.id}.md`);
    if (!existsSync(file)) {
      console.warn(`[pipeline] ⚠ ${t.id}: no answer, skipped`);
      continue;
    }
    const text = readFileSync(file, "utf8");
    if (!replyIsReadable(text)) {
      console.warn(`[pipeline] ⚠ ${t.id}: answer is not a JSON list, skipped`);
      continue;
    }
    done++;
    const key = `${t.band}/${t.category}`;
    byBand.set(key, [...(byBand.get(key) ?? []), ...parseAgentEvents(text, t.category)]);
  }
  return { queue, byBand, done };
}

async function main() {
  const problem = flagProblem(
    process.argv,
    process.env,
    "pipeline",
    ["from", "emit-queue", "skip-if-researched-recently"],
    ["dry-run"],
  );
  if (problem) {
    console.error(`[pipeline] ✗ ${problem}\n           Refusing to run, because otherwise this would have been a full paid run.`);
    process.exit(2);
  }
  const emitQueue = arg("emit-queue") ?? null;
  const fromDir = arg("from") ?? null;
  const dryRun = process.argv.includes("--dry-run");
  const skipHoursArg = arg("skip-if-researched-recently");
  if (emitQueue && fromDir) {
    console.error("[pipeline] ✗ --emit-queue and --from do different jobs; pass one at a time.");
    process.exit(2);
  }
  if (dryRun && !fromDir) {
    console.error("[pipeline] ✗ --dry-run only works with --from. The paid run has no dry run, so this would have spent money.");
    process.exit(2);
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

  // ── the gate ─────────────────────────────────────────────────────────────
  // Before the API key check, so a standing-down run never needs the key. It exits
  // without a pipeline_runs row: the local pass wrote one, and a second row of
  // zeros would poison the ops digest's baseline.
  if (skipHoursArg !== undefined && !emitQueue && !fromDir) {
    const hours = Math.max(1, Number(skipHoursArg) || 24);
    const { pass, tooSmall } = researchStandDownFor(await recentResearchPasses(hours));
    for (const p of tooSmall) {
      console.warn(
        `[pipeline] ignoring the pass at ${p.at} — ${p.tasks_done}/${p.tasks_total} tasks, ${p.upserted} listing(s), under the floor.`,
      );
    }
    if (pass) {
      console.log(
        `[pipeline] a full pass completed ${pass.at} (${pass.tasks_done}/${pass.tasks_total} tasks, ` +
          `${pass.upserted} listings) — inside the ${hours}h window, standing down and spending nothing.`,
      );
      return void (await sql?.end({ timeout: 5 }));
    }
    console.log(`[pipeline] no full pass recorded in the last ${hours}h — proceeding.`);
  }

  // ── stage 1, free: hand the queue to a session ───────────────────────────
  if (emitQueue) {
    const due = dueWindows(new Date());
    const tasks = buildResearchQueue(due);
    const payload: QueueFile = { generatedAt: new Date().toISOString(), windows: due, tasks };
    writeFileSync(emitQueue, JSON.stringify(payload, null, 2));
    console.log(
      `[pipeline] wrote ${tasks.length} task(s) to ${emitQueue}: ${due.map((w) => w.label).join(", ")}. ` +
        "No model call, nothing written to the database.",
    );
    return void (await sql?.end({ timeout: 5 }));
  }

  // A new room needs a geocoder, and a run without a working one drops its listings.
  // Refusing costs one paid fallback; dropping them would look like a quiet week. A
  // real lookup, because a mistyped or revoked token is present and still fails.
  if (fromDir && !dryRun && !(await geocode("First Avenue", "Minneapolis"))) {
    console.error("[pipeline] ✗ the Mapbox token is missing or not working, so listings in new rooms would be dropped. Refusing to apply.");
    process.exit(1);
  }
  if (!fromDir && !process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is required");

  const answers = fromDir ? readAnswers(fromDir) : null;
  if (answers) {
    console.log(`[pipeline] ${fromDir}: ${answers.done}/${answers.queue.tasks.length} task(s) answered${dryRun ? " (DRY RUN)" : ""}`);
    if (answers.done === 0) {
      console.error("[pipeline] ✗ nothing usable in that folder — nothing applied.");
      process.exitCode = 1;
      return void (await sql?.end({ timeout: 5 }));
    }
  }
  let wouldGeocode = 0; // dry run: rooms with no stored pin
  let noGeocode = 0; // listings dropped because nothing could place them

  const windows = answers ? answers.queue.windows : dueWindows(new Date());
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
  let unnamedDropped = 0; // agent listings whose title named no event (Aug 2026)
  let archived = 0; // function-scoped: the revalidate call after the try/catch reports it
  const perBand: Record<string, number> = {};

  let runId: number | undefined;
  if (sql && !dryRun) {
    const rows = await sql<{ id: number }[]>`
      insert into pipeline_runs (started_at, ok) values (now(), false) returning id
    `;
    runId = rows[0]?.id;
  }

  // Everything below runs inside a try so a failure FINALIZES the run row with
  // the error message. Previously a crash left the initial `ok=false` row with
  // error NULL — indistinguishable from a hard kill. (A kill, e.g. the GitHub
  // Actions timeout, still can't write; its signature is finished_at IS NULL.)
  try {
  for (const win of windows) {
    console.log(`\n[pipeline] === band: ${win.label} (${win.startDate} → ${win.endDate}) ===`);
    let bandTotal = 0;

    for (const category of CATEGORY_KEYS) {
      console.log(`[pipeline] ${win.label}/${category}…`);
      let found: AgentEvent[] = answers?.byBand.get(`${win.label}/${category}`) ?? [];
      if (!answers) try {
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
      if (!answers && isVenueAnchored(category) && win.label === "near") {
        const shards = shardVenues(venuesFor(category), VENUES_PER_SHARD);
        console.log(
          `[pipeline] ${win.label}/${category}: ${shards.length} venue sweeps in parallel`,
        );
        // Shards run in PARALLEL: serially they added ~30+ minutes of wall
        // clock, which pushed the Jul 14 run past the workflow's timeout and
        // GitHub killed it mid-flight (ok=false, error null, nothing upserted).
        // allSettled keeps one shard's failure from sinking the others.
        const results = await Promise.allSettled(
          shards.map((shard) =>
            researchVenueShard(category, shard, win.startDate, win.endDate, VENUE_SWEEP_SEARCHES),
          ),
        );
        results.forEach((res, i) => {
          const names = shards[i].map((v) => v.name).join(", ");
          if (res.status === "fulfilled") {
            console.log(
              `[pipeline]   sweep ${i + 1}/${shards.length} (${names}): ${res.value.length} event(s)`,
            );
            found = found.concat(res.value);
            venueSwept += res.value.length;
          } else {
            console.error(
              `[pipeline]   sweep ${i + 1}/${shards.length} (${names}) failed:`,
              res.reason,
            );
          }
        });
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

        // A LISTING WE CANNOT NAME IS NOT A LISTING (Aug 2026).
        //
        // When an agent can tell a venue has SOMETHING on but not what, it has
        // been writing the venue and the date into the title and calling that an
        // event: "Turf Club Show (Sep 3)", "Show (Aug 26)", "Fitzgerald Theater
        // Concert Event". Twenty-one of those were live on the site, and they
        // survive every other check because their date, venue and time are all
        // perfectly valid — there is nothing wrong with them except that they
        // tell a reader nothing.
        //
        // Rule 6: an honest blank beats invented filler. Dropped here rather
        // than stored and hidden later, because the row was never a fact.
        // Counted and logged so a spike is visible instead of silent.
        if (isPlaceholderTitle(ev.title, ev.venue)) {
          unnamedDropped++;
          console.warn(`[pipeline] ✂ names no event, dropping: "${ev.title}" @ ${ev.venue}`);
          continue;
        }

        // One pin per ROOM, not per address spelling — see lib/room-pin.ts.
        const address = ev.address.trim() || (await knownRoomAddress(ev.venue));

        // A dry run reads stored pins only: roomPin writes the first answer it gets.
        let geo: { lat: number; lng: number } | null;
        if (dryRun) {
          const [stored] = await sql!<{ lat: number; lng: number }[]>`
            select lat::float as lat, lng::float as lng from venue_coords where room_key = ${roomKey(ev.venue)}
          `;
          if (!stored) wouldGeocode++;
          geo = stored ?? { lat: 0, lng: 0 };
        } else {
          geo = await roomPin(ev.venue, address, ev.city);
        }
        if (!geo) {
          noGeocode++;
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
          address,
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
          // Auto-published UNLESS the only source is a third-party roundup —
          // those land as draft until the verify pass confirms them against the
          // venue itself. Two fabrications came in through roundups (see
          // lib/source-trust.ts). Revert to draft in the DB any time to hide.
          // Two gates, both of which only ever HOLD BACK. A roundup source is
          // one; a venue that admits it does not know where the event is is the
          // other — those ship a map pin and a Directions button pointing at a
          // coordinate the listing itself calls unknown.
          status:
            NEW_EVENT_STATUS === "published"
              ? venueIsUnknown(ev.venue, ev.city)
                ? "draft"
                : statusForNewEvent(ev.source_url)
              : NEW_EVENT_STATUS,
        });
      }

      const held = normalized.filter((r) => r.status === "draft");
      if (held.length > 0) {
        console.log(
          `[pipeline] ${win.label}/${category}: ${held.length} held as draft — ` +
            `${heldBackReason(held[0].source_url) ?? "unverified source"}`,
        );
        for (const h of held)
          console.log(
            `[pipeline]   held: ${h.title}` +
              `${unknownVenueReason(h.venue, h.city) ? ` — ${unknownVenueReason(h.venue, h.city)}` : ""}`,
          );
      }
      const n = dryRun ? normalized.length : await upsertEvents(normalized);
      const cancelled = dryRun ? cancelledKeys.length : await markCancelled(cancelledKeys);
      bandTotal += n;
      totalCancelled += cancelled;
      if (cancelled > 0) console.log(`[pipeline] ${win.label}/${category}: cancelled ${cancelled}`);
      console.log(`[pipeline] ${win.label}/${category}: upserted ${n}`);
    }

    perBand[win.label] = bandTotal;
    totalUpserted += bandTotal;
  }

  if (dryRun) {
    console.log(
      `\n[pipeline] DRY RUN, nothing written: ${totalUpserted} listing(s) before dedupe, ${totalCancelled} cancellation(s), ` +
        `${wouldGeocode} in a room with no stored pin, ${unnamedDropped} unnamed dropped, ${improbableTimes} improbable times`,
      perBand,
    );
    return void (await sql?.end({ timeout: 5 }));
  }

  const collapsed = await dedupeNearDuplicates();
  if (collapsed > 0) console.log(`[pipeline] collapsed ${collapsed} near-duplicate(s)`);

  // ROADMAP 4.4 — fold consecutive-day runs into one spanning event, and merge
  // same-day duplicates the geo rule misses (the agents guess different venues
  // for the same festival). Weekly series are NOT touched — only consecutive days
  // form a run, so a recurring date night stays as separate real events.
  const runs = await collapseMultiDayRuns();
  if (runs.collapsed > 0 || runs.merged > 0 || runs.folded > 0) {
    console.log(
      `[pipeline] multi-day: collapsed ${runs.collapsed} run(s), merged ${runs.merged} duplicate(s), folded ${runs.folded} sub-event group(s)`,
    );
  }
  if (runs.spansCleared > 0) {
    console.log(
      `[pipeline] multi-day: cleared ${runs.spansCleared} span(s) on per-night rows — ` +
        "a stand or a game never spans days, so the span was written under an older rule",
    );
  }

  // R2.1 — rate-limit counters idle 2+ days are dead weight; sweep weekly.
  const pruned = await pruneRateEvents();
  if (pruned > 0) console.log(`[pipeline] pruned ${pruned} stale rate-limit bucket(s)`);

  archived = await archivePastEvents();

  // F2.6 — per-stage counts WITH diffs vs the previous run, plus the stampede
  // tripwire (a flood of archives/dedupes is how R0.2 would have announced
  // itself). The previous run is the newest row that isn't this one.
  // Baseline = the last N SUCCESSFUL runs (a failed run's zeros would fake it);
  // their median is the stampede baseline, and the newest is the diff prev.
  type BaseRow = { upserted: number | null; collapsed: number | null; collapsed_runs: number | null; archived: number | null };
  let recentRuns: BaseRow[] = [];
  if (sql && runId != null) {
    recentRuns = [
      ...(await sql<BaseRow[]>`
        select upserted, collapsed, collapsed_runs, archived
        from pipeline_runs where id <> ${runId} and ok = true
        order by started_at desc limit ${PIPELINE_STAMPEDE.baselineWindow}`),
    ];
  }
  const prevRun = recentRuns[0];
  const dd = (cur: number, prev: number | null | undefined) => deltaTag(cur, prev ?? null);
  console.log(
    `\n[pipeline] done — upserted ${totalUpserted}${dd(totalUpserted, prevRun?.upserted)}, ` +
      `deduped ${collapsed}${dd(collapsed, prevRun?.collapsed)}, ` +
      `collapsed ${runs.collapsed}${dd(runs.collapsed, prevRun?.collapsed_runs)}, ` +
      `archived ${archived}${dd(archived, prevRun?.archived)}, reclassified ${reclassified}, ` +
      `venue-swept ${venueSwept}, times normalized ${timeNormalized}, improbable ${improbableTimes}, ` +
        `unnamed dropped ${unnamedDropped}, no geocode ${noGeocode}`,
    perBand,
  );
  const stampede = stampedeReason(
    archived,
    collapsed,
    recentRuns.map((r) => r.archived ?? 0),
    recentRuns.map((r) => r.collapsed ?? 0),
  );
  if (stampede) console.warn(`[pipeline] ⚠️ stampede check — ${stampede}`);

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
    // What this run actually cost, accumulated by logUsage across every agent
    // call. Written once, here, rather than on the hot path.
    const spend = runUsageTotals();
    console.log(
      `[usage] run total: ${spend.usd.toFixed(2)} over ${spend.calls} calls` +
        ` (${spend.searches} web searches` +
        `${spend.unpriced > 0 ? `, ${spend.unpriced} calls at an unknown rate` : ""})`,
    );
    await sql`
      update pipeline_runs set
        finished_at = now(), ok = true,
        upserted = ${totalUpserted}, cancelled = ${totalCancelled},
        archived = ${archived}, collapsed = ${collapsed},
        collapsed_runs = ${runs.collapsed},
        unnamed_dropped = ${unnamedDropped},
        bands = ${sql.json(perBand)},
        cost_usd = ${spend.usd.toFixed(4)},
        cost_searches = ${spend.searches},
        cost_unpriced_calls = ${spend.unpriced}
      where id = ${runId}
    `;
  }

  // The marker the scheduled run's gate reads, written after the work. Counts what
  // landed, never what was queued. If it cannot be written the paid run goes ahead,
  // which is the safe direction.
  if (fromDir && !dryRun && answers && sql) {
    const patch = { how: "file", upserted: totalUpserted, noGeocode, tasksDone: answers.done, tasksTotal: answers.queue.tasks.length };
    await sql`insert into admin_audit (action, patch) values ('research_pass', ${sql.json(patch)})`.catch((err) =>
      console.warn(`[pipeline] could not record the pass, so the paid run will not stand down: ${String(err)}`),
    );
  }
  } catch (err) {
    if (sql && runId != null) {
      await sql`
        update pipeline_runs set
          finished_at = now(), ok = false,
          upserted = ${totalUpserted},
          error = ${String(err).slice(0, 500)},
          cost_usd = ${runUsageTotals().usd.toFixed(4)},
          cost_searches = ${runUsageTotals().searches},
          cost_unpriced_calls = ${runUsageTotals().unpriced}
        where id = ${runId}
      `.catch(() => {});
    }
    throw err;
  }

  // The pipeline is the biggest writer on the site: new events, archived ones,
  // collapsed runs. Without this the public pages carried yesterday's slate
  // until each ISR window happened to expire.
  await revalidateAndReport(
    "pipeline",
    `weekly pipeline — ${totalUpserted} upserted, ${archived} archived`,
  );

  await sql?.end({ timeout: 5 });
}

main()
  .catch((err) => {
    console.error("[pipeline] fatal:", err);
    process.exitCode = 1;
  })
  // Also written to pipeline_runs above, which is how the pipeline reports on
  // itself. This row is what the dashboard sums across every spending job.
  .finally(() => recordRunSpend("pipeline"));
