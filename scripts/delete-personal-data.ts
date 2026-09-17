/**
 * Honour a deletion request.
 *
 *   npx tsx scripts/delete-personal-data.ts --email=someone@example.com
 *   npx tsx scripts/delete-personal-data.ts --email=someone@example.com --apply
 *
 * `/privacy` tells readers "write to us and we'll delete it". This is the code
 * behind that sentence. Before 17 Sep 2026 there was none: honouring a request
 * meant hand-writing SQL against production from memory.
 *
 * DRY RUN BY DEFAULT. It prints exactly what it found, per table, including the
 * tables where it found nothing — "subscribers 0" is the useful half of the
 * answer when someone asks whether you still hold their address.
 *
 * WHAT IT DELIBERATELY DOES NOT DO:
 *   - It does not archive. Everywhere else in this project deletion is refused
 *     in favour of `status='archived'`, because an event is a record. Personal
 *     data is the opposite: a request to delete is not honoured by moving the
 *     row somewhere quieter.
 *   - It does not write the address into the audit row. That would leave the
 *     data in the database under another name. A salted 12-character reference
 *     goes in instead, which ties to the original request only for someone who
 *     still has that email in their inbox.
 */
import { requireSql } from "../lib/db";
import { envOr } from "../lib/env";
import {
  normalizeRequestEmail,
  requestReference,
  describePlan,
  totalRows,
  type DeletionCount,
} from "../lib/data-deletion";

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=")[1];
const APPLY = process.argv.includes("--apply");

async function main() {
  const email = normalizeRequestEmail(arg("email"));
  if (!email) {
    console.error(
      "[delete] --email= must be ONE valid address.\n" +
        "         Blank is refused on purpose: submitter_email and reporter_email\n" +
        "         default to '', so a blank request would match every anonymous\n" +
        "         submission and report in the database.",
    );
    process.exit(1);
  }

  const sql = requireSql();

  // The bridge from an email to that browser's saved events. Read BEFORE
  // anything is cut, or the saves become unreachable and stay behind.
  const [sub] = await sql<{ saver_token: string | null }[]>`
    select saver_token from subscribers where lower(email) = ${email}`;
  const token = sub?.saver_token ?? null;

  const count = async (q: Promise<{ n: number }[]>) => (await q)[0]?.n ?? 0;
  const counts: DeletionCount[] = [
    {
      table: "saved_events",
      rows: token
        ? await count(sql<{ n: number }[]>`select count(*)::int n from saved_events where user_token = ${token}`)
        : 0,
      what: token ? "events saved in their browser" : "no saver token on file — nothing linkable",
    },
    {
      table: "subscribers",
      rows: await count(sql<{ n: number }[]>`select count(*)::int n from subscribers where lower(email) = ${email}`),
      what: "the subscription and its saver token",
    },
    {
      table: "event_submissions",
      rows: await count(sql<{ n: number }[]>`select count(*)::int n from event_submissions where lower(submitter_email) = ${email}`),
      what: "events they submitted",
    },
    {
      table: "event_reports",
      rows: await count(sql<{ n: number }[]>`select count(*)::int n from event_reports where lower(reporter_email) = ${email}`),
      what: "listing reports they sent",
    },
  ];

  console.log(describePlan(email, counts));

  if (!APPLY) {
    console.log("\nDRY RUN — nothing was deleted. Re-run with --apply to honour the request.");
    await sql.end({ timeout: 5 });
    return;
  }
  if (totalRows(counts) === 0) {
    console.log("\nNothing to delete; no audit row written.");
    await sql.end({ timeout: 5 });
    return;
  }

  if (token) await sql`delete from saved_events where user_token = ${token}`;
  await sql`delete from subscribers where lower(email) = ${email}`;
  // Submissions and reports are cleared of the PERSON, not of the record: the
  // listing they sent is site content and may already be published. Blanking
  // the address back to the table's own default leaves the submission intact
  // and holds nothing about who sent it.
  await sql`update event_submissions set submitter_email = '' where lower(submitter_email) = ${email}`;
  await sql`update event_reports set reporter_email = '' where lower(reporter_email) = ${email}`;

  const ref = requestReference(email, envOr("citypulse", "UNSUBSCRIBE_SECRET"));
  await sql`
    insert into admin_audit (action, patch)
    values ('privacy:deletion', ${sql.json({
      request: ref,
      removed: Object.fromEntries(counts.map((c) => [c.table, c.rows])),
      note: "personal data deleted on request; the address itself is deliberately not recorded here",
    })})`;

  console.log(`\nDone. ${totalRows(counts)} row(s) removed. Audit reference: ${ref}`);
  console.log("Reply to them from the original email — that reference ties to it, and nothing else does.");
  await sql.end({ timeout: 5 });
}

main().catch((err) => {
  console.error("[delete] fatal:", err);
  process.exitCode = 1;
});
