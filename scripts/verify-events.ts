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
import {
  selectForVerification,
  batchForVerification,
  actionFor,
} from "../lib/verify";
import { verifyEventsBatch } from "../lib/agents/research-agent";
import { markVerified, cancelVerified, flagVerification } from "../lib/upsert";
import type { EventStatus } from "../lib/types";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (!sql) throw new Error("DATABASE_URL is required");
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is required");

  const rows = await sql<
    { id: string; title: string; venue: string; city: string; start: string; sourceUrl: string; ticketUrl: string; status: EventStatus }[]
  >`
    select id::text as id, title, venue, city,
           to_char(start_at at time zone 'America/Chicago', 'YYYY-MM-DD"T"HH24:MI') as start,
           source_url as "sourceUrl", ticket_url as "ticketUrl", status
    from events
    where status = 'published' and start_at >= now()
      and start_at <= now() + interval '7 days'
  `;

  const candidates = selectForVerification(rows, new Date());
  console.log(`[verify] ${candidates.length} event(s) to re-check${dryRun ? " (DRY RUN)" : ""}`);
  if (candidates.length === 0) return void (await sql.end({ timeout: 5 }));

  const cancels: { id: string; evidence: string }[] = [];
  const confirms: string[] = [];
  const flags: { id: string; verdict: string; note: string }[] = [];

  for (const [i, batch] of batchForVerification(candidates, 8).entries()) {
    console.log(`[verify] batch ${i + 1}: ${batch.map((e) => e.title).join(" · ")}`);
    let verdicts;
    try {
      verdicts = await verifyEventsBatch(batch);
    } catch (err) {
      console.error(`[verify] batch ${i + 1} failed:`, err);
      continue;
    }
    for (const v of verdicts) {
      const action = actionFor(v);
      const title = batch.find((e) => e.id === action.id)?.title ?? action.id;
      if (action.kind === "cancel") {
        console.log(`[verify]   ✗ CANCELLED "${title}" — ${action.evidence.slice(0, 90)}`);
        cancels.push({ id: action.id, evidence: action.evidence });
      } else if (action.kind === "confirm") {
        confirms.push(action.id);
      } else {
        console.log(`[verify]   ⚑ ${action.verdict.toUpperCase()} "${title}" — ${action.note}`);
        flags.push({ id: action.id, verdict: action.verdict, note: action.note });
      }
    }
  }

  console.log(
    `\n[verify] confirmed ${confirms.length}, cancelled ${cancels.length}, flagged ${flags.length}`,
  );

  if (!dryRun) {
    await markVerified(confirms);
    const n = await cancelVerified(cancels);
    for (const f of flags) await flagVerification(f.id, f.verdict, f.note);
    if (n > 0) console.log(`[verify] ${n} event(s) marked cancelled (with evidence, audited)`);
  } else {
    console.log("[verify] dry run — nothing written.");
  }

  await sql.end({ timeout: 5 });
}

main().catch((err) => {
  console.error("[verify] fatal:", err);
  process.exitCode = 1;
});
