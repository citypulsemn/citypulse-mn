import type { EventRecord } from "./types";

/**
 * FRESHNESS RE-VERIFICATION (roadmap 4.5).
 *
 * Events are discovered weekly, but reality changes daily: shows get cancelled,
 * sell out, and move. The agents could already flag a cancellation when they
 * happened to re-find an event — but nothing PROACTIVELY re-checked the events
 * people are about to attend. A show cancelled on Tuesday sat on the calendar
 * until Monday's run. Trust is the product; this closes that gap.
 *
 * A verification agent re-checks near-term events against their sources and
 * returns a verdict per event. THE POLICY (pure, unit-tested here):
 *
 *   - cancelled  → applied automatically. A cancellation with evidence is the
 *                  one thing worth acting on without a human.
 *   - moved      → FLAGGED, never auto-applied. Auto-editing a start time on an
 *                  LLM's reading of a webpage risks corrupting good data; the
 *                  admin fixes times with the 1.5 editor.
 *   - sold_out   → flagged (informational).
 *   - not_found  → flagged only. A vanished page is NOT evidence of cancellation
 *                  — sites reorganize constantly. Never cancel on absence.
 *   - confirmed  → stamps verified_at.
 */

export const VERDICTS = ["confirmed", "cancelled", "moved", "sold_out", "not_found"] as const;
export type Verdict = (typeof VERDICTS)[number];

export interface VerificationVerdict {
  id: string;
  verdict: Verdict;
  /** Required for `cancelled`: where the agent saw it (URL or quoted wording). */
  evidence?: string;
  /** For `moved`: the new time the source shows (ISO), informational only. */
  newStart?: string;
}

export type VerifyAction =
  | { kind: "cancel"; id: string; evidence: string }
  | { kind: "confirm"; id: string }
  | { kind: "flag"; id: string; verdict: Verdict; note: string };

/**
 * Turn a verdict into an action, enforcing the safety policy above.
 * A "cancelled" verdict WITHOUT evidence is downgraded to a flag — the agent
 * must show its work before we pull an event off the calendar.
 */
export function actionFor(v: VerificationVerdict): VerifyAction {
  switch (v.verdict) {
    case "cancelled":
      if (v.evidence && v.evidence.trim().length > 0) {
        return { kind: "cancel", id: v.id, evidence: v.evidence.trim() };
      }
      return { kind: "flag", id: v.id, verdict: "cancelled", note: "cancel verdict without evidence — needs review" };
    case "confirmed":
      return { kind: "confirm", id: v.id };
    case "moved":
      return { kind: "flag", id: v.id, verdict: "moved", note: v.newStart ? `source shows ${v.newStart}` : "time appears changed" };
    case "sold_out":
      return { kind: "flag", id: v.id, verdict: "sold_out", note: "listed as sold out" };
    case "not_found":
      return { kind: "flag", id: v.id, verdict: "not_found", note: "source page not found — NOT cancelled on absence" };
  }
}

export interface VerifiableEvent {
  id: string;
  title: string;
  venue: string;
  city: string;
  start: string;
  sourceUrl: string;
  ticketUrl: string;
}

/**
 * Which events deserve a re-check: published, starting within `days`, soonest
 * first (tonight's show matters more than next Sunday's), capped so the job has
 * a predictable cost. Events with no source or ticket URL are skipped — there's
 * nothing to check them against.
 */
export function selectForVerification(
  events: Pick<EventRecord, "id" | "title" | "venue" | "city" | "start" | "sourceUrl" | "ticketUrl" | "status">[],
  now: Date,
  opts: { days?: number; cap?: number } = {},
): VerifiableEvent[] {
  const days = opts.days ?? 7;
  const cap = opts.cap ?? 40;
  const from = now.getTime();
  const to = from + days * 86_400_000;

  return events
    .filter((e) => e.status === "published")
    .filter((e) => (e.sourceUrl || e.ticketUrl).trim().length > 0)
    .filter((e) => {
      const t = new Date(e.start).getTime();
      return !Number.isNaN(t) && t >= from && t <= to;
    })
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, cap)
    .map((e) => ({
      id: e.id,
      title: e.title,
      venue: e.venue,
      city: e.city,
      start: e.start,
      sourceUrl: e.sourceUrl,
      ticketUrl: e.ticketUrl,
    }));
}

/** Parse the agent's JSON verdict block; unknown ids/verdicts are dropped. */
export function parseVerdicts(text: string, validIds: Set<string>): VerificationVerdict[] {
  const match = text.match(/```json\s*([\s\S]*?)```/);
  const raw = match ? match[1] : text;
  let arr: unknown;
  try {
    arr = JSON.parse(raw.trim());
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];

  const out: VerificationVerdict[] = [];
  for (const item of arr) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id : "";
    const verdict = typeof o.verdict === "string" ? (o.verdict as Verdict) : "confirmed";
    if (!validIds.has(id)) continue;
    if (!VERDICTS.includes(verdict)) continue;
    out.push({
      id,
      verdict,
      evidence: typeof o.evidence === "string" ? o.evidence : undefined,
      newStart: typeof o.new_start === "string" ? o.new_start : undefined,
    });
  }
  return out;
}

/** Chunk events for the agent (small batches keep each job checkable). */
export function batchForVerification<T>(events: T[], perBatch = 8): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < events.length; i += perBatch) out.push(events.slice(i, i + perBatch));
  return out;
}
