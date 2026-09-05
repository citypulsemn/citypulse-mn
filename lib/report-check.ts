import type { ReportKind } from "./report-types";

/**
 * AUTOMATED CHECK ON REPORTED LISTINGS (Sep 2026).
 *
 * Origin, 5 Sep 2026: a reader reported "The show is wrong. Masego tonight at
 * Fillmore" against our listing for *Damian 'Jr. Gong' Marley & Stephen Marley*
 * at The Fillmore Minneapolis. They were right on every count:
 *
 *   - the Fillmore's own calendar had Masego — Fix Your Face Tour that night;
 *   - Live Nation showed NO upcoming Damian Marley dates anywhere;
 *   - the exploreminnesota article we cited as the source lists Isaiah Rashad,
 *     Digable Planets and Thundercat at that venue and never mentions the
 *     Marleys at all.
 *
 * The listing was invented, it was published, and the freshness verify pass had
 * stamped it `verified_at` two days before. It sat in the queue as a plain
 * sentence until a human read it.
 *
 * This module is the check that now runs first. The verdict is about the
 * REPORTER'S CLAIM, never about the listing directly — that distinction is what
 * keeps a "can't find anything" result from reading as "the reporter is wrong".
 */

export const CHECK_VERDICTS = ["supported", "contradicted", "unclear", "error"] as const;
export type CheckVerdict = (typeof CHECK_VERDICTS)[number];

/** What the operator should probably do. Advice for the email, never applied. */
export type Recommendation = "take-it-down" | "keep-it" | "needs-a-human";

export interface ReportCheckInput {
  reportId: string;
  eventId: string;
  title: string;
  venue: string;
  city: string;
  /** Chicago wall clock, "YYYY-MM-DD HH:MM". */
  start: string;
  sourceUrl: string;
  ticketUrl: string;
  kind: ReportKind;
  /** The reader's own words. Public input — never interpolated into HTML raw. */
  reason: string;
  evidenceUrl: string;
}

export interface ReportCheckResult {
  reportId: string;
  verdict: CheckVerdict;
  /** Where the answer came from: a URL, or the exact wording seen. */
  evidence?: string;
  /** One sentence a human can read without opening anything. */
  note?: string;
}

/**
 * The recommendation each verdict carries.
 *
 * `unclear` deliberately does NOT recommend taking a listing down. A page that
 * cannot be found is not evidence that an event is fake — that is the same
 * asymmetry `lib/verify.ts` enforces for cancellations, and for the same reason:
 * a false removal deletes a real event and nobody ever reports THAT.
 */
export function recommendationFor(v: CheckVerdict): Recommendation {
  switch (v) {
    case "supported":
      return "take-it-down";
    case "contradicted":
      return "keep-it";
    case "unclear":
    case "error":
      return "needs-a-human";
  }
}

/** Human-readable one-liner for the email, per verdict. */
export function verdictHeadline(v: CheckVerdict): string {
  switch (v) {
    case "supported":
      return "The check agrees with the reporter — the listing looks wrong.";
    case "contradicted":
      return "The check disagrees with the reporter — the listing looks right.";
    case "unclear":
      return "The check could not settle it either way.";
    case "error":
      return "The check could not run.";
  }
}

/**
 * The prompt. Two things in here are load-bearing and both come from the Marley
 * incident:
 *
 * 1. THE VENUE'S OWN CALENDAR IS THE AUTHORITY. The freshness pass asks only
 *    whether an event "still appears as scheduled" against its own source — and
 *    when that source is a roundup article that never mentioned the event, the
 *    honest answer to that question is uninformative, yet it came back
 *    "confirmed". Asking what the venue itself lists THAT NIGHT is a different
 *    question, and it is the one that catches an invented booking.
 *
 * 2. NAME WHAT IS ACTUALLY ON. If the room has a different act that night, say
 *    which — that single fact is what let a human settle this in one read.
 */
export function buildReportCheckPrompt(items: ReportCheckInput[]): string {
  const list = items
    .map((r) => {
      const src = [r.sourceUrl, r.ticketUrl].filter(Boolean).join(" | ") || "(none on file)";
      const ev = r.evidenceUrl ? `\n  reader's evidence: ${r.evidenceUrl}` : "";
      return `- id: ${r.reportId}
  listing: ${r.title} @ ${r.venue}, ${r.city} — ${r.start}
  we cite: ${src}
  reader says (${r.kind}): ${r.reason.replace(/\s+/g, " ").trim()}${ev}`;
    })
    .join("\n");

  return `You are checking READER REPORTS for City Pulse MN, a Twin Cities events calendar. A reader has told us something is wrong with each listing below. Your job is to find out whether the reader is right.

${list}

HOW TO CHECK, in this order:
1. Look at the VENUE'S OWN CALENDAR for that date — the venue's website, or its official ticketing page. What does the venue itself say is happening in that room that night? This is the authority and it outranks everything else.
2. Check whether the artist or event is on tour / scheduled at all near that date.
3. Only then consider the source we cite. A roundup article is NOT a schedule, and if it does not actually name this event, say so — that alone is important.

For EACH report, decide exactly one verdict about THE READER'S CLAIM:
- "supported"    — the evidence backs the reader. Our listing looks wrong.
- "contradicted" — the evidence backs OUR listing. The reader appears mistaken.
- "unclear"      — you could not settle it. A page you cannot find is NOT evidence that an event is fake; prefer this verdict over guessing.

Rules:
- "evidence" is REQUIRED for "supported" and "contradicted": the URL you relied on, or the exact wording you saw. Never assert without it.
- If the venue lists a DIFFERENT act that night, name that act in your note. That one fact usually settles it.
- If our cited source does not mention this event at all, say that in your note.
- Be conservative. When torn, choose "unclear" and let a human look.

Output ONLY a JSON array inside a single \`\`\`json code block:
[{"id": "...", "verdict": "supported", "evidence": "https://…", "note": "The Fillmore's calendar lists Masego that night."}]`;
}

/**
 * Parse the agent's verdict block. Unknown ids and unknown verdicts are dropped
 * rather than coerced — a malformed answer must not become a decision.
 */
export function parseReportChecks(text: string, validIds: Set<string>): ReportCheckResult[] {
  const match = text.match(/```json\s*([\s\S]*?)```/);
  const raw = match ? match[1] : text;
  let arr: unknown;
  try {
    arr = JSON.parse(raw.trim());
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];

  const out: ReportCheckResult[] = [];
  const seen = new Set<string>();
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id : "";
    const verdict = o.verdict as CheckVerdict;
    if (!validIds.has(id) || seen.has(id)) continue;
    if (verdict !== "supported" && verdict !== "contradicted" && verdict !== "unclear") continue;

    const evidence = typeof o.evidence === "string" ? o.evidence.trim() : "";
    const note = typeof o.note === "string" ? o.note.trim() : "";

    // Evidence is required for a decisive verdict. Without it the model is
    // asserting, and an assertion is exactly what put the Marley listing on the
    // site in the first place. Downgrade rather than discard, so the note the
    // model did write still reaches a human.
    if ((verdict === "supported" || verdict === "contradicted") && evidence.length === 0) {
      seen.add(id);
      out.push({
        reportId: id,
        verdict: "unclear",
        note: note
          ? `${note} (downgraded: no evidence given)`
          : "Verdict given without evidence — downgraded for a human to look.",
      });
      continue;
    }

    seen.add(id);
    out.push({
      reportId: id,
      verdict,
      evidence: evidence || undefined,
      note: note || undefined,
    });
  }
  return out;
}

/**
 * Which reports to check, and how many. Oldest first — a report that has been
 * waiting is the one most likely to be about an event that has since happened.
 */
export function selectReportsToCheck<T extends { reportId: string }>(
  pending: T[],
  cap = 12,
): T[] {
  return pending.slice(0, Math.max(0, cap));
}

/** Compact line for the digest / the email body. */
export function formatCheckLine(r: {
  verdict: CheckVerdict;
  note?: string | null;
  evidence?: string | null;
}): string {
  const bits = [verdictHeadline(r.verdict)];
  if (r.note) bits.push(r.note);
  if (r.evidence) bits.push(`Evidence: ${r.evidence}`);
  return bits.join(" ");
}
