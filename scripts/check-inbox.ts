/**
 * THE INBOX: check what strangers sent us, then tell Taren once.
 *
 *   npm run inbox                 check and email
 *   npm run inbox -- --dry-run    check, print, write nothing, send nothing
 *
 * Replaces scripts/check-reports.ts, which did this for reports only. The
 * architecture it replaces had three problems:
 *
 *   1. A submission got NO check at all. It was inserted and sat until
 *      somebody noticed the count in Monday's ops digest — up to seven days —
 *      and then the research was done by hand. Two were handled that way in
 *      Sep 2026 and each took a quarter of an hour.
 *   2. Both kinds fired an instant "something arrived" email BEFORE anything
 *      was checked. That email could not say whether the thing was real, so
 *      it could not be acted on; it only said "go and look". Deleted.
 *   3. A report therefore produced two emails and a submission one useless
 *      one. Now each arrival produces one email, after the checking, with the
 *      answer and the buttons in it.
 *
 * Runs on the same half-hourly cron as before. Both queues are usually empty
 * — 2-3 submissions and 3-7 reports a month — and an empty inbox costs two
 * SELECTs, no model call and no row.
 */
import { sql } from "../lib/db";
import { recordRunSpend } from "../lib/model-spend";
import {
  getUncheckedReports,
  saveReportCheck,
  type UncheckedReportRow,
} from "../lib/event-reports";
import { getUncheckedSubmissions, saveSubmissionCheck } from "../lib/submissions";
import { checkReportedListings, checkSubmissions } from "../lib/agents/research-agent";
import {
  selectReportsToCheck,
  recommendationFor,
  verdictHeadline,
  type ReportCheckInput,
  type ReportCheckResult,
} from "../lib/report-check";
import { chiNow } from "../lib/clock";
import {
  hasExpired,
  recommendationForSubmission,
  submissionVerdictHeadline,
  type SubmissionCheckInput,
  type SubmissionCheckResult,
} from "../lib/submission-check";
import { sendInboxEmail, type ReportRow, type SubmissionRow } from "../lib/inbox-email";

const dryRun = process.argv.includes("--dry-run");
const LIMIT = 5;

function toReportInput(r: UncheckedReportRow): ReportCheckInput {
  return {
    reportId: r.id,
    eventId: r.event_id,
    title: r.event_title,
    venue: r.event_venue,
    city: r.event_city,
    start: r.event_start,
    sourceUrl: r.event_source_url,
    ticketUrl: r.event_ticket_url,
    kind: r.kind,
    reason: r.reason,
    evidenceUrl: r.evidence_url,
  };
}

async function main() {
  if (!sql) throw new Error("DATABASE_URL is required");

  const pendingSubs = await getUncheckedSubmissions(LIMIT);
  const pendingReports = await getUncheckedReports(LIMIT);
  console.log(
    `[inbox] ${pendingSubs.length} unchecked submission(s), ${pendingReports.length} unchecked report(s)` +
      `${dryRun ? " (DRY RUN)" : ""}`,
  );
  // The common case, by a long way. No key needed, no model call, no row.
  if (pendingSubs.length === 0 && pendingReports.length === 0) {
    return void (await sql.end({ timeout: 5 }));
  }

  // ── submissions ──────────────────────────────────────────────────────────
  // Already over? That is arithmetic on a date the submitter gave us, not a
  // question about the world, so it is settled here and costs nothing.
  // Drive2Compare arrived for 3 Oct and was reviewed on 4 Oct: the check spent
  // a search budget and came back "confirmed", correctly — the event was real.
  // Timeliness was never the question it was asked.
  const nowWall = chiNow();
  const expired = pendingSubs.filter((s) => hasExpired(s.start_local, s.end_local, nowWall));
  const liveSubs = pendingSubs.filter((s) => !hasExpired(s.start_local, s.end_local, nowWall));
  for (const s of expired) {
    console.log(`[inbox] EXPIRED       ${s.title} — ${s.start_local} is past, no check run`);
  }

  const subInputs: SubmissionCheckInput[] = liveSubs.map((s) => ({
    submissionId: s.id,
    title: s.title,
    venue: s.venue,
    city: s.city,
    address: s.address,
    start_local: s.start_local,
    end_local: s.end_local,
    price: s.price,
    ticket_url: s.ticket_url,
    source_url: s.source_url,
    description: s.description,
  }));
  for (const s of subInputs) console.log(`[inbox] submission · ${s.title} @ ${s.venue}`);

  // Only needed once something actually reaches the model. An inbox holding
  // nothing but expired submissions must not fail for want of a key.
  if ((subInputs.length > 0 || pendingReports.length > 0) && !process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is required");
  }

  // Recorded as a verdict so they leave the unchecked queue and are never paid
  // for again. NOT auto-rejected: a mistyped year is the one way this is
  // wrong, and binning a real event over it would be the expensive direction.
  let subResults: SubmissionCheckResult[] = expired.map((s) => ({
    submissionId: s.id,
    verdict: "expired" as const,
    note: `Starts ${s.start_local}, which is past. No source check was run.`,
  }));
  if (subInputs.length > 0) {
    try {
      subResults = await checkSubmissions(subInputs);
    } catch (err) {
      console.error("[inbox] the submission check failed:", err);
    }
  }
  // Rule 6: a submission the model said nothing about is recorded as an error
  // rather than left unchecked, or it is picked up and paid for every run.
  const subAnswered = new Set(subResults.map((r) => r.submissionId));
  for (const s of subInputs) {
    if (!subAnswered.has(s.submissionId)) {
      subResults.push({
        submissionId: s.submissionId,
        verdict: "error",
        note: "The check returned no verdict for this submission.",
      });
    }
  }

  // ── reports ──────────────────────────────────────────────────────────────
  const repBatch = selectReportsToCheck(pendingReports.map(toReportInput), LIMIT);
  for (const b of repBatch) console.log(`[inbox] report · ${b.title} @ ${b.venue} — "${b.reason.slice(0, 70)}"`);

  let repResults: ReportCheckResult[] = [];
  if (repBatch.length > 0) {
    try {
      repResults = await checkReportedListings(repBatch);
    } catch (err) {
      console.error("[inbox] the report check failed:", err);
    }
  }
  const repAnswered = new Set(repResults.map((r) => r.reportId));
  for (const b of repBatch) {
    if (!repAnswered.has(b.reportId)) {
      repResults.push({
        reportId: b.reportId,
        verdict: "error",
        note: "The check returned no verdict for this report.",
      });
    }
  }

  // ── save, then say ───────────────────────────────────────────────────────
  const subById = new Map(pendingSubs.map((s) => [s.id, s]));
  for (const r of subResults) {
    const row = subById.get(r.submissionId);
    console.log(
      `[inbox] ${r.verdict.toUpperCase().padEnd(13)} ${row ? row.title : r.submissionId}\n` +
        `                 ${submissionVerdictHeadline(r.verdict)}${r.note ? ` ${r.note}` : ""}` +
        `${r.corrections ? `\n                 corrections: ${Object.keys(r.corrections).join(", ")}` : ""}` +
        `\n                 → ${recommendationForSubmission(r.verdict)}`,
    );
    if (!dryRun) {
      await saveSubmissionCheck(
        r.submissionId,
        r.verdict,
        r.note ?? null,
        r.evidence ?? null,
        (r.corrections ?? null) as Record<string, string> | null,
      );
    }
  }

  const repById = new Map(pendingReports.map((p) => [p.id, p]));
  for (const r of repResults) {
    const row = repById.get(r.reportId);
    console.log(
      `[inbox] ${r.verdict.toUpperCase().padEnd(13)} ${row ? `${row.event_title} @ ${row.event_venue}` : r.reportId}\n` +
        `                 ${verdictHeadline(r.verdict)}${r.note ? ` ${r.note}` : ""}` +
        `\n                 → ${recommendationFor(r.verdict)}`,
    );
    if (!dryRun) await saveReportCheck(r.reportId, r.verdict, r.note ?? null, r.evidence ?? null);
  }

  if (dryRun) {
    console.log("[inbox] dry run — nothing written, no email sent.");
    return void (await sql.end({ timeout: 5 }));
  }

  const subRows = subResults.flatMap<SubmissionRow>((result) => {
    const row = subById.get(result.submissionId);
    return row ? [{ result, row }] : [];
  });
  const repRows = repResults.flatMap<ReportRow>((result) => {
    const row = repById.get(result.reportId);
    return row ? [{ result, row }] : [];
  });

  const sent = await sendInboxEmail(subRows, repRows);
  if (sent) {
    console.log("[inbox] email sent");
  } else {
    // FAIL THE JOB. On 9 Sep 2026 the report version of this printed a warning,
    // exited 0 and showed green in Actions while a reader-reported wrong
    // listing sat unmentioned. A delivery channel that cannot deliver is an
    // outage, not a log line — and now that the instant ping is gone, this is
    // the ONLY email these items will ever produce. The checks are already
    // saved above, so failing here loses nothing and re-running is safe.
    console.error(
      `[inbox] ⚠ email NOT sent — see the cause above. ` +
        `${subRows.length + repRows.length} checked item(s) are saved but nobody has been told.`,
    );
    process.exitCode = 1;
  }

  await sql.end({ timeout: 5 });
}

main()
  .catch((err) => {
    console.error("[inbox] fatal:", err);
    process.exitCode = 1;
  })
  // Recorded whether the run finished or died: the calls were already paid for.
  .finally(() => recordRunSpend("check-reports", "inbox: submissions + reports"));
