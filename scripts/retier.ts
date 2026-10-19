/**
 * Recompute every event's price tier from its price text.
 *
 * The Free tier was a substring match on "free", so "$22 general; children 3
 * and under free" sat in the Free filter and on the Free This Week page. The
 * rule is now "free to attend" (lib/price-quality.ts, isFreeToAttend). The
 * tier is a stored column, so rows written under the old rule keep the old
 * answer until this recomputes them. Idempotent: a row whose tier already
 * matches its price is untouched.
 *
 *   npm run retier -- --dry-run            print every change, write nothing
 *   npm run retier                         apply; changed rows are backed up
 *                                          first to retier-backup.json
 *   npm run retier -- --backup=PATH        choose the backup file
 */
import { writeFileSync } from "node:fs";
import { sql } from "../lib/db";
import { normalizeTier } from "../lib/event-key";
import type { PriceTier } from "../lib/types";

interface Row {
  id: string;
  title: string;
  price: string;
  price_tier: PriceTier;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const backup = process.argv.find((a) => a.startsWith("--backup="))?.slice("--backup=".length) ?? "retier-backup.json";
  if (!sql) throw new Error("DATABASE_URL is required");

  const rows = await sql<Row[]>`select id::text as id, title, price, price_tier from events`;
  const changes = rows
    .map((row) => ({ row, to: normalizeTier(row.price) }))
    .filter(({ row, to }) => to !== row.price_tier);

  console.log(`[retier] ${rows.length} events, ${changes.length} change tier${dryRun ? " (DRY RUN)" : ""}\n`);
  const moves = new Map<string, number>();
  for (const { row, to } of changes) {
    const key = `${row.price_tier} → ${to}`;
    moves.set(key, (moves.get(key) ?? 0) + 1);
    console.log(`  ${row.price_tier.padEnd(4)} → ${to.padEnd(4)}  ${JSON.stringify(row.price)}  ${row.title}`);
  }
  console.log("");
  for (const [key, n] of [...moves].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${key}`);

  if (!dryRun && changes.length > 0) {
    // Back up before a bulk write (CLAUDE.md): enough to put every row back.
    writeFileSync(backup, JSON.stringify(changes.map(({ row }) => row), null, 1));
    console.log(`\n[retier] backed up ${changes.length} row(s) to ${backup}`);
    for (const { row, to } of changes) {
      await sql`update events set price_tier = ${to} where id::text = ${row.id}`;
    }
    console.log(`[retier] updated ${changes.length} row(s)`);
  }
  if (dryRun) console.log("\n[retier] dry run — re-run without --dry-run to apply.");
  await sql.end({ timeout: 5 });
}

main().catch((err) => {
  console.error("[retier] fatal:", err);
  process.exitCode = 1;
});
