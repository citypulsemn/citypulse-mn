/**
 * Apply a verify flag's answer to a live listing.
 *
 *   npm run correct -- --from=corrections.json                  dry run (default)
 *   npm run correct -- --from=corrections.json --apply --backup=before.json
 *
 * Reads a JSON array of corrections — see lib/corrections.ts for the shape — and
 * applies each one with the three things a hand-written UPDATE keeps forgetting:
 *
 *   1. event_key is recomputed when title/venue/day change, so the next pipeline
 *      run matches the row instead of inserting a duplicate beside it.
 *   2. THE KEY IS CHECKED FOR A COLLISION FIRST, against every status. The key is
 *      unique repo-wide, so a "move this date" correction can land on an
 *      identity that already belongs to another row — including an archived one
 *      nobody can see. That correction is refused with the offending row named.
 *   3. Coordinates move with the venue. `admin-actions.ts updateEvent` cannot
 *      change lat/lng, so a room change made there leaves the pin behind.
 *
 * Reads-by-default, writes on --apply: the house convention for anything bulk or
 * destructive (check-sources, dedupe-flagged, hide-placeholders).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { sql } from "../lib/db";
import { revalidateAndReport } from "../lib/revalidate-client";
import {
  planCorrection,
  describePlan,
  validateCorrection,
  type Correction,
  type CorrectionRow,
} from "../lib/corrections";

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const apply = process.argv.includes("--apply");

// `npm run correct --from=x.json` without the bare `--` arrives as NO arguments,
// which would otherwise read as "nothing to do" and exit 0 looking successful.
for (const [flag, envKey] of [
  ["--from", "npm_config_from"],
  ["--backup", "npm_config_backup"],
  ["--apply", "npm_config_apply"],
] as const) {
  if (process.env[envKey] && !process.argv.some((a) => a.startsWith(flag))) {
    console.error(`[correct] ✗ npm swallowed ${flag}. Use: npm run correct -- ${flag}=...`);
    process.exit(2);
  }
}

async function main() {
  const from = arg("from");
  if (!from) {
    console.error("[correct] ✗ --from=<file>.json is required");
    process.exit(2);
  }
  if (!sql) throw new Error("DATABASE_URL is required");

  const parsed: unknown = JSON.parse(readFileSync(from, "utf8"));
  const corrections: Correction[] = Array.isArray(parsed) ? parsed : [parsed as Correction];

  let refused = 0;
  const bad = corrections.flatMap((c) => {
    const why = validateCorrection(c);
    return why ? [{ id: c.id ?? "(no id)", why }] : [];
  });
  for (const b of bad) console.error(`[correct] ✗ ${b.id} — ${b.why}`);
  refused += bad.length;
  const usable = corrections.filter((c) => validateCorrection(c) === null);
  if (usable.length === 0) {
    console.error("[correct] nothing usable in that file.");
    process.exitCode = 1;
    return void (await sql.end({ timeout: 5 }));
  }

  const rows = await sql<CorrectionRow[]>`
    select id::text as id, event_key, title, venue, city, address,
           to_char(start_at at time zone 'America/Chicago', 'YYYY-MM-DD"T"HH24:MI') as start_local,
           to_char(end_at   at time zone 'America/Chicago', 'YYYY-MM-DD"T"HH24:MI') as end_local,
           lat::float as lat, lng::float as lng, status
    from events where id::text = any(${usable.map((c) => c.id)})
  `;
  const byId = new Map(rows.map((r) => [r.id, r]));

  if (arg("backup")) {
    writeFileSync(arg("backup")!, JSON.stringify(rows, null, 1));
    console.log(`[correct] backed up ${rows.length} row(s) to ${arg("backup")}`);
  }

  const touched: string[] = [];
  for (const c of usable) {
    const row = byId.get(c.id);
    if (!row) {
      console.error(`[correct] ✗ ${c.id} — no such event`);
      refused++;
      continue;
    }
    const plan = planCorrection(row, c);
    for (const line of describePlan(plan, row)) console.log(`[correct] ${line}`);
    if (plan.kind === "nothing") continue;

    // THE COLLISION CHECK. Across every status, because the unique index is.
    if (plan.kind === "edit" && plan.newKey) {
      const clash = await sql<{ id: string; title: string; status: string; starts: string }[]>`
        select id::text as id, title, status,
               to_char(start_at at time zone 'America/Chicago', 'YYYY-MM-DD') as starts
        from events where event_key = ${plan.newKey} and id::text <> ${c.id}
        limit 1
      `;
      if (clash.length > 0) {
        const o = clash[0];
        console.error(
          `[correct] ✗ REFUSED ${row.title.slice(0, 40)} — the new identity already belongs to\n` +
            `             "${o.title.slice(0, 50)}" (${o.starts}, ${o.status}, id ${o.id}).\n` +
            `             These are the same event. Archive one instead of moving the other.`,
        );
        refused++;
        continue;
      }
    }

    if (!apply) continue;

    if (plan.kind === "archive") {
      await sql`update events set status = 'archived', updated_at = now() where id::text = ${c.id}`;
    } else {
      const f = plan.fields;
      // THREE OUTCOMES for verified_at, not two:
      //   - the change touches nothing the pass checks (a pin, an address
      //     spelling) -> LEAVE THE STAMP ALONE. Clearing it would re-queue the
      //     row to re-establish a fact the correction never touched.
      //   - it touches title/venue/city/date and "verified" is set (only
      //     allowed alongside a cited page) -> stamp now: the correction IS the
      //     verification.
      //   - it touches those and nothing was cited -> clear it. A stamp left on
      //     a row whose date just changed claims a source vouched for the new
      //     date, when the source is why it changed.
      //
      // Keep prose OUT of the template below. A backtick in a SQL comment
      // terminates the JS template literal, which is how this line first broke.
      const stamp = !plan.affectsVerification
        ? sql`verified_at`
        : c.verified
          ? sql`now()`
          : sql`null`;
      await sql`
        update events set
          event_key  = ${plan.newKey ?? row.event_key},
          title      = ${f.title ?? row.title},
          venue      = ${f.venue ?? row.venue},
          city       = ${f.city ?? row.city},
          address    = ${f.address ?? row.address},
          lat        = ${f.lat ?? row.lat},
          lng        = ${f.lng ?? row.lng},
          start_at   = (${(f.start_local ?? row.start_local) as string}::text::timestamp at time zone 'America/Chicago'),
          end_at     = ${
            (f.end_local ?? row.end_local) === null
              ? null
              : sql`(${(f.end_local ?? row.end_local) as string}::text::timestamp at time zone 'America/Chicago')`
          },
          verified_at = ${stamp},
          updated_at  = now()
        where id::text = ${c.id}
      `;
    }
    await sql`
      insert into admin_audit (action, event_id, patch)
      values ('correction', ${c.id}::uuid, ${sql.json({
        kind: plan.kind,
        why: c.why.slice(0, 300),
        evidence: (c.evidence ?? "").slice(0, 300),
        changed: plan.kind === "edit" ? plan.changed : undefined,
        keyRewritten: plan.kind === "edit" ? Boolean(plan.newKey) : undefined,
      })})
    `;
    touched.push(c.id);
  }

  console.log(
    `\n[correct] ${touched.length} applied, ${refused} refused, ` +
      `${usable.length - touched.length - refused} unchanged${apply ? "" : " — DRY RUN, re-run with --apply"}`,
  );

  if (apply && touched.length > 0) {
    await revalidateAndReport("correct", `${touched.length} listing(s) corrected`, touched);
  }
  if (refused > 0) process.exitCode = 1;
  await sql.end({ timeout: 5 });
}

main().catch((err) => {
  console.error("[correct] fatal:", err);
  process.exitCode = 1;
});
