import type { EventRecord } from "./types";
import { isAggregatorSource, isNonScheduleSource } from "./source-trust";
import { venueIsUnknown, unknownVenueReason } from "./venue-quality";
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

export const VERDICTS = [
  "confirmed",
  "cancelled",
  "moved",
  "sold_out",
  "not_found",
  // Sep 2026, from the Marley/Fillmore incident: the venue's own calendar shows
  // a DIFFERENT act in that room that night. Distinct from `not_found` (which
  // means "I couldn't find it") and from `cancelled` (which means it was real
  // and got called off). This one says the room is demonstrably busy with
  // something else — the single fact that settled that report in one read.
  "wrong_event",
] as const;
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
    case "wrong_event":
      // FLAGGED, not auto-hidden, and deliberately so. This is the strongest
      // negative the pass can produce, but it is still ONE instrument, and a
      // support act, a co-headline or a renamed billing can all look like "a
      // different act". The house standard for hiding is two instruments
      // agreeing (see scripts/resolve-conflicts.ts); `import-venues` flags
      // rather than hides for the same reason. A false removal deletes a real
      // event and nobody ever reports THAT.
      //
      // What it does guarantee is that `verified_at` is NOT stamped — which is
      // the specific failure that let a fabricated listing look trustworthy.
      return {
        kind: "flag",
        id: v.id,
        verdict: "wrong_event",
        note: v.evidence
          ? `venue lists something else that night — ${v.evidence.slice(0, 200)}`
          : "venue appears to list something else that night (no evidence given)",
      };
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

/** How far ahead verification looks. Matches the pipeline research horizon in
 *  lib/horizon.ts — anything we publish, we should be able to check. */
export const VERIFY_HORIZON_DAYS = 92;

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
 * ORDER: never-verified-from-a-roundup first, then never-verified, then
 * soonest first inside each group.
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
  // Match the research horizon. It was 7, while the pipeline researches 92 days
  // out (lib/horizon.ts) — so 88% of unverified events were structurally
  // invisible to this pass until the week they happened, by which point the cap
  // and the time budget were already spent on that week. Widening costs nothing:
  // `cap` bounds the work, not the window; this only changes WHICH events the
  // same budget looks at.
  const days = opts.days ?? VERIFY_HORIZON_DAYS;
  const cap = opts.cap ?? DEFAULT_CAP;
  // R1.6 (rule 10): walls to walls. The old naive-parse window, run on the
  // Thursday 16:00 UTC Actions runner, dropped tonight's events from
  // verification after ~11 AM CT and let events just past day 7 sneak in.
  // (The SQL prefilter in scripts/verify-events.ts is frame-correct —
  // timestamptz vs now() — this TS filter was re-narrowing it wrongly.)
  const fromWall = chiWallClock(now);
  const toWall = chiWallClock(new Date(now.getTime() + days * 86_400_000));

  const neverVerified = (e: VerificationCandidate) => !e.verifiedAt;

  /**
   * 0 = never verified AND sourced from a third-party roundup — the exact shape
   * that produced the Damian Marley and Westwood Hills fabrications, so it gets
   * looked at first. 1 = never verified. 2 = already confirmed once.
   */
  const risk = (e: VerificationCandidate): number => {
    if (!neverVerified(e)) return 2;
    return isAggregatorSource(e.sourceUrl || e.ticketUrl || "") ? 0 : 1;
  };

  return events
    .filter((e) => e.status === "published")
    .filter((e) => (e.sourceUrl || e.ticketUrl).trim().length > 0)
    .filter((e) => e.start >= fromWall && e.start <= toWall)
    .sort((a, b) => {
      // Riskiest first; soonest first within each group. Tonight's unconfirmed
      // show outranks tonight's confirmed one, and both outrank Sunday's — and
      // an unconfirmed listing whose only source is a seasonal roundup outranks
      // every other unconfirmed one.
      const ar = risk(a);
      const br = risk(b);
      if (ar !== br) return ar - br;
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
    // NO DEFAULT. This used to fall back to "confirmed" when the field was
    // missing or not a string, so a malformed answer stamped `verified_at` on
    // an event nobody had checked. Silence is not a confirmation.
    if (typeof o.verdict !== "string") continue;
    const verdict = o.verdict as Verdict;
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

// ---------------------------------------------------------------------------
// Routing verdicts to writes
// ---------------------------------------------------------------------------

/** What a batch of verdicts turns into: three write-buckets and the lines to print. */
export interface RoutedVerdicts {
  confirms: string[];
  cancels: { id: string; evidence: string }[];
  flags: { id: string; verdict: string; note: string }[];
  /** Printed by the caller. Returned rather than logged so this stays pure. */
  lines: string[];
}

/** The fields routing needs off an event. A superset of what the agent is sent. */
export type RoutableEvent = Pick<
  VerifiableEvent,
  "id" | "title" | "venue" | "city" | "sourceUrl" | "ticketUrl"
>;

/**
 * Turn verdicts into writes, applying every gate that stands between an
 * agent's opinion and `verified_at`.
 *
 * EXTRACTED FROM scripts/verify-events.ts, where it was inline in the batch
 * loop, because there are now TWO ways verdicts arrive: the paid agent loop,
 * and a findings file produced in a supervised session (`--from=`). Two copies
 * of this would be two definitions of "what a confirmation requires" — the
 * exact drift that let the panel and the writer disagree about "same event"
 * for five weeks. One definition, both callers.
 *
 * The gates, in order, each bought by an incident:
 *   - actionFor        cancels need evidence; absence never cancels
 *   - venueIsUnknown   a stamp must know WHERE the event is (12 Sep 2026: five
 *                      live rows stamped verified with venue "TBD – Saint Paul")
 *   - weak source      a roundup or reseller is good enough to cite, not good
 *                      enough to stamp. The stamp still lands — withholding it
 *                      re-queues the row and re-spends on it forever — but the
 *                      flag lands with it so the confirmation is not laundered
 *                      clean (4 Oct 2026: of 140 weakly-sourced live listings,
 *                      113 carried a stamp).
 *
 * A verdict for an id not in `events` is dropped: nothing can be routed
 * without the row it describes.
 */
export function routeVerdicts(
  verdicts: VerificationVerdict[],
  events: RoutableEvent[],
): RoutedVerdicts {
  const byId = new Map(events.map((e) => [e.id, e]));
  const out: RoutedVerdicts = { confirms: [], cancels: [], flags: [], lines: [] };

  for (const v of verdicts) {
    const action = actionFor(v);
    const ev = byId.get(action.id);
    if (!ev) continue;
    const title = ev.title ?? action.id;

    if (action.kind === "cancel") {
      out.lines.push(`[verify]   ✗ CANCELLED "${title}" — ${action.evidence.slice(0, 90)}`);
      out.cancels.push({ id: action.id, evidence: action.evidence });
      continue;
    }

    if (action.kind !== "confirm") {
      out.lines.push(`[verify]   ⚑ ${action.verdict.toUpperCase()} "${title}" — ${action.note}`);
      out.flags.push({ id: action.id, verdict: action.verdict, note: action.note });
      continue;
    }

    // "Confirmed" has to mean we know WHERE it is. A stamp on a row that cannot
    // tell a reader where to go is a promise we have not kept.
    if (venueIsUnknown(ev.venue, ev.city)) {
      const why = unknownVenueReason(ev.venue, ev.city) ?? "venue unknown";
      out.lines.push(`[verify]   ⚑ NO-VENUE "${title}" — confirmed, but ${why}`);
      out.flags.push({ id: action.id, verdict: "no_venue", note: why });
      continue;
    }

    out.confirms.push(action.id);

    // Roundups AND resellers. The first version of this gate covered only
    // AGGREGATOR_HOSTS, which left the larger half uncovered: the commonest
    // weak sources were ticketmaster (37), songkick (12) and bandsintown (8),
    // none of them an aggregator by that list.
    const src = (ev.sourceUrl || ev.ticketUrl || "").trim();
    const roundup = isAggregatorSource(src);
    const reseller = !roundup && isNonScheduleSource(src);
    if (roundup || reseller) {
      const host = (() => {
        try {
          return new URL(src).hostname;
        } catch {
          return src.slice(0, 40);
        }
      })();
      const what = roundup
        ? "a roundup rather than the organiser's own schedule"
        : "a reseller or social page rather than the organiser's own schedule";
      out.lines.push(`[verify]   ⚑ WEAK-SOURCE "${title}" — confirmed against ${host}, ${what}`);
      out.flags.push({
        id: action.id,
        verdict: "weak_source",
        note: `confirmed only against ${host}, ${what} — needs a primary source`,
      });
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// Verdicts from a file
// ---------------------------------------------------------------------------

/** A parsed findings file: what survived, and every entry that did not. */
export interface VerdictFileParse {
  verdicts: VerificationVerdict[];
  /** Each rejection, with a reason. Reported out loud — never silent. */
  rejected: { entry: string; why: string }[];
}

/**
 * Parse a verdicts file written by a supervised session (or by hand).
 *
 * WHY NOT `parseVerdicts`. That one reads an agent's reply inside a process we
 * control and drops anything odd silently, which is right there: the next batch
 * is seconds away. A FILE is a trust boundary — it was written somewhere else,
 * possibly days ago, possibly edited on a phone (this project has already had
 * an `.env.local` arrive with `//` turned into `..`). So every rejection is
 * returned with a reason and printed, because a file that half-applied while
 * reporting success is the failure mode that costs a week of verification.
 *
 * Accepts a bare array, an object with a `verdicts` key, or either wrapped in a
 * ```json fence — all three are shapes a session plausibly writes.
 */
export function parseVerdictFile(text: string, validIds: Set<string>): VerdictFileParse {
  const out: VerdictFileParse = { verdicts: [], rejected: [] };

  // EVERY fenced block, not the first. A non-greedy match on the first ```…```
  // silently dropped every verdict after it while `rejected` stayed empty, so
  // the run reported "N usable, 0 dropped" having lost an evidenced
  // cancellation. Appending a second block is exactly how a file gets corrected
  // — and the only practical way on a phone.
  const blocks = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].map((m) => m[1]);
  const chunks = blocks.length > 0 ? blocks : [text];

  const arr: unknown[] = [];
  for (const [i, chunk] of chunks.entries()) {
    const where = chunks.length > 1 ? `(block ${i + 1} of ${chunks.length})` : "(whole file)";
    const raw = chunk.trim();
    if (raw.length === 0) {
      out.rejected.push({ entry: where, why: chunks.length > 1 ? "empty block" : "file is empty" });
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      out.rejected.push({ entry: where, why: `not valid JSON — ${String(err).slice(0, 120)}` });
      continue;
    }
    const entries = Array.isArray(parsed)
      ? parsed
      : typeof parsed === "object" && parsed !== null && Array.isArray((parsed as { verdicts?: unknown }).verdicts)
        ? (parsed as { verdicts: unknown[] }).verdicts
        : null;
    if (!entries) {
      out.rejected.push({
        entry: where,
        why: "expected an array of verdicts, or an object with a `verdicts` array",
      });
      continue;
    }
    arr.push(...entries);
  }
  if (arr.length === 0) return out;

  // A SELF-CONTRADICTORY FILE CANNOT BE RESOLVED BY POSITION. First-wins would
  // let an earlier `confirmed` beat a later evidenced `cancelled` — stamping
  // verified_at on a show a human had just found cancelled, and demoting it to
  // risk tier 2 so later passes deprioritise it. Both entries are rejected;
  // only an exact repeat keeps first-wins.
  const verdictsPerId = new Map<string, Set<string>>();
  for (const item of arr) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    if (typeof o.id !== "string" || typeof o.verdict !== "string") continue;
    const id = o.id.trim();
    if (!verdictsPerId.has(id)) verdictsPerId.set(id, new Set());
    verdictsPerId.get(id)!.add(o.verdict.trim());
  }
  const conflicted = new Set(
    [...verdictsPerId].filter(([, vs]) => vs.size > 1).map(([id]) => id),
  );

  const seen = new Set<string>();
  for (const item of arr) {
    const label = (() => {
      try {
        return JSON.stringify(item).slice(0, 80);
      } catch {
        return String(item).slice(0, 80);
      }
    })();
    if (typeof item !== "object" || item === null) {
      out.rejected.push({ entry: label, why: "not an object" });
      continue;
    }
    const o = item as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id.trim() : "";
    if (!id) {
      out.rejected.push({ entry: label, why: "no `id`" });
      continue;
    }
    // NO DEFAULT, for the same reason parseVerdicts has none: a missing verdict
    // once fell back to "confirmed" and stamped rows nobody had checked.
    if (typeof o.verdict !== "string") {
      out.rejected.push({ entry: label, why: "no `verdict`" });
      continue;
    }
    const verdict = o.verdict.trim() as Verdict;
    if (!VERDICTS.includes(verdict)) {
      out.rejected.push({ entry: label, why: `unknown verdict "${verdict}" — expected one of ${VERDICTS.join(", ")}` });
      continue;
    }
    // Not in the current window: archived, cancelled or past since the research
    // ran. Dropping it is correct, saying nothing about it is not.
    if (!validIds.has(id)) {
      out.rejected.push({ entry: label, why: "id is not a published event in the current horizon — stale or wrong file" });
      continue;
    }
    if (conflicted.has(id)) {
      out.rejected.push({
        entry: label,
        why: `two different verdicts in this file for id ${id} (${[...(verdictsPerId.get(id) ?? [])].join(" vs ")}) — rejecting BOTH, since position cannot settle which is right. Fix the file.`,
      });
      continue;
    }
    if (seen.has(id)) {
      out.rejected.push({ entry: label, why: "exact duplicate of an entry already taken" });
      continue;
    }
    seen.add(id);
    out.verdicts.push({
      id,
      verdict,
      evidence: typeof o.evidence === "string" ? o.evidence : undefined,
      newStart:
        typeof o.new_start === "string"
          ? o.new_start
          : typeof o.newStart === "string"
            ? o.newStart
            : undefined,
    });
  }

  return out;
}
