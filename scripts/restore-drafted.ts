/**
 * Put drafted listings back with the date the ORGANISER publishes.
 *
 *   npx tsx scripts/restore-drafted.ts --dry-run        check, write nothing
 *   npx tsx scripts/restore-drafted.ts --limit=24       cap the spend
 *   npx tsx scripts/restore-drafted.ts --apply          apply the actions
 *   … --from=hide:source-hold                         work a different draft reason
 *
 * Input is every event drafted for the reason given by --from (default the
 * `wrong_event` sweep) that nobody has resolved. Output is one of three actions per row, decided by
 * lib/restore-check.ts, never by this script:
 *
 *   republish  — the organiser publishes it; the corrected date goes in.
 *                `verified_at` is stamped ONLY if the organiser printed a TIME.
 *   archive    — the organiser's schedule covers the period and it is not in it.
 *   leave      — anything unclear. A drafted row is already safe, so the
 *                do-nothing branch costs nothing and is the right default.
 *
 * DRY RUN STILL SPENDS MONEY. It makes the same model calls and only skips the
 * writes, which is the point — you can read every proposed action before any of
 * them touches a live row.
 */
import { requireSql } from "../lib/db";
import { computeEventKey } from "../lib/event-key";
import { findCorrectDates } from "../lib/agents/research-agent";
import { actionForRestore, type RestoreItem } from "../lib/restore-check";
import { withinBudget, RUN_BUDGET_MS } from "../lib/verify";

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=")[1];
const APPLY = process.argv.includes("--apply");
const LIMIT = Math.max(1, Number(arg("limit") ?? 200));
const PER_BATCH = Math.max(1, Number(arg("batch") ?? 8));
// Which draft reason to work. The wrong_event sweep was the first customer, but
// the same question — "what does the organiser say" — applies to anything we
// pulled, and hardcoding one audit action meant the 18 rows held back from a
// poisoned source were invisible to this script.
const FROM = arg("from") ?? "hide:wrong-event";

async function main() {
  const sql = requireSql();
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is required");

  const rows = await sql<
    { id: string; title: string; venue: string; city: string; was: string; evidence: string }[]
  >`
    select distinct on (e.id) e.id::text as id, e.title, e.venue, e.city,
           to_char(e.start_at at time zone 'America/Chicago','YYYY-MM-DD"T"HH24:MI') as was,
           coalesce(a.patch->>'evidence','') as evidence
    from admin_audit a join events e on e.id = a.event_id
    where a.action = ${FROM} and e.status = 'draft' and e.start_at > now()
    order by e.id, a.at desc`;

  const items: RestoreItem[] = rows.slice(0, LIMIT);
  console.log(`[restore] ${rows.length} drafted; checking ${items.length}${APPLY ? "" : "  (DRY RUN — no writes)"}`);
  if (items.length === 0) return void (await sql.end({ timeout: 5 }));

  const batches: RestoreItem[][] = [];
  for (let i = 0; i < items.length; i += PER_BATCH) batches.push(items.slice(i, i + PER_BATCH));

  const tally = { republish: 0, archive: 0, leave: 0, duplicate: 0 };
  const startedAt = Date.now();

  for (const [i, batch] of batches.entries()) {
    if (!withinBudget(startedAt, Date.now(), RUN_BUDGET_MS * 3)) {
      console.warn(`[restore] ⚠ budget reached after ${i}/${batches.length} batches — stopping cleanly`);
      break;
    }
    console.log(`\n[restore] batch ${i + 1}/${batches.length}`);
    let results;
    try {
      results = await findCorrectDates(batch);
    } catch (err) {
      console.error(`[restore] batch ${i + 1} failed:`, err);
      continue;
    }

    // A row the model said nothing about stays drafted — silence is not a verdict.
    const answered = new Set(results.map((r) => r.id));
    for (const b of batch) if (!answered.has(b.id)) tally.leave++;

    for (const r of results) {
      const row = batch.find((b) => b.id === r.id)!;
      const act = actionForRestore(r, {
        now: new Date(),
        current: { venue: row.venue, city: row.city },
      });
      const label = row.title.slice(0, 44);

      if (act.kind === "republish") {
        console.log(
          `  ✓ REPUBLISH ${row.was} → ${act.start}  ${label}` +
            `${act.stampVerified ? "  [time confirmed]" : "  [date only, left unverified]"}` +
            `${act.venue ? `\n      venue → "${act.venue}"` : ""}` +
            `\n      ${act.sourceUrl}`,
        );
        tally.republish++;
        if (APPLY) {
          try {
            await sql`
              update events set status='published',
                start_at=(${act.start}::text::timestamp at time zone 'America/Chicago'),
                venue=${act.venue ?? row.venue},
                event_key=${computeEventKey(row.title, act.venue ?? row.venue, act.start)},
                source_url=${act.sourceUrl},
                verified_at=${act.stampVerified ? sql`now()` : null},
                updated_at=now()
              where id=${act.id}::uuid`;
            await sql`insert into admin_audit (action, event_id, patch) values ('restore:corrected-date', ${act.id}::uuid, ${sql.json(
              { was: row.was, now: act.start, source: act.sourceUrl, timeConfirmed: act.stampVerified,
                venueWas: act.venue ? row.venue : null, venueNow: act.venue ?? null, note: r.note ?? null },
            )})`;
          } catch (err) {
            // 23505 = the recomputed event_key already exists, i.e. the corrected
            // event IS a row we already carry. That is not an error, it is the
            // answer: this draft is a duplicate of something already right, and
            // the constraint is the only thing that knows it. Archive it instead
            // of crashing the run — which is what the first pass did, at batch 8
            // of 14, after 63 decisions.
            if ((err as { code?: string }).code !== "23505") throw err;
            await sql`update events set status='archived', updated_at=now() where id=${act.id}::uuid`;
            await sql`insert into admin_audit (action, event_id, patch) values ('archive:duplicate-of-corrected', ${act.id}::uuid, ${sql.json(
              { why: `corrected to ${act.start}, which is a row we already publish`, source: act.sourceUrl },
            )})`;
            tally.republish--;
            tally.duplicate++;
            console.log(`      → already have it at ${act.start}; archived as duplicate`);
          }
        }
      } else if (act.kind === "archive") {
        console.log(`  ✗ ARCHIVE   ${label}\n      ${act.note.slice(0, 150)}\n      ${act.sourceUrl}`);
        tally.archive++;
        if (APPLY) {
          await sql`update events set status='archived', updated_at=now() where id=${act.id}::uuid`;
          await sql`insert into admin_audit (action, event_id, patch) values ('archive:not-happening', ${act.id}::uuid, ${sql.json(
            { why: act.note, source: act.sourceUrl },
          )})`;
        }
      } else {
        console.log(`  · leave     ${label} — ${act.note.slice(0, 110)}`);
        tally.leave++;
      }
    }
  }

  console.log(
    `\n[restore] republish ${tally.republish} · archive ${tally.archive}` +
      ` · duplicate of a row we already have ${tally.duplicate} · leave drafted ${tally.leave}` +
      `${APPLY ? "" : "\n[restore] DRY RUN — nothing was written. Re-run with --apply to act on this."}`,
  );
  await sql.end({ timeout: 5 });
}

main().catch((err) => {
  console.error("[restore] fatal:", err);
  process.exitCode = 1;
});
