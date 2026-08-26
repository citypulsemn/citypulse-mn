/**
 * Hide listings whose title names no event (docs/SELF-CHECK.md).
 *
 * Usage: npm run hide-placeholders [-- --apply] [-- --backup=path.json]
 *
 * DRY RUN BY DEFAULT, like scripts/dedupe-flagged.ts and for the same reason:
 * this decides on a word list rather than a primary source, so it prints what it
 * would do and writes nothing until asked twice.
 *
 * NOT wired into the weekly workflow. The research pipeline keeps producing
 * these, so the tool is repeatable — but a word list should not be quietly
 * hiding listings every Monday without someone reading the list first.
 *
 * Hidden means `status = 'draft'`, not `archived`. A draft 404s; an archived
 * event page says "This event has already happened", which for a show that is
 * still to come would be a fresh falsehood in place of an empty one.
 */
import { writeFileSync } from "node:fs";
import { sql } from "../lib/db";
import { findPlaceholderTitles, type CalendarRow } from "../lib/contradictions";

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

  const flagged = findPlaceholderTitles([...rows]);
  if (!flagged.length) {
    console.log("[placeholders] nothing flagged — nothing to do");
    return;
  }

  // Does a REAL listing already cover that room that night? It doesn't change
  // the decision — a listing that names nothing is unusable either way — but it
  // is the difference between tidying a room that is covered and emptying a
  // night we have nothing else for, and the operator should see which is which.
  const flaggedIds = new Set(flagged.map((f) => f.id));
  const realBySlot = new Map<string, string[]>();
  for (const r of rows) {
    if (flaggedIds.has(r.id)) continue;
    const key = `${r.venue.toLowerCase()}|${r.start.slice(0, 10)}`;
    const list = realBySlot.get(key);
    if (list) list.push(r.title);
    else realBySlot.set(key, [r.title]);
  }

  let covered = 0;
  console.log(`[placeholders] ${flagged.length} listings name no event\n`);
  for (const f of flagged) {
    const also = realBySlot.get(`${f.venue.toLowerCase()}|${f.day}`) ?? [];
    if (also.length) covered++;
    console.log(`  ${f.day}  ${f.venue.slice(0, 30).padEnd(32)} "${f.title.slice(0, 46)}"`);
    console.log(
      `      ${f.reason === "explicit" ? "unfilled slot" : "names nothing"}` +
        (also.length
          ? ` · that room also has: ${also.slice(0, 2).map((t) => `"${t.slice(0, 38)}"`).join(", ")}`
          : " · NOTHING ELSE listed there that day"),
    );
  }

  console.log(
    `\n[placeholders] ${flagged.length} to hide — ${covered} where a real listing already covers the slot, ` +
      `${flagged.length - covered} where the day goes empty`,
  );
  if (!apply) {
    console.log("[placeholders] DRY RUN — nothing written. Re-run with --apply");
    return;
  }

  const backup = backupArg ? backupArg.slice("--backup=".length) : "placeholder-backup.json";
  writeFileSync(
    backup,
    JSON.stringify(
      flagged.map((f) => ({ ...f, from: "published", to: "draft" })),
      null,
      2,
    ),
  );
  console.log(`[placeholders] backup written: ${backup}`);

  const ids = flagged.map((f) => f.id);
  await sql`update events set status = 'draft' where id::text = any(${ids})`;
  for (const f of flagged) {
    const also = realBySlot.get(`${f.venue.toLowerCase()}|${f.day}`) ?? [];
    await sql`
      insert into admin_audit (action, event_id, patch)
      values ('hide_placeholder_title', ${f.id}::uuid,
              ${sql.json({
                status: "draft",
                reason: f.reason,
                why: "title names no event once venue, date and generic words are removed",
                slot_also_has: also.slice(0, 3),
              } as never)})
    `;
  }
  console.log(`[placeholders] hidden ${ids.length}`);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
