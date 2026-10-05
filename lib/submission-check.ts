/**
 * Checking a reader's event submission before anyone is asked to look at it.
 *
 * The sibling of lib/report-check.ts, and deliberately the same shape: a
 * stranger has told us something about the calendar, and the question is
 * whether it is true. Reports have been checked on arrival since Sep 2026;
 * submissions were inserted and left sitting until somebody noticed the count
 * in Monday's ops email, up to seven days later.
 *
 * WHAT MAKES THIS DIFFERENT FROM A REPORT CHECK. A report asks "is this live
 * listing wrong?" and the answer is a verdict. A submission asks "is this
 * event real, and are these details right?" — and on the two submissions
 * handled by hand in Sep 2026 the answer was "yes, and no":
 *
 *   - Animal Farm arrived as one night. The university's own release showed
 *     SIX performances, and had the weekdays wrong on two of them.
 *   - The UNICEF pop-up arrived correct. The authoritative-looking Mall of
 *     America press release that came up first was LAST YEAR'S, and taking it
 *     would have turned a right submission into a wrong listing.
 *
 * Each took a quarter of an hour of reading. A verdict alone would have saved
 * none of it, so the check returns CORRECTIONS — the fields it believes are
 * wrong and what they should be — and the operator publishes the corrected
 * version with one tap instead of doing the reading again.
 *
 * NOTHING HERE IS EVER APPLIED AUTOMATICALLY. These are proposals for a human,
 * the same way `recommendationFor` is advice and never an action.
 */

export const SUBMISSION_VERDICTS = [
  "confirmed",
  "corrected",
  "unconfirmed",
  "contradicted",
  "error",
] as const;
export type SubmissionVerdict = (typeof SUBMISSION_VERDICTS)[number];

/** What the operator should probably do. Advice for the email, never applied. */
export type SubmissionRecommendation =
  | "publish-as-sent"
  | "publish-corrected"
  | "reject"
  | "needs-a-human";

/** The fields a check may propose changing. All optional; absent means "leave it". */
export interface SubmissionCorrections {
  title?: string;
  venue?: string;
  city?: string;
  address?: string;
  /** "YYYY-MM-DDTHH:MM" Chicago wall clock, as the form submits it. */
  start_local?: string;
  end_local?: string;
  price?: string;
  ticket_url?: string;
  source_url?: string;
}

export const CORRECTABLE_FIELDS: readonly (keyof SubmissionCorrections)[] = [
  "title", "venue", "city", "address", "start_local", "end_local", "price", "ticket_url", "source_url",
];

export interface SubmissionCheckInput {
  submissionId: string;
  title: string;
  venue: string;
  city: string;
  address: string;
  start_local: string;
  end_local: string | null;
  price: string;
  ticket_url: string;
  source_url: string;
  /** The submitter's own words. Public input — never interpolated into HTML raw. */
  description: string;
}

export interface SubmissionCheckResult {
  submissionId: string;
  verdict: SubmissionVerdict;
  /** Where the answer came from: a URL, or the exact wording seen. */
  evidence?: string;
  /** One sentence a human can read without opening anything. */
  note?: string;
  corrections?: SubmissionCorrections;
}

/**
 * The recommendation each verdict carries.
 *
 * `unconfirmed` deliberately does NOT recommend rejecting. A source that
 * cannot be found is not evidence that an event is fake — the same asymmetry
 * lib/verify.ts enforces for cancellations and lib/report-check.ts for
 * take-downs. A false rejection loses a real event and nobody ever reports
 * THAT; the submitter is not expecting a reply and will never chase it.
 */
export function recommendationForSubmission(v: SubmissionVerdict): SubmissionRecommendation {
  switch (v) {
    case "confirmed":
      return "publish-as-sent";
    case "corrected":
      return "publish-corrected";
    case "contradicted":
      return "reject";
    case "unconfirmed":
    case "error":
      return "needs-a-human";
  }
}

/** Human-readable one-liner for the email, per verdict. */
export function submissionVerdictHeadline(v: SubmissionVerdict): string {
  switch (v) {
    case "confirmed":
      return "Found it on a source we trust, and the details match what was sent.";
    case "corrected":
      return "The event is real, but some details differ from the source.";
    case "contradicted":
      return "A source we trust says this is not happening as described.";
    case "unconfirmed":
      return "Could not find this on any authoritative source — NOT the same as finding it false.";
    case "error":
      return "The check returned no answer for this submission.";
  }
}

/** Only corrections that actually change something, with blank values dropped. */
export function realCorrections(
  original: Pick<SubmissionCheckInput, "title" | "venue" | "city" | "address" | "start_local" | "end_local" | "price" | "ticket_url" | "source_url">,
  proposed: SubmissionCorrections | undefined,
): SubmissionCorrections {
  const out: SubmissionCorrections = {};
  if (!proposed) return out;
  for (const f of CORRECTABLE_FIELDS) {
    const next = proposed[f];
    if (typeof next !== "string") continue;
    const trimmed = next.trim();
    if (!trimmed) continue; // a blank is "no opinion", never "clear this field"
    const was = (original as Record<string, unknown>)[f];
    if (typeof was === "string" && was.trim() === trimmed) continue;
    if (was == null && !trimmed) continue;
    out[f] = trimmed;
  }
  return out;
}

/** "start_local: 2026-10-16T19:30 → 2026-10-16T19:30" lines for the email. */
export function describeCorrections(
  original: Parameters<typeof realCorrections>[0],
  corrections: SubmissionCorrections,
): string[] {
  return CORRECTABLE_FIELDS.filter((f) => corrections[f] !== undefined).map((f) => {
    const was = (original as Record<string, unknown>)[f];
    const wasText = typeof was === "string" && was.trim() ? was.trim() : "(empty)";
    return `${f}: ${wasText} → ${corrections[f]}`;
  });
}

/** The submission as the check believes it should be published. */
export function correctedSubmission<T extends Record<string, unknown>>(
  original: T,
  corrections: SubmissionCorrections,
): T {
  return { ...original, ...corrections };
}

const FIELD_LIST = CORRECTABLE_FIELDS.join(", ");

/**
 * The prompt. Named fields, one JSON object per submission, nothing else.
 *
 * It states the asymmetry explicitly because the model's instinct on a thin
 * search result is to call the event fake, and that instinct has been wrong
 * every time it mattered here.
 */
export function buildSubmissionCheckPrompt(items: SubmissionCheckInput[]): string {
  const blocks = items
    .map((i, n) =>
      [
        `### Submission ${n + 1}`,
        `id: ${i.submissionId}`,
        `title: ${i.title}`,
        `venue: ${i.venue}`,
        `city: ${i.city}`,
        `address: ${i.address || "(none given)"}`,
        `start_local: ${i.start_local}`,
        `end_local: ${i.end_local ?? "(none given)"}`,
        `price: ${i.price || "(none given)"}`,
        `ticket_url: ${i.ticket_url || "(none given)"}`,
        `source_url: ${i.source_url || "(none given)"}`,
        `description (the submitter's words): ${i.description.slice(0, 900)}`,
      ].join("\n"),
    )
    .join("\n\n");

  return [
    "You are checking events a reader submitted to a Twin Cities events calendar, BEFORE a human looks at them.",
    "For each submission, search the web and decide whether the event is real and whether the details are right.",
    "",
    "GO TO THE ORGANISER. A venue's or organiser's own page outranks everything. A news roundup, a",
    "listings aggregator or a reseller is weak evidence at best — this calendar has published fabrications",
    "sourced from exactly those.",
    "",
    "CHECK THE YEAR ON EVERY PAGE YOU READ. Seasonal pages are reused and search returns last year's",
    "copy constantly. A page dated last year is NOT evidence about this year, and treating one as current",
    "would turn a correct submission into a wrong listing.",
    "",
    "A SUBMISSION IS OFTEN ONE DATE OF A RUN. If the organiser shows several performances or days,",
    "say so in the note and correct the dates to the full span.",
    "",
    "Verdicts:",
    '  "confirmed"    — found on an authoritative source and the details match',
    '  "corrected"    — the event is real but one or more fields are wrong; give `corrections`',
    '  "contradicted" — an authoritative source says this is not happening as described',
    '  "unconfirmed"  — you could not find it. This is NOT a finding that it is fake. Use it freely;',
    "                   guessing costs a real event its listing, and the submitter will never chase it.",
    "",
    `Correctable fields: ${FIELD_LIST}. Give only the ones that should change, as exact replacement values.`,
    "Dates are Chicago wall clock, \"YYYY-MM-DDTHH:MM\". Leave a field out rather than guessing it.",
    "",
    "Reply with ONE JSON array and nothing else:",
    '[{"submissionId":"...","verdict":"corrected","evidence":"https://… or the exact wording seen",',
    ' "note":"one sentence","corrections":{"start_local":"2026-10-16T19:30"}}]',
    "",
    blocks,
  ].join("\n");
}

/** Parse the model's reply. Unknown ids and bad verdicts are dropped, not guessed. */
export function parseSubmissionChecks(
  text: string,
  validIds: Set<string>,
): SubmissionCheckResult[] {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end <= start) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();
  const out: SubmissionCheckResult[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.submissionId === "string" ? o.submissionId.trim() : "";
    const verdict = typeof o.verdict === "string" ? o.verdict.trim() : "";
    if (!validIds.has(id) || seen.has(id)) continue;
    if (!(SUBMISSION_VERDICTS as readonly string[]).includes(verdict)) continue;
    seen.add(id);

    const corrections: SubmissionCorrections = {};
    const c = o.corrections;
    if (c && typeof c === "object") {
      for (const f of CORRECTABLE_FIELDS) {
        const v = (c as Record<string, unknown>)[f];
        if (typeof v === "string" && v.trim()) corrections[f] = v.trim();
      }
    }

    out.push({
      submissionId: id,
      verdict: verdict as SubmissionVerdict,
      evidence: typeof o.evidence === "string" && o.evidence.trim() ? o.evidence.trim() : undefined,
      note: typeof o.note === "string" && o.note.trim() ? o.note.trim() : undefined,
      corrections: Object.keys(corrections).length > 0 ? corrections : undefined,
    });
  }
  return out;
}
