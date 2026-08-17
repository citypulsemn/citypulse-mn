import { normalizeKeyPart } from "./canonicalize";

/**
 * Pure coverage comparison for the Haiku-routing validation (cost brainstorm
 * lever #3). Given two research-agent result sets — a baseline (Sonnet) and a
 * candidate (Haiku) — measure how much of the baseline's coverage the candidate
 * reproduces. High recall + comparable count ⇒ the cheaper model is safe to
 * route that category; the missed set says what it drops. Deterministic, tested;
 * the live agent calls live in scripts/model-eval.ts.
 */

export interface EvalEvent {
  title: string;
  venue: string;
  start: string;
}

/** Normalized identity for overlap: title + venue + calendar day (folds case,
 *  accents, punctuation via normalizeKeyPart). Two agents that find the same
 *  event on the same day collapse to one key even if wording differs slightly. */
export function evalKey(e: EvalEvent): string {
  return [normalizeKeyPart(e.title), normalizeKeyPart(e.venue), (e.start ?? "").slice(0, 10)].join("|");
}

export interface SetComparison {
  baseline: number; // distinct events the baseline model found
  candidate: number; // distinct events the candidate model found
  both: number; // found by both
  missedByCandidate: number; // baseline-only (the coverage the candidate drops)
  extraByCandidate: number; // candidate-only (may be real finds or noise)
  /** Fraction of the baseline's coverage the candidate reproduced, 0..1. The
   *  headline number: ~1 means the cheaper model holds coverage. 1 when the
   *  baseline found nothing (no coverage to lose). */
  recall: number;
}

export function compareEventSets(baseline: EvalEvent[], candidate: EvalEvent[]): SetComparison {
  const kb = new Set(baseline.map(evalKey));
  const kc = new Set(candidate.map(evalKey));
  let both = 0;
  for (const k of kb) if (kc.has(k)) both++;
  return {
    baseline: kb.size,
    candidate: kc.size,
    both,
    missedByCandidate: kb.size - both,
    extraByCandidate: kc.size - both,
    recall: kb.size > 0 ? both / kb.size : 1,
  };
}

/** The baseline events the candidate missed — the qualitative signal for judging
 *  whether the dropped coverage matters. Pure. */
export function missedEvents(baseline: EvalEvent[], candidate: EvalEvent[]): EvalEvent[] {
  const kc = new Set(candidate.map(evalKey));
  const seen = new Set<string>();
  const out: EvalEvent[] = [];
  for (const e of baseline) {
    const k = evalKey(e);
    if (kc.has(k) || seen.has(k)) continue;
    seen.add(k);
    out.push(e);
  }
  return out;
}
