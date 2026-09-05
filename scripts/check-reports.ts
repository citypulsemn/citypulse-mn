/**
 * Check pending reader reports against the venue's own calendar, then email the
 * verdict with one-tap Take-it-down / Keep buttons.
 *
 *   npm run check-reports                 check, save, email
 *   npm run check-reports -- --dry-run    check and print; write nothing, send nothing
 *   npm run check-reports -- --limit=3    smaller batch
 *
 * Why this exists: on 5 Sep 2026 a reader reported that our Damian Marley
 * listing at The Fillmore was wrong. It was — the venue had Masego that night,
 * Live Nation had no Marley dates at all, and the article we cited never
 * mentioned the Marleys. The listing was live, and the report sat in a queue as
 * a plain sentence waiting for someone to read it.
 *
 * Where this sits: the instant "a report came in" ping (lib/notify-send.ts) is
 * unchanged and still fires the moment someone submits. This is the second
 * email — the one that says whether they were right and lets Taren settle it in
 * one tap. The weekly ops digest carries the same verdicts as the backstop.
 */
import { sql } from "../lib/db";
import {
  getUncheckedReports,
  saveReportCheck,
  type UncheckedReportRow,
} from "../lib/event-reports";
import { checkReportedListings } from "../lib/agents/research-agent";
import {
  selectReportsToCheck,
  recommendationFor,
  verdictHeadline,
  type ReportCheckInput,
  type ReportCheckResult,
} from "../lib/report-check";
import { sendReportVerdictEmail } from "../lib/report-verdict-email";
import type { ReportKind } from "../lib/report-types";

const dryRun = process.argv.includes("--dry-run");
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? Math.max(1, Number(limitArg.slice(8)) || 12) : 12;

function toInput(r: UncheckedReportRow): ReportCheckInput {
  return {
    reportId: r.id,
    eventId: r.event_id,
    title: r.event_title,
    venue: r.event_venue,
    city: r.event_city,
    start: r.event_start,
    sourceUrl: r.event_source_url,
    ticketUrl: r.event_ticket_url,
    kind: r.kind as ReportKind,
    reason: r.reason,
    evidenceUrl: r.evidence_url,
  };
}

async function main() {
  if (!sql) throw new Error("DATABASE_URL is required");

  const pending = await getUncheckedReports(LIMIT);
  console.log(`[check-reports] ${pending.length} unchecked report(s)${dryRun ? " (DRY RUN)" : ""}`);
  if (pending.length === 0) return void (await sql.end({ timeout: 5 }));

  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is required");

  const batch = selectReportsToCheck(pending.map(toInput), LIMIT);
  for (const b of batch) {
    console.log(`[check-reports] · ${b.title} @ ${b.venue} — "${b.reason.slice(0, 70)}"`);
  }

  let results: ReportCheckResult[] = [];
  try {
    results = await checkReportedListings(batch);
  } catch (err) {
    console.error("[check-reports] the check failed:", err);
  }

  // Rule 6, honest emptiness: a report the model said nothing about is recorded
  // as an error rather than silently left unchecked, or it would be picked up
  // and paid for again on every run.
  const answered = new Set(results.map((r) => r.reportId));
  for (const b of batch) {
    if (!answered.has(b.reportId)) {
      results.push({
        reportId: b.reportId,
        verdict: "error",
        note: "The check returned no verdict for this report.",
      });
    }
  }

  const byId = new Map(pending.map((p) => [p.id, p]));
  for (const r of results) {
    const row = byId.get(r.reportId);
    const label = row ? `${row.event_title} @ ${row.event_venue}` : r.reportId;
    console.log(
      `[check-reports] ${r.verdict.toUpperCase().padEnd(12)} ${label}\n` +
        `                 ${verdictHeadline(r.verdict)}${r.note ? ` ${r.note}` : ""}` +
        `${r.evidence ? `\n                 evidence: ${r.evidence}` : ""}` +
        `\n                 → ${recommendationFor(r.verdict)}`,
    );
    if (!dryRun) {
      await saveReportCheck(r.reportId, r.verdict, r.note ?? null, r.evidence ?? null);
    }
  }

  if (dryRun) {
    console.log("[check-reports] dry run — nothing written, no email sent.");
    return void (await sql.end({ timeout: 5 }));
  }

  // Rule 1: the verdicts are saved above and the digest carries them regardless.
  // A mail failure must not fail this job.
  const rows = results
    .map((r) => ({ result: r, row: byId.get(r.reportId) }))
    .filter((x): x is { result: ReportCheckResult; row: UncheckedReportRow } => Boolean(x.row));
  const sent = await sendReportVerdictEmail(rows);
  console.log(sent ? "[check-reports] verdict email sent" : "[check-reports] ⚠ verdict email not sent (see above)");

  await sql.end({ timeout: 5 });
}

main().catch((err) => {
  console.error("[check-reports] fatal:", err);
  process.exitCode = 1;
});
