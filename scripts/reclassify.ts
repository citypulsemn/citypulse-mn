/**
 * Reclassify existing events (roadmap 4.1).
 *
 * Every event already in the database was categorized by WHICHEVER AGENT FOUND
 * IT — so concerts discovered by the food agent are filed as food, and the
 * festival bucket became a dumping ground. This re-runs each event's own content
 * through the classifier and corrects the category.
 *
 *   npm run reclassify -- --dry-run    preview every change, write nothing
 *   npm run reclassify                 apply the changes
 *
 * Safe to re-run: it's idempotent (a correctly-categorized event won't move).
 */
import { sql } from "../lib/db";
import { classifyEvent } from "../lib/classify";
import { CATEGORY_KEYS } from "../lib/categories";
import type { CategoryKey } from "../lib/types";

interface Row {
  id: string;
  title: string;
  venue: string;
  description: string;
  category: CategoryKey;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (!sql) throw new Error("DATABASE_URL is required");

  const rows = await sql<Row[]>`
    select id::text as id, title, venue, coalesce(description, '') as description, category
    from events
    where status in ('published', 'draft')
  `;
  console.log(`[reclassify] examining ${rows.length} events${dryRun ? " (DRY RUN)" : ""}\n`);

  const before = tally(rows.map((r) => r.category));
  const changes: { row: Row; to: CategoryKey }[] = [];

  for (const row of rows) {
    const { category, changed } = classifyEvent({
      title: row.title,
      venue: row.venue,
      description: row.description,
      category: row.category,
    });
    if (changed && category !== row.category) changes.push({ row, to: category });
  }

  for (const c of changes) {
    console.log(`  ${c.row.category.padEnd(9)} → ${c.to.padEnd(9)}  ${c.row.title}`);
  }

  if (!dryRun && changes.length > 0) {
    for (const c of changes) {
      await sql`update events set category = ${c.to} where id::text = ${c.row.id}`;
    }
  }

  const after = tally(
    rows.map((r) => changes.find((c) => c.row.id === r.id)?.to ?? r.category),
  );

  console.log(`\n[reclassify] ${changes.length} of ${rows.length} events reclassified${dryRun ? " (nothing written)" : ""}\n`);
  console.log("  category    before   after");
  console.log("  ---------------------------");
  for (const k of CATEGORY_KEYS) {
    const b = before[k] ?? 0;
    const a = after[k] ?? 0;
    const delta = a - b;
    const arrow = delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : "";
    console.log(`  ${k.padEnd(11)} ${String(b).padStart(5)}  ${String(a).padStart(6)}  ${arrow}`);
  }

  if (dryRun) console.log("\n[reclassify] dry run — re-run without --dry-run to apply.");

  await sql.end({ timeout: 5 });
}

function tally(cats: CategoryKey[]): Record<string, number> {
  const t: Record<string, number> = {};
  for (const c of cats) t[c] = (t[c] ?? 0) + 1;
  return t;
}

main().catch((err) => {
  console.error("[reclassify] fatal:", err);
  process.exitCode = 1;
});
