/**
 * Collapse the duplicate pairs the self-check finds (docs/SELF-CHECK.md).
 *
 * Usage: npm run dedupe-flagged [-- --apply]
 *
 * DRY RUN BY DEFAULT — the opposite of the importers, because this one archives
 * rows on the strength of a fuzzy title match rather than a primary source. It
 * prints exactly what it would keep and what it would archive, and writes
 * nothing until you ask twice.
 *
 * Nothing is deleted. Losers become `status = 'archived'`, reversible from the
 * Events tab, each with an `admin_audit` row naming the row that survived.
 */
import { writeFileSync } from "node:fs";
import { sql } from "../lib/db";
import { findContradictions, type CalendarRow } from "../lib/contradictions";
import { foldTitle } from "../lib/canonicalize";

const apply = process.argv.includes("--apply");
const backupArg = process.argv.find((a) => a.startsWith("--backup="));

interface Row extends CalendarRow {
  created: string;
  richness: number;
}

/**
 * How much a title actually tells a reader, in meaningful words.
 *
 * Needed because field-count richness is a near-useless tiebreaker here — every
 * one of these rows scores 5 — and falling straight through to creation order
 * picks arbitrarily. Arbitrary is fine when the copies are equivalent and bad
 * when they aren't: it kept "Bleachers" over "Bleachers with This Is Lorelei",
 * and kept a support-act billing over "Underoath – Define the Great Line 20th
 * Anniversary Tour". The reader loses information either time.
 */
function informativeness(title: string): number {
  return new Set(
    foldTitle(title)
      .split(" ")
      .filter((t) => t.length > 2),
  ).size;
}

/**
 * Which copy survives, in order:
 *   1. the one confirmed against a primary source — evidence beats everything;
 *   2. the RICHER one (more populated fields), matching lib/upsert.ts;
 *   3. the more INFORMATIVE title (see above);
 *   4. the earliest created, so the choice is stable across runs and a re-run
 *      can't oscillate between two equally good rows.
 */
function pickKeeper(rows: Row[]): Row {
  return [...rows].sort(
    (a, b) =>
      Number(b.verified ?? false) - Number(a.verified ?? false) ||
      b.richness - a.richness ||
      informativeness(b.title) - informativeness(a.title) ||
      a.created.localeCompare(b.created) ||
      a.id.localeCompare(b.id),
  )[0];
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  if (!sql) throw new Error("no database connection");

  const rows = await sql<Row[]>`
    select id::text as id, venue, title, category,
           (verified_at is not null) as verified,
           to_char(start_at at time zone 'America/Chicago', 'YYYY-MM-DD"T"HH24:MI') as start,
           to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') as created,
           ((description <> '')::int + (ticket_url <> '')::int + (image <> '')::int
            + (address <> '')::int + (end_at is not null)::int + (source_url <> '')::int) as richness
    from events
    where status = 'published' and start_at >= now()`;

  const byId = new Map(rows.map((r) => [r.id, r]));
  const { duplicates } = findContradictions([...rows]);
  if (!duplicates.length) {
    console.log("[dedupe] nothing flagged as a duplicate — nothing to do");
    return;
  }

  // A pair is an edge; collapse the graph so a cluster of three titles for one
  // event (Valleyfair lists its Halloween day three ways) resolves to a single
  // keeper rather than to three pairwise decisions that contradict each other.
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    const p = parent.get(x);
    if (!p || p === x) return x;
    const root = find(p);
    parent.set(x, root);
    return root;
  };
  const union = (x: string, y: string) => {
    parent.set(find(x), find(y));
  };
  for (const d of duplicates) {
    if (!parent.has(d.a.id)) parent.set(d.a.id, d.a.id);
    if (!parent.has(d.b.id)) parent.set(d.b.id, d.b.id);
    union(d.a.id, d.b.id);
  }

  const clusters = new Map<string, Row[]>();
  for (const id of parent.keys()) {
    const row = byId.get(id);
    if (!row) continue;
    const root = find(id);
    const list = clusters.get(root);
    if (list) list.push(row);
    else clusters.set(root, [row]);
  }

  const archive: { row: Row; keeper: Row }[] = [];
  console.log(`[dedupe] ${duplicates.length} flagged pairs → ${clusters.size} clusters\n`);
  for (const list of [...clusters.values()].sort((a, b) => a[0].start.localeCompare(b[0].start))) {
    const keeper = pickKeeper(list);
    const why = keeper.verified
      ? "source-verified"
      : `richest ${keeper.richness}, ${informativeness(keeper.title)} words`;
    console.log(`  ${keeper.start.slice(0, 10)} ${keeper.venue.slice(0, 30)}`);
    console.log(`      KEEP     ${keeper.title.slice(0, 58)}  (${why})`);
    for (const r of list) {
      if (r.id === keeper.id) continue;
      console.log(`      archive  ${r.title.slice(0, 58)}`);
      archive.push({ row: r, keeper });
    }
  }

  console.log(`\n[dedupe] ${archive.length} rows to archive, ${clusters.size} kept`);
  if (!apply) {
    console.log("[dedupe] DRY RUN — nothing written. Re-run with --apply");
    return;
  }

  // Back up before a bulk status change (a standing product rule). id + prior
  // status is the whole of what changes, so this is a complete undo.
  const backup = backupArg
    ? backupArg.slice("--backup=".length)
    : "dedupe-backup.json";
  writeFileSync(
    backup,
    JSON.stringify(
      archive.map(({ row, keeper }) => ({
        id: row.id, title: row.title, venue: row.venue, start: row.start,
        from: "published", to: "archived", keptInstead: keeper.id,
      })),
      null,
      2,
    ),
  );
  console.log(`[dedupe] backup written: ${backup}`);

  const ids = archive.map((a) => a.row.id);
  await sql`update events set status = 'archived' where id::text = any(${ids})`;
  for (const { row, keeper } of archive) {
    await sql`
      insert into admin_audit (action, event_id, patch)
      values ('dedupe_flagged', ${row.id}::uuid,
              ${sql.json({
                status: "archived",
                why: "duplicate of another listing at the same venue and time",
                kept_id: keeper.id,
                kept_title: keeper.title.slice(0, 200),
              } as never)})
    `;
  }
  console.log(`[dedupe] archived ${ids.length}`);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
