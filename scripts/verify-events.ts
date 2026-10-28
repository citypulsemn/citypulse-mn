/**
 * Re-verify near-term events against their sources (roadmap 4.5).
 *
 *   npm run verify -- --dry-run    check and report, change nothing
 *   npm run verify                 apply (cancellations with evidence; flags logged)
 *
 * Policy (enforced in lib/verify.ts, unit-tested):
 *   - cancel ONLY on explicit evidence; a missing page never cancels an event
 *   - time changes are flagged for the admin, never auto-applied
 *
 * ── THE SUPERVISED PATH (Oct 2026) ─────────────────────────────────────────
 * This pass is the project's biggest single API line — $8.55 a run, twice a
 * week, ~$74/month measured. The research is also exactly what a supervised
 * session does well, so the expensive half can be done there instead, and the
 * two free halves stay here where every gate lives:
 *
 *   npm run verify -- --emit-queue=verify-queue.json     (free: one SELECT)
 *   ... session researches, writes verdicts.json ...
 *   npm run verify -- --from=verdicts.json               (free: Postgres only)
 *
 * Neither free path needs ANTHROPIC_API_KEY, and both route through the same
 * `routeVerdicts` the paid loop uses — so a hand-made file cannot skip the
 * evidence rule, the unknown-venue gate or the weak-source flag.
 *
 * The automatic Monday run then stands down if one already landed:
 *
 *   npm run verify -- --skip-if-verified-recently=72
 *
 * See docs/MANUAL-VERIFY.md. The Thursday pre-send pass in weekly-digest.yml
 * deliberately carries NO gate — an email cannot be recalled.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { sql } from "../lib/db";
import { revalidateAndReport } from "../lib/revalidate-client";
import {
  selectForVerification,
  batchForVerification,
  routeVerdicts,
  unprovenAlarm,
  parseVerdictFile,
  withinBudget,
  DEFAULT_CAP,
  RUN_BUDGET_MS,
  VERDICTS,
  VERIFY_HORIZON_DAYS,
  type RoutableEvent,
} from "../lib/verify";
import { verifyEventsBatch } from "../lib/agents/research-agent";
import {
  markVerified,
  cancelVerified,
  flagVerification,
  recordVerifyPass,
  recentVerifyPass,
} from "../lib/upsert";
import type { EventStatus } from "../lib/types";
import { recordRunSpend } from "../lib/model-spend";

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);

/** Print the year gate's alarm and fail the run when it is the loud one. */
function reportUnproven(alarm: ReturnType<typeof unprovenAlarm>): void {
  if (!alarm) return;
  if (alarm.level === "error") {
    console.error(alarm.message);
    process.exitCode = 1;
    return;
  }
  console.warn(alarm.message);
}

const VALUE_FLAGS = ["from", "emit-queue", "skip-if-verified-recently"] as const;

/**
 * EVERY WAY A FLAG CAN FAIL TO ARRIVE, each of which otherwise falls through to
 * the $8.55 paid pass. This is the only guard between a typo and a real bill.
 *
 * (a) npm swallowed it. `npm run verify --from=x.json` — no bare `--` — reaches
 *     this script with NO ARGUMENTS, so an intended free apply becomes a full
 *     paid pass. npm leaves the flag in the environment, which is how we tell.
 *
 *     `--dry-run` IS on this list. An earlier version left it off, reasoning
 *     that npm's own `--dry-run` default would false-positive on every run.
 *     MEASURED on npm 11.16.0: a plain `npm run` exports no `npm_config_dry_run`
 *     at all, and a swallowed one exports `"true"` — so there is no false
 *     positive, and omitting it left the likeliest typo of the lot unguarded.
 *     It is the flag documented at the top of this file, and swallowing it turns
 *     a rehearsal into a live, billed, writing pass.
 *
 * (b) written with a space, or with no value — `--from verdicts.json`, `--from=`.
 *     `arg()` matches only `--name=value`, so both leave the variable falsy and
 *     the script walks past the free paths into the paid one.
 */
function flagProblem(): string | null {
  for (const [flag, envKey] of [
    ["--from", "npm_config_from"],
    ["--emit-queue", "npm_config_emit_queue"],
    ["--skip-if-verified-recently", "npm_config_skip_if_verified_recently"],
    ["--dry-run", "npm_config_dry_run"],
  ] as const) {
    if (process.env[envKey] && !process.argv.some((a) => a.startsWith(flag))) {
      return `npm swallowed ${flag}. Use the bare -- separator: npm run verify -- ${flag}${flag === "--dry-run" ? "" : "=..."}`;
    }
  }
  for (const n of VALUE_FLAGS) {
    if (process.argv.includes(`--${n}`)) {
      return `--${n} was written without a value. It needs an equals sign: --${n}=...`;
    }
    const hit = process.argv.find((a) => a.startsWith(`--${n}=`));
    if (hit !== undefined && hit.slice(n.length + 3).trim() === "") {
      return `--${n}= was given no value.`;
    }
  }
  return null;
}

async function main() {
  const problem = flagProblem();
  if (problem) {
    console.error(
      `[verify] ✗ ${problem}\n` +
        `         Refusing to run, because otherwise this would have been a full paid pass.`,
    );
    process.exit(2);
  }

  const dryRun = process.argv.includes("--dry-run");
  const capArg = process.argv.find((a) => a.startsWith("--cap="));
  const cap = capArg ? Math.max(1, Number(capArg.slice(6)) || DEFAULT_CAP) : DEFAULT_CAP;
  // How far ahead to look. The horizon used to be hardcoded at 7 days in TWO
  // places — here and in selectForVerification — so 88% of unverified events
  // were invisible to this pass until the week they happened. Both now follow
  // this one value.
  const daysArg = process.argv.find((a) => a.startsWith("--days="));
  const days = daysArg ? Math.max(1, Number(daysArg.slice(7)) || VERIFY_HORIZON_DAYS) : VERIFY_HORIZON_DAYS;
  // The default budget is sized for the weekly Actions job (30-minute timeout).
  // A one-off backfill runs locally with no such ceiling, and clearing a
  // backlog in one pass beats babysitting five sequential runs. Progress is
  // flushed per batch either way, so a longer run risks nothing extra.
  // Target one source. Chasing a suspect index page is a recurring job — this
  // is the third time — and without it the only way to reach those rows is to
  // raise the cap until the risk ordering happens to include them.
  const sourceArg = process.argv.find((a) => a.startsWith("--source="));
  const source = sourceArg ? sourceArg.slice(9) : null;
  const budgetArg = process.argv.find((a) => a.startsWith("--budget-mins="));
  const budgetMs = budgetArg ? Math.max(1, Number(budgetArg.slice(14)) || 20) * 60_000 : RUN_BUDGET_MS;

  const emitQueue = arg("emit-queue") ?? null;
  const fromFile = arg("from") ?? null;
  const skipHoursArg = arg("skip-if-verified-recently");
  const skipHours = skipHoursArg === undefined ? null : Math.max(1, Number(skipHoursArg) || 72);

  if (emitQueue && fromFile) {
    console.error("[verify] ✗ --emit-queue and --from do different jobs; pass one at a time.");
    process.exit(2);
  }
  if (!sql) throw new Error("DATABASE_URL is required");

  // ── the gate ─────────────────────────────────────────────────────────────
  // Before the API key check, so a standing-down run never needs the key.
  // Only the Monday pass passes this flag; the pre-send pass never does.
  if (skipHours !== null && !emitQueue && !fromFile) {
    const recent = await recentVerifyPass(skipHours);
    if (recent.ran) {
      console.log(
        `[verify] a pass already completed ${recent.at} (${recent.how ?? "unknown"}) — ` +
          `inside the ${skipHours}h window, standing down and spending nothing.`,
      );
      return void (await sql.end({ timeout: 5 }));
    }
    console.log(`[verify] no pass recorded in the last ${skipHours}h — proceeding.`);
  }

  const rows = await sql<
    { id: string; title: string; venue: string; city: string; start: string; sourceUrl: string; ticketUrl: string; status: EventStatus; verifiedAt: string | null }[]
  >`
    select id::text as id, title, venue, city,
           to_char(start_at at time zone 'America/Chicago', 'YYYY-MM-DD"T"HH24:MI') as start,
           source_url as "sourceUrl", ticket_url as "ticketUrl", status,
           verified_at::text as "verifiedAt"
    from events
    where status = 'published' and start_at >= now()
      and start_at <= now() + (${days} * interval '1 day')
      and (${source}::text is null or source_url like '%' || ${source} || '%')
  `;

  const candidates = selectForVerification(rows, new Date(), { cap, days });
  const freshLooks = candidates.filter((c) => !rows.find((r) => r.id === c.id)?.verifiedAt).length;
  const unverifiedInWindow = rows.filter(
    (r) => !r.verifiedAt && (r.sourceUrl || r.ticketUrl).trim().length > 0,
  ).length;

  // ── stage 1, free: hand the queue to a supervised session ────────────────
  if (emitQueue) {
    const payload = {
      generatedAt: new Date().toISOString(),
      horizonDays: days,
      cap,
      // Carried in the file so the session need not remember them, and so a
      // verdict outside this set is a file error rather than a guess.
      allowedVerdicts: VERDICTS,
      events: candidates,
    };
    writeFileSync(emitQueue, JSON.stringify(payload, null, 2));
    console.log(
      `[verify] wrote ${candidates.length} event(s) to ${emitQueue} ` +
        `(${freshLooks} never verified, window ${rows.length} over ${days}d). No model call, nothing written to the database.`,
    );
    if (unverifiedInWindow > freshLooks) {
      console.warn(
        `[verify] ⚠ ${unverifiedInWindow - freshLooks} never-verified event(s) in this window are past the cap of ${cap}`,
      );
    }
    return void (await sql.end({ timeout: 5 }));
  }

  // ── stage 2, free: apply verdicts researched elsewhere ───────────────────
  if (fromFile) {
    // Validated against the whole WINDOW, not against `candidates`. The cap is
    // a budget for model calls, not a filter on answers already in hand — a
    // verdict for a still-published event that happens to fall outside today's
    // top 200 is perfectly good and must not be thrown away.
    const validIds = new Set(rows.map((r) => r.id));
    let text: string;
    try {
      text = readFileSync(fromFile, "utf8");
    } catch (err) {
      console.error(`[verify] ✗ cannot read ${fromFile}:`, err);
      process.exitCode = 1;
      return void (await sql.end({ timeout: 5 }));
    }

    const { verdicts, rejected } = parseVerdictFile(text, validIds);
    // Rule 6. A file that half-applied while printing a success line is the
    // failure this whole path has to avoid, so every rejection is named.
    for (const r of rejected) console.warn(`[verify] ⚠ dropped ${r.entry} — ${r.why}`);
    console.log(
      `[verify] ${fromFile}: ${verdicts.length} usable verdict(s), ${rejected.length} dropped` +
        ` · window ${rows.length} over ${days}d${dryRun ? " (DRY RUN)" : ""}`,
    );
    if (verdicts.length === 0) {
      console.error("[verify] ✗ nothing usable in that file — nothing applied.");
      process.exitCode = 1;
      return void (await sql.end({ timeout: 5 }));
    }

    const routed = routeVerdicts(verdicts, rows as RoutableEvent[]);
    for (const line of routed.lines) console.log(line);

    // DISTINCT EVENTS, not the sum of the three buckets. A weak-source row gets
    // BOTH a stamp and a flag, so adding the buckets double-counts it — the
    // first real run reported 163 for 153 events. `checked` is the field a
    // coverage floor would be read off, so it has to be a count of rows.
    const touched = new Set([
      ...routed.confirms,
      ...routed.cancels.map((c) => c.id),
      ...routed.flags.map((f) => f.id),
    ]);
    let cancelled = 0;
    if (!dryRun) {
      await markVerified(routed.confirms);
      cancelled = await cancelVerified(routed.cancels);
      for (const f of routed.flags) await flagVerification(f.id, f.verdict, f.note);
      if (touched.size > 0) {
        await recordVerifyPass("file", {
          checked: touched.size,
          confirmed: routed.confirms.length,
          cancelled,
          flagged: routed.flags.length,
          // What the file offered — NOT candidates.length, which on this path is
          // whatever today's selector happens to pick and has nothing to do with
          // what was researched, possibly days ago under a different --cap.
          ofFile: verdicts.length,
          dropped: rejected.length,
        });
      }
    }
    console.log(
      `\n[verify] confirmed ${routed.confirms.length}, cancelled ${routed.cancels.length}, ` +
        `flagged ${routed.flags.length}${dryRun ? " — dry run, nothing written." : " — applied and recorded."}`,
    );
    reportUnproven(unprovenAlarm(routed.confirms.length, routed.flags));

    if (!dryRun && (routed.cancels.length > 0 || routed.confirms.length > 0)) {
      await revalidateAndReport(
        "verify",
        `verify pass (from file) — ${routed.cancels.length} cancelled, ${routed.confirms.length} confirmed`,
        routed.cancels.map((c) => c.id),
      );
    }
    return void (await sql.end({ timeout: 5 }));
  }

  // ── the paid pass ────────────────────────────────────────────────────────
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is required");

  console.log(
    `[verify] window ${rows.length} over ${days}d${source ? ` from "${source}"` : ""} · checking ${candidates.length} (cap ${cap})${dryRun ? " (DRY RUN)" : ""}`,
  );
  console.log(
    `[verify] ${freshLooks} never verified before, ${candidates.length - freshLooks} re-checks`,
  );
  // Rule 6, honest emptiness: a run that cannot reach everything says so out
  // loud. Silent truncation reads as "we checked the week" when we did not.
  if (unverifiedInWindow > freshLooks) {
    console.warn(
      `[verify] ⚠ ${unverifiedInWindow - freshLooks} never-verified event(s) in this window are past the cap`,
    );
  }
  if (candidates.length === 0) return void (await sql.end({ timeout: 5 }));

  const cancels: { id: string; evidence: string }[] = [];
  const confirms: string[] = [];
  const flags: { id: string; verdict: string; note: string }[] = [];

  const batches = batchForVerification(candidates, 8);
  const startedAt = Date.now();
  let done = 0;
  let cancelled = 0;
  // Events inside batches that actually came back — NOT candidates.length, which
  // is what the run set out to do. The budget truncates most full windows, and a
  // marker claiming 200 after checking 80 is the `collapsed_runs` bug again:
  // a counter that reported intent read clean through five broken weeks.
  let checkedEvents = 0;

  for (const [i, batch] of batches.entries()) {
    // Checked before the call, never during: a batch in flight has been paid
    // for and always finishes.
    if (!withinBudget(startedAt, Date.now(), budgetMs)) {
      console.warn(
        `[verify] ⚠ time budget reached after ${done}/${batches.length} batches — stopping cleanly`,
      );
      break;
    }
    console.log(`[verify] batch ${i + 1}/${batches.length}: ${batch.map((e) => e.title).join(" · ")}`);
    let verdicts;
    try {
      verdicts = await verifyEventsBatch(batch);
    } catch (err) {
      console.error(`[verify] batch ${i + 1} failed:`, err);
      continue;
    }

    const routed = routeVerdicts(verdicts, batch);
    for (const line of routed.lines) console.log(line);

    // Flush per batch. The run is now long enough that a timeout or a crash at
    // batch 19 of 21 would otherwise discard nineteen batches of paid-for
    // verification — including a cancellation we had evidence for.
    if (!dryRun) {
      await markVerified(routed.confirms);
      cancelled += await cancelVerified(routed.cancels);
      for (const f of routed.flags) await flagVerification(f.id, f.verdict, f.note);
    }

    confirms.push(...routed.confirms);
    cancels.push(...routed.cancels);
    flags.push(...routed.flags);
    done++;
    checkedEvents += batch.length;
  }

  const mins = Math.round((Date.now() - startedAt) / 60000);
  console.log(
    `\n[verify] confirmed ${confirms.length}, cancelled ${cancels.length}, flagged ${flags.length}` +
      ` — ${done}/${batches.length} batches in ${mins}m`,
  );

  if (dryRun) {
    console.log("[verify] dry run — nothing written.");
  } else if (cancelled > 0) {
    console.log(`[verify] ${cancelled} event(s) marked cancelled (with evidence, audited)`);
  }

  // Mark the pass only if verdicts were actually ADJUDICATED — not merely if
  // batches returned. `parseVerdicts` swallows an unparseable reply and returns
  // [] (lib/verify.ts), and verifyEventsBatch passes that straight through, so
  // every batch can "succeed" while deciding nothing: the one way this pass
  // fails silently. Guarding on `done` would have written a full-coverage
  // marker for that run and stood the next scheduled pass down on it.
  const adjudicated = confirms.length + cancels.length + flags.length;
  if (done > 0 && adjudicated === 0) {
    console.error(
      `[verify] ⚠ ${done} batch(es) returned but produced NO verdicts at all — ` +
        `the model's replies are not parsing. Spent money, verified nothing, ` +
        `recording no pass so the next run still goes ahead.`,
    );
    process.exitCode = 1;
  }

  // The year gate's own alarm. Shared with the --from path below, because an
  // alarm wired into one summary is an alarm that does not exist half the time.
  reportUnproven(unprovenAlarm(confirms.length, flags));

  if (!dryRun && adjudicated > 0) {
    await recordVerifyPass(process.env.CI ? "ci" : "local", {
      checked: checkedEvents,
      confirmed: confirms.length,
      cancelled,
      flagged: flags.length,
      // So a truncated run is visibly truncated in the ledger rather than
      // looking like a clean sweep of a small queue.
      ofCandidates: candidates.length,
      batches: `${done}/${batches.length}`,
    });
  }

  // A cancellation is the one thing here that must reach readers immediately —
  // it is the whole reason this pass exists. Pass the cancelled ids so their
  // event pages are busted by name on top of the shared tag.
  if (!dryRun && (cancels.length > 0 || confirms.length > 0)) {
    await revalidateAndReport(
      "verify",
      `verify pass — ${cancels.length} cancelled, ${confirms.length} confirmed`,
      cancels.map((c) => c.id),
    );
  }

  await sql.end({ timeout: 5 });
}

main()
  .catch((err) => {
    console.error("[verify] fatal:", err);
    process.exitCode = 1;
  })
  // Recorded whether the run finished or died: the calls were already paid for.
  // A free path (--emit-queue / --from / a standing-down gate) makes no call,
  // and recordRunSpend writes no row for a zero-call run.
  .finally(() => recordRunSpend("verify"));
