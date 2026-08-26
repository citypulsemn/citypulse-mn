/**
 * Re-verify near-term events against their sources (roadmap 4.5).
 *
 *   npm run verify -- --dry-run    check and report, change nothing
 *   npm run verify                 apply (cancellations with evidence; flags logged)
 *
 * Policy (enforced in lib/verify.ts, unit-tested):
 *   - cancel ONLY on explicit evidence; a missing page never cancels an event
 *   - time changes are flagged for the admin, never auto-applied
 */
import { sql } from "../lib/db";
import { revalidateAndReport } from "../lib/revalidate-client";
import {
  selectForVerification,
  batchForVerification,
  actionFor,
  withinBudget,
  DEFAULT_CAP,
} from "../lib/verify";
import { verifyEventsBatch } from "../lib/agents/research-agent";
import { markVerified, cancelVerified, flagVerification } from "../lib/upsert";
import type { EventStatus } from "../lib/types";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const capArg = process.argv.find((a) => a.startsWith("--cap="));
  const cap = capArg ? Math.max(1, Number(capArg.slice(6)) || DEFAULT_CAP) : DEFAULT_CAP;
  if (!sql) throw new Error("DATABASE_URL is required");
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is required");

  const rows = await sql<
    { id: string; title: string; venue: string; city: string; start: string; sourceUrl: string; ticketUrl: string; status: EventStatus; verifiedAt: string | null }[]
  >`
    select id::text as id, title, venue, city,
           to_char(start_at at time zone 'America/Chicago', 'YYYY-MM-DD"T"HH24:MI') as start,
           source_url as "sourceUrl", ticket_url as "ticketUrl", status,
           verified_at::text as "verifiedAt"
    from events
    where status = 'published' and start_at >= now()
      and start_at <= now() + interval '7 days'
  `;

  const candidates = selectForVerification(rows, new Date(), { cap });
  const freshLooks = candidates.filter((c) => !rows.find((r) => r.id === c.id)?.verifiedAt).length;
  const unverifiedInWindow = rows.filter(
    (r) => !r.verifiedAt && (r.sourceUrl || r.ticketUrl).trim().length > 0,
  ).length;

  console.log(
    `[verify] window ${rows.length} · checking ${candidates.length} (cap ${cap})${dryRun ? " (DRY RUN)" : ""}`,
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

  for (const [i, batch] of batches.entries()) {
    // Checked before the call, never during: a batch in flight has been paid
    // for and always finishes.
    if (!withinBudget(startedAt, Date.now())) {
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

    const batchCancels: { id: string; evidence: string }[] = [];
    const batchConfirms: string[] = [];
    const batchFlags: { id: string; verdict: string; note: string }[] = [];

    for (const v of verdicts) {
      const action = actionFor(v);
      const title = batch.find((e) => e.id === action.id)?.title ?? action.id;
      if (action.kind === "cancel") {
        console.log(`[verify]   ✗ CANCELLED "${title}" — ${action.evidence.slice(0, 90)}`);
        batchCancels.push({ id: action.id, evidence: action.evidence });
      } else if (action.kind === "confirm") {
        batchConfirms.push(action.id);
      } else {
        console.log(`[verify]   ⚑ ${action.verdict.toUpperCase()} "${title}" — ${action.note}`);
        batchFlags.push({ id: action.id, verdict: action.verdict, note: action.note });
      }
    }

    // Flush per batch. The run is now long enough that a timeout or a crash at
    // batch 19 of 21 would otherwise discard nineteen batches of paid-for
    // verification — including a cancellation we had evidence for.
    if (!dryRun) {
      await markVerified(batchConfirms);
      cancelled += await cancelVerified(batchCancels);
      for (const f of batchFlags) await flagVerification(f.id, f.verdict, f.note);
    }

    confirms.push(...batchConfirms);
    cancels.push(...batchCancels);
    flags.push(...batchFlags);
    done++;
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

main().catch((err) => {
  console.error("[verify] fatal:", err);
  process.exitCode = 1;
});
