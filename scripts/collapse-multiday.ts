/**
 * Collapse multi-day runs and merge duplicates in the EXISTING database
 * (roadmap 4.4; span-aware since Jul 2026).
 *
 *   npm run collapse -- --dry-run    preview every action, write nothing
 *   npm run collapse                 apply
 *
 * What it does (all planned by the pure, unit-tested planCollapse):
 *   - CONSECUTIVE days with the same title+city → one event with a date span.
 *   - SAME day, same title+city, different venue guesses → one event, rest archived.
 *   - Rows whose days fall INSIDE an existing run card's span join that run —
 *     including retitles ("Weekend V", "— Final Weekends") the old start-day
 *     clustering missed.
 *   - Sub-events folded into their parent ("State Fair — Llama Contest" inside
 *     the fair's run) when titles are prefix-related and dates are contained.
 *   - WEEKLY series and SPORTS are left completely alone, as before.
 *
 * Nothing is deleted: extras are archived, so this is reversible.
 */
import { sql } from "../lib/db";
import { planCollapse } from "../lib/multiday";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (!sql) throw new Error("DATABASE_URL is required");

  const rows = await sql<
    { id: string; title: string; city: string; category: string; start: string; end_day: string | null }[]
  >`
    select id::text as id, title, city, category,
           to_char(start_at at time zone 'America/Chicago', 'YYYY-MM-DD"T"HH24:MI') as start,
           to_char(multi_day_end at time zone 'America/Chicago', 'YYYY-MM-DD') as end_day
    from events
    where status in ('published', 'draft')
    order by start_at asc
  `;

  const actions = planCollapse(rows.map((r) => ({ ...r, endDay: r.end_day })));
  console.log(`[collapse] ${rows.length} events, ${actions.length} action(s)${dryRun ? " (DRY RUN)" : ""}\n`);

  let collapsed = 0;
  let merged = 0;
  let folded = 0;
  let archived = 0;

  for (const a of actions) {
    const label = a.kind === "fold" ? "FOLD  " : a.kind === "run" ? "RUN   " : "DUP   ";
    console.log(
      `  ${label} "${a.title}" ${a.startDay}${a.endDay > a.startDay ? ` → ${a.endDay}` : ""}  (keep 1, archive ${a.archiveIds.length}${a.setEnd ? `, set end ${a.setEnd}` : ""})`,
    );
    if (a.kind === "fold") folded++;
    else if (a.kind === "run") collapsed++;
    else merged++;
    archived += a.archiveIds.length;

    if (!dryRun) {
      if (a.setEnd) {
        await sql`
          update events
          set multi_day_end = (${`${a.setEnd}T23:59`}::timestamp at time zone 'America/Chicago')
          where id::text = ${a.keepId}
        `;
      }
      if (a.archiveIds.length > 0) {
        await sql`
          update events set status = 'archived'
          where id::text = any(${a.archiveIds})
            and status in ('published', 'draft')
        `;
      }
    }
  }

  console.log(
    `\n[collapse] ${collapsed} run(s), ${merged} duplicate group(s), ${folded} fold(s), ${archived} row(s) archived`,
  );
  console.log(`[collapse] ${rows.length} → ${rows.length - archived} events`);
  if (dryRun) console.log("\n[collapse] dry run — nothing written. Re-run without --dry-run to apply.");

  await sql.end({ timeout: 5 });
}

main().catch((err) => {
  console.error("[collapse] fatal:", err);
  process.exitCode = 1;
});
