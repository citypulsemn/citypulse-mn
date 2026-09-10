/**
 * Move published-but-never-verified events from a given source back to draft.
 *
 *   npx tsx scripts/hold-unverified-source.ts --match=bringmethenews.com --dry-run
 *   npx tsx scripts/hold-unverified-source.ts --match=bringmethenews.com/...best-halloween
 *
 * WHY. When one source turns out to have produced a fabricated listing, the
 * other listings that came off the same page were produced by the same process
 * on the same day, and none of them has been checked either. The Westwood Hills
 * Halloween Party (a 2025 event re-dated to 2026) arrived with 19 siblings from
 * one roundup article.
 *
 * NEVER DELETES. Events go to 'draft', which hides them and is reversible with
 * one update. Verified events are left alone no matter what — a human already
 * looked at those, and this script does not overrule a human.
 */
import { requireSql } from "../lib/db";

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=").slice(1).join("=");
const MATCH = arg("match");
const DRY = process.argv.includes("--dry-run");

async function main() {
  if (!MATCH) {
    console.error("--match=<substring of source_url> is required");
    process.exitCode = 1;
    return;
  }
  const sql = requireSql();
  const like = `%${MATCH}%`;

  const rows = await sql<{ id: string; title: string; start_at: string; verified_at: string | null }[]>`
    select id, title, start_at::text as start_at, verified_at::text as verified_at
    from events
    where source_url like ${like} and status = 'published' and verified_at is null
    order by start_at
  `;
  const kept = await sql<{ n: number }[]>`
    select count(*)::int as n from events
    where source_url like ${like} and status = 'published' and verified_at is not null
  `;

  console.log(`[hold] ${rows.length} published + unverified match "${MATCH}"${DRY ? "  (DRY RUN)" : ""}`);
  console.log(`[hold] ${kept[0]?.n ?? 0} verified match too — left published, a human already checked those\n`);
  for (const r of rows) console.log(`  ${r.start_at.slice(0, 16)}  ${r.title}`);

  if (DRY || rows.length === 0) {
    console.log(`\n[hold] nothing written.`);
    await sql.end({ timeout: 5 });
    return;
  }

  const ids = rows.map((r) => r.id);
  await sql`update events set status = 'draft', updated_at = now() where id::text = any(${ids})`;
  for (const r of rows) {
    await sql`insert into admin_audit (action, event_id, patch) values ('hide:source-hold', ${r.id}, ${sql.json({
      match: MATCH,
      title: r.title,
      why: "published but never verified, from a source that produced a fabricated listing",
    })})`;
  }
  console.log(`\n[hold] ${rows.length} event(s) moved to draft. To undo:`);
  console.log(`       update events set status='published' where id in (${ids.map((i) => `'${i}'`).join(", ")});`);
  await sql.end({ timeout: 5 });
}

main().catch((err) => {
  console.error("[hold] fatal:", err);
  process.exitCode = 1;
});
