import type { EventRecord } from "./types";
import { chiWallClock } from "./clock";

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
 * How many events one run may check.
 *
 * Was 40, which covered about 25 hours of a 7-day window — and since the job
 * runs weekly, everything past that hour simply happened without being looked
 * at. 200 clears a full window with room for a festival week (165 measured on
 * 26 Aug 2026).
 *
 * The cap is the COST ceiling, not the schedule. What actually stops a long run
 * is `RUN_BUDGET_MS` below, so a slow week ends on time instead of being killed
 * by the Actions timeout.
 */
export const DEFAULT_CAP = 200;

/**
 * Wall-clock budget for the agent loop, in ms. The GitHub job allows 30 minutes
 * total; this leaves room for checkout, `npm ci` and the final writes.
 *
 * A budget rather than a batch count because per-batch time is not knowable in
 * advance — it depends on how many web searches each event needs. Guessing a
 * batch count that "should fit" is how a job gets killed at 90% done.
 */
export const RUN_BUDGET_MS = 20 * 60 * 1000;

/**
 * Should the loop start another batch? Checked BEFORE each batch, never during:
 * a batch already in flight has been paid for and always finishes.
 */
export function withinBudget(startedAt: number, now: number, budgetMs = RUN_BUDGET_MS): boolean {
  return now - startedAt < budgetMs;
}

/** A row as the selector sees it: an event plus whether a source ever vouched for it. */
export type VerificationCandidate = Pick<
  EventRecord,
  "id" | "title" | "venue" | "city" | "start" | "sourceUrl" | "ticketUrl" | "status"
> & {
  /** When a primary source last confirmed this row. Null/absent = never checked. */
  verifiedAt?: string | null;
};

/**
 * Which events deserve a re-check: published, starting within `days`, with a
 * source to check against. Events with no source or ticket URL are skipped —
 * there's nothing to check them against.
 *
 * ORDER: never-verified first, then soonest first inside each group.
 *
 * It used to be soonest-first only, and that quietly wasted the budget. The
 * league and venue importers stamp `verified_at` on the rows they cover, so the
 * soonest slice is thick with music and sports a primary source already vouched
 * for this week — while the listings nobody has EVER confirmed (arts 8%,
 * festival 2%, food 1%, weird 0%) sat past the cap and expired unchecked.
 * Measured 26 Aug 2026: of 165 events in the window, the cap of 40 reached 34
 * unverified rows and left 71 behind. Re-checking a confirmed row is not
 * worthless, but it is worth less than the first look at an unconfirmed one.
 */
export function selectForVerification(
  events: VerificationCandidate[],
  now: Date,
  opts: { days?: number; cap?: number } = {},
): VerifiableEvent[] {
  const days = opts.days ?? 7;
  const cap = opts.cap ?? DEFAULT_CAP;
  // R1.6 (rule 10): walls to walls. The old naive-parse window, run on the
  // Thursday 16:00 UTC Actions runner, dropped tonight's events from
  // verification after ~11 AM CT and let events just past day 7 sneak in.
  // (The SQL prefilter in scripts/verify-events.ts is frame-correct —
  // timestamptz vs now() — this TS filter was re-narrowing it wrongly.)
  const fromWall = chiWallClock(now);
  const toWall = chiWallClock(new Date(now.getTime() + days * 86_400_000));

  const neverVerified = (e: VerificationCandidate) => !e.verifiedAt;

  return events
    .filter((e) => e.status === "published")
    .filter((e) => (e.sourceUrl || e.ticketUrl).trim().length > 0)
    .filter((e) => e.start >= fromWall && e.start <= toWall)
    .sort((a, b) => {
      // Never-verified first; soonest first within each group. Tonight's
      // unconfirmed show outranks tonight's confirmed one, and both outrank
      // Sunday's.
      const an = neverVerified(a) ? 0 : 1;
      const bn = neverVerified(b) ? 0 : 1;
      if (an !== bn) return an - bn;
      return a.start.localeCompare(b.start);
    })
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
