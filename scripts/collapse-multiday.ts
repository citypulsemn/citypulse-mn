/**
 * Collapse multi-day runs and merge duplicates in the EXISTING database
 * (roadmap 4.4).
 *
 *   npm run collapse -- --dry-run    preview every action, write nothing
 *   npm run collapse                 apply
 *
 * What it does:
 *   - CONSECUTIVE days with the same title+city → one event with a date span
 *     ("Minnesota State Fair, Aug 20–31" instead of 12 rows).
 *   - SAME day, same title+city, different venue guesses → one event, the rest archived.
 *   - WEEKLY series (a recurring date night, a Thursday film series) are left
 *     completely alone — only consecutive days form a run.
 *
 * Nothing is deleted: extras are archived, so this is reversible.
 */
import { sql } from "../lib/db";
import { collapsibleClusters } from "../lib/multiday";

interface Row {
  id: string;
  title: string;
  city: string;
  start: string;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (!sql) throw new Error("DATABASE_URL is required");

  const rows = await sql<Row[]>`
    select id::text as id, title, city,
           to_char(start_at at time zone 'America/Chicago', 'YYYY-MM-DD"T"HH24:MI') as start
    from events
    where status in ('published', 'draft')
    order by start_at asc
  `;

  const clusters = collapsibleClusters(rows);
  console.log(`[collapse] ${rows.length} events, ${clusters.length} cluster(s)${dryRun ? " (DRY RUN)" : ""}\n`);

  let collapsed = 0;
  let merged = 0;
  let archived = 0;

  for (const c of clusters) {
    const [keep, ...extras] = c.events;
    if (extras.length === 0) continue;

    if (c.multiDay) {
      console.log(`  RUN    "${keep.title}" ${c.startDay} → ${c.endDay}  (keep 1, archive ${extras.length})`);
      collapsed++;
      if (!dryRun) {
        await sql`
          update events
          set multi_day_end = (${`${c.endDay}T23:59`}::timestamp at time zone 'America/Chicago')
          where id::text = ${keep.id}
        `;
      }
    } else {
      console.log(`  DUP    "${keep.title}" ${c.startDay}  (keep 1, archive ${extras.length})`);
      merged++;
    }

    archived += extras.length;
    if (!dryRun) {
      await sql`
        update events set status = 'archived'
        where id::text = any(${extras.map((e) => e.id)})
          and status in ('published', 'draft')
      `;
    }
  }

  console.log(
    `\n[collapse] ${collapsed} multi-day run(s), ${merged} duplicate group(s), ${archived} row(s) archived`,
  );
  console.log(`[collapse] ${rows.length} → ${rows.length - archived} events`);
  if (dryRun) console.log("\n[collapse] dry run — nothing written. Re-run without --dry-run to apply.");

  await sql.end({ timeout: 5 });
}

main().catch((err) => {
  console.error("[collapse] fatal:", err);
  process.exitCode = 1;
});
