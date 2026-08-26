/**
 * Resolve the self-check's clashes where the EVIDENCE decides (docs/SELF-CHECK.md).
 *
 * Usage: npm run resolve-conflicts [-- --apply] [-- --backup=path.json]
 *
 * A clash is two different things claimed in one room at one time, so at most one
 * is real. This only acts on the ones where we already know which: a listing
 * confirmed against a primary source on one side, an unconfirmed one on the
 * other. The unconfirmed one is hidden.
 *
 * Everything else is REPORTED AND LEFT ALONE. Where neither side is verified,
 * picking a winner would be a coin toss dressed as a decision, and the wrong call
 * deletes a real event.
 *
 * This is deliberately two instruments agreeing. The music importer already saw
 * these rows and flagged them `unmatched` rather than hiding them — its safety
 * valve, because a fuzzy title miss is likelier than a venue forgetting a show.
 * The clash check is independent evidence: the room is occupied at that hour by a
 * show the venue's own calendar confirms. One instrument guessing is a guess; two
 * agreeing from different directions is a finding.
 *
 * DRY RUN BY DEFAULT. Nothing is deleted — losers become `draft`, reversible.
 */
import { writeFileSync } from "node:fs";
import { sql } from "../lib/db";
import { revalidateAndReport } from "../lib/revalidate-client";
import { findContradictions, type CalendarRow } from "../lib/contradictions";

const apply = process.argv.includes("--apply");
const backupArg = process.argv.find((a) => a.startsWith("--backup="));

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  if (!sql) throw new Error("no database connection");

  const rows = await sql<CalendarRow[]>`
    select id::text as id, venue, title, category,
           (verified_at is not null) as verified,
           to_char(start_at at time zone 'America/Chicago', 'YYYY-MM-DD"T"HH24:MI') as start
    from events
    where status = 'published' and start_at >= now()`;

  const byId = new Map(rows.map((r) => [r.id, r]));
  const { conflicts } = findContradictions([...rows]);
  if (!conflicts.length) {
    console.log("[conflicts] none — nothing to do");
    return;
  }

  // id → the verified listing it loses to. A Map, not a list, because one wrong
  // listing can clash with the same verified show more than once.
  const losers = new Map<string, { row: CalendarRow; winner: CalendarRow }>();
  const undecidable: typeof conflicts = [];

  for (const c of conflicts) {
    const a = byId.get(c.a.id);
    const b = byId.get(c.b.id);
    if (!a || !b) continue;
    if (a.verified === b.verified) {
      undecidable.push(c);
      continue;
    }
    const [winner, loser] = a.verified ? [a, b] : [b, a];
    losers.set(loser.id, { row: loser, winner });
  }

  console.log(`[conflicts] ${conflicts.length} clashes\n`);
  console.log(`DECIDED BY EVIDENCE (${losers.size} to hide)`);
  for (const { row, winner } of losers.values()) {
    console.log(`  ${row.start.slice(0, 10)}  ${row.venue.slice(0, 28)}`);
    console.log(`      hide  "${row.title.slice(0, 52)}"`);
    console.log(`      keep  "${winner.title.slice(0, 52)}"  ✓ source-verified`);
  }

  console.log(`\nLEFT FOR A PERSON (${undecidable.length}) — neither side is verified`);
  for (const c of undecidable) {
    console.log(`  ${c.day} ${c.venue.slice(0, 26).padEnd(28)} "${c.a.title.slice(0, 34)}" / "${c.b.title.slice(0, 34)}"`);
  }

  if (!apply) {
    console.log("\n[conflicts] DRY RUN — nothing written. Re-run with --apply");
    return;
  }
  if (!losers.size) {
    console.log("\n[conflicts] nothing the evidence decides");
    return;
  }

  const backup = backupArg ? backupArg.slice("--backup=".length) : "conflict-backup.json";
  writeFileSync(
    backup,
    JSON.stringify(
      [...losers.values()].map(({ row, winner }) => ({
        id: row.id, title: row.title, venue: row.venue, start: row.start,
        from: "published", to: "draft", lostTo: winner.id, lostToTitle: winner.title,
      })),
      null,
      2,
    ),
  );
  console.log(`\n[conflicts] backup written: ${backup}`);

  const ids = [...losers.keys()];
  await sql`update events set status = 'draft' where id::text = any(${ids})`;
  for (const { row, winner } of losers.values()) {
    await sql`
      insert into admin_audit (action, event_id, patch)
      values ('resolve_conflict', ${row.id}::uuid,
              ${sql.json({
                status: "draft",
                why: "clashed with a source-verified listing in the same room at the same time",
                lost_to: winner.id,
                lost_to_title: winner.title.slice(0, 200),
              } as never)})
    `;
  }
  console.log(`[conflicts] hidden ${ids.length}; ${undecidable.length} left for a person`);
  if (ids.length > 0) await revalidateAndReport("conflicts", `hid ${ids.length} clashing listing(s)`, ids);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
