import { sql } from "../lib/db";
import { findContradictions, type CalendarRow } from "../lib/contradictions";
async function main() {
  if (!sql) return;
  const rows = await sql<(CalendarRow & { src: string })[]>`
    select id::text as id, venue, title, category, (verified_at is not null) as verified,
           coalesce(source_url,'') as src,
           to_char(start_at at time zone 'America/Chicago','YYYY-MM-DD"T"HH24:MI') as start
    from events where status='published' and start_at >= now()`;
  const byId = new Map(rows.map((r) => [r.id, r]));
  const { conflicts } = findContradictions(rows.map((r) => ({ ...r })));
  console.log(`CONFLICTS (${conflicts.length})\n`);
  let oneSided = 0, neither = 0;
  for (const c of conflicts) {
    const a = byId.get(c.a.id)!, b = byId.get(c.b.id)!;
    const mark = a.verified !== b.verified ? "ONE-SIDED" : a.verified ? "both-ok  " : "neither  ";
    if (a.verified !== b.verified) oneSided++; else if (!a.verified) neither++;
    console.log(`  [${mark}] ${c.day} ${c.venue.slice(0,28)}`);
    console.log(`      ${a.verified ? "✓verified" : " unverif "} ${a.start.slice(11)} ${a.title.slice(0,50)}`);
    console.log(`      ${b.verified ? "✓verified" : " unverif "} ${b.start.slice(11)} ${b.title.slice(0,50)}`);
  }
  console.log(`\n  one side verified: ${oneSided} · neither verified: ${neither}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
