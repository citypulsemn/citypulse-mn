/**
 * Re-check listings that were stamped `verified_at` under the OLD verify prompt.
 *
 *   npm run resweep-verified                      dry run — decides nothing
 *   npm run resweep-verified -- --apply           apply
 *   npm run resweep-verified -- --apply --backup=path.json
 *   npm run resweep-verified -- --limit=40        smaller batch
 *
 * WHY. Until 5 Sep 2026 `buildVerifyPrompt` asked whether an event "still
 * appears as scheduled" against its own source, and `parseVerdicts` treated a
 * missing verdict field as "confirmed". Between them, an event the agent never
 * actually found could come back confirmed — which is how a fabricated Damian
 * Marley show at The Fillmore carried a `verified_at` stamp two days before a
 * reader caught it.
 *
 * So every stamp made by the AGENT under that prompt is a claim we cannot stand
 * behind. This re-asks the question properly and, where the answer is anything
 * but "confirmed", CLEARS the stamp rather than leaving false confidence in
 * place. A cleared stamp is honest — it says we do not know — and because
 * `selectForVerification` sorts never-verified first, it also puts the listing
 * at the front of the next scheduled pass.
 *
 * WHAT IT WILL NOT TOUCH: stamps made by a PRIMARY-SOURCE IMPORTER. Those come
 * from a league API or a venue's own calendar, not from a model, and the prompt
 * bug never applied to them. Skipping them is not an optimisation — re-checking
 * a feed-verified row with an agent would REPLACE good evidence with a weaker
 * one.
 *
 * Nothing is hidden and nothing is cancelled here. The most this does is admit
 * that a listing is unverified.
 */
import { writeFileSync } from "node:fs";
import { sql } from "../lib/db";
import { verifyEventsBatch } from "../lib/agents/research-agent";
import { actionFor, batchForVerification, withinBudget, type VerifiableEvent } from "../lib/verify";
import { feedVenues, feedHosts, isFeedStamped } from "../lib/verify-attribution";
import { revalidateAndReport } from "../lib/revalidate-client";

const apply = process.argv.includes("--apply");
const backupArg = process.argv.find((a) => a.startsWith("--backup="));
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? Math.max(1, Number(limitArg.slice(8)) || 200) : 200;

interface Row {
  id: string;
  title: string;
  venue: string;
  city: string;
  start: string;
  sourceUrl: string;
  ticketUrl: string;
  verified_at: string;
}

async function main() {
  if (!sql) throw new Error("DATABASE_URL is required");
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is required");

  const rows = await sql<Row[]>`
    select id::text as id, title, venue, city,
           to_char(start_at at time zone 'America/Chicago', 'YYYY-MM-DD"T"HH24:MI') as start,
           coalesce(source_url,'') as "sourceUrl", coalesce(ticket_url,'') as "ticketUrl",
           verified_at::text as verified_at
    from events
    where status = 'published' and start_at >= now() and verified_at is not null
    order by start_at
  `;

  const venues = feedVenues();
  const hosts = feedHosts();

  const trusted = rows.filter((r) => isFeedStamped(r, venues, hosts));
  const suspect = rows.filter((r) => !isFeedStamped(r, venues, hosts)).slice(0, LIMIT);

  console.log(`[resweep] ${rows.length} upcoming published listing(s) carry a verified_at stamp`);
  console.log(`[resweep]   ${trusted.length} from a primary source — left alone`);
  console.log(`[resweep]   ${suspect.length} stamped by the agent — re-checking${apply ? "" : " (DRY RUN)"}`);
  if (suspect.length === 0) return void (await sql.end({ timeout: 5 }));

  const batches = batchForVerification(
    suspect.map<VerifiableEvent>((r) => ({
      id: r.id,
      title: r.title,
      venue: r.venue,
      city: r.city,
      start: r.start,
      sourceUrl: r.sourceUrl,
      ticketUrl: r.ticketUrl,
    })),
    8,
  );

  const byId = new Map(suspect.map((r) => [r.id, r]));
  const startedAt = Date.now();
  const keep: string[] = [];
  const clear: { id: string; verdict: string; note: string }[] = [];
  let done = 0;

  for (const [i, batch] of batches.entries()) {
    if (!withinBudget(startedAt, Date.now())) {
      console.warn(`[resweep] ⚠ time budget reached after ${done}/${batches.length} batches — stopping cleanly`);
      break;
    }
    console.log(`[resweep] batch ${i + 1}/${batches.length}: ${batch.map((e) => e.title.slice(0, 26)).join(" · ")}`);
    let verdicts;
    try {
      verdicts = await verifyEventsBatch(batch);
    } catch (err) {
      console.error(`[resweep] batch ${i + 1} failed:`, err);
      continue;
    }
    // A listing the model said nothing about keeps its stamp. This job only
    // ever REMOVES confidence, and removing it on silence would be its own
    // guess (rule 6 cuts the other way here: say so, change nothing).
    const answered = new Set(verdicts.map((v) => v.id));
    for (const e of batch) {
      if (!answered.has(e.id)) console.warn(`[resweep]   ? no verdict returned for "${e.title}" — stamp left as-is`);
    }

    for (const v of verdicts) {
      const row = byId.get(v.id);
      if (!row) continue;
      const action = actionFor(v);
      if (action.kind === "confirm") {
        keep.push(v.id);
        console.log(`[resweep]   ✓ still confirmed: ${row.title.slice(0, 46)}`);
      } else {
        const note = action.kind === "flag" ? action.note : `${v.verdict}${v.evidence ? ` — ${v.evidence}` : ""}`;
        clear.push({ id: v.id, verdict: v.verdict, note });
        console.log(`[resweep]   ✗ ${v.verdict.toUpperCase()}: ${row.title.slice(0, 46)} @ ${row.venue.slice(0, 24)}`);
        console.log(`[resweep]     ${note.slice(0, 160)}`);
      }
    }
    done++;
  }

  console.log(
    `\n[resweep] ${keep.length} stamp(s) stand, ${clear.length} to clear — ${done}/${batches.length} batches in ${Math.round((Date.now() - startedAt) / 60000)}m`,
  );

  if (!apply) {
    console.log("[resweep] dry run — nothing written. Re-run with --apply.");
    return void (await sql.end({ timeout: 5 }));
  }
  if (clear.length === 0) return void (await sql.end({ timeout: 5 }));

  const ids = clear.map((c) => c.id);
  const backup = await sql`
    select id::text as id, title, venue, status, verified_at::text as verified_at
    from events where id::text = any(${ids})`;
  const path = backupArg ? backupArg.slice("--backup=".length) : `resweep-backup-${Date.now()}.json`;
  writeFileSync(path, JSON.stringify(backup, null, 2));
  console.log(`[resweep] backup written: ${path}`);

  // Clear the stamp only. Nothing is hidden and nothing is cancelled: the most
  // this job may conclude is that we do not actually know.
  await sql`update events set verified_at = null where id::text = any(${ids})`;
  for (const c of clear) {
    await sql`
      insert into admin_audit (action, event_id, patch)
      values ('resweep_unverify', ${c.id}::uuid,
              ${sql.json({ verdict: c.verdict, note: c.note.slice(0, 400), why: "verified under the pre-5-Sep-2026 prompt; re-check disagreed" } as never)})
    `;
    // Same shape the verify pass writes, so these land in the ops digest's
    // flagged-listings line alongside everything else.
    await sql`
      insert into admin_audit (action, event_id, patch)
      values ('verify_flag', ${c.id}::uuid,
              ${sql.json({ verdict: c.verdict, note: c.note.slice(0, 300) } as never)})
    `;
  }
  console.log(`[resweep] cleared ${clear.length} stamp(s); each listing is now 'unverified', not hidden`);

  await revalidateAndReport("resweep", `cleared ${clear.length} verified_at stamp(s)`);
  await sql.end({ timeout: 5 });
}

main().catch((err) => {
  console.error("[resweep] fatal:", err);
  process.exitCode = 1;
});
