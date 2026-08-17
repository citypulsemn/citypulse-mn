import { describe, it, expect } from "vitest";
import { evalKey, compareEventSets, missedEvents, type EvalEvent } from "../model-eval";

const ev = (title: string, venue: string, start: string): EvalEvent => ({ title, venue, start });

describe("evalKey — normalized event identity", () => {
  it("folds case, punctuation, and time-of-day (same day = same key)", () => {
    expect(evalKey(ev("Twins vs. Yankees", "Target Field", "2026-08-20T19:10"))).toBe(
      evalKey(ev("twins vs yankees", "target field", "2026-08-20T13:00")),
    );
  });
  it("a different day is a different event", () => {
    expect(evalKey(ev("Twins vs Yankees", "Target Field", "2026-08-20T19:10"))).not.toBe(
      evalKey(ev("Twins vs Yankees", "Target Field", "2026-08-21T19:10")),
    );
  });
});

describe("compareEventSets — coverage of candidate vs baseline", () => {
  const baseline = [
    ev("Twins vs Yankees", "Target Field", "2026-08-20T19:10"),
    ev("Lynx vs Aces", "Target Center", "2026-08-21T19:00"),
    ev("Saints Game", "CHS Field", "2026-08-22T18:05"),
  ];

  it("perfect overlap → recall 1, nothing missed", () => {
    const cmp = compareEventSets(baseline, baseline);
    expect(cmp.recall).toBe(1);
    expect(cmp.missedByCandidate).toBe(0);
    expect(cmp.both).toBe(3);
  });

  it("candidate drops one → recall reflects the gap", () => {
    const candidate = baseline.slice(0, 2); // missing the Saints game
    const cmp = compareEventSets(baseline, candidate);
    expect(cmp.baseline).toBe(3);
    expect(cmp.candidate).toBe(2);
    expect(cmp.both).toBe(2);
    expect(cmp.missedByCandidate).toBe(1);
    expect(cmp.recall).toBeCloseTo(2 / 3, 5);
  });

  it("candidate finds extras not in the baseline (counted, not credited to recall)", () => {
    const candidate = [...baseline, ev("Extra Match", "Allianz", "2026-08-23T19:00")];
    const cmp = compareEventSets(baseline, candidate);
    expect(cmp.recall).toBe(1); // all baseline covered
    expect(cmp.extraByCandidate).toBe(1);
  });

  it("empty baseline → recall 1 (no coverage to lose), never divide-by-zero", () => {
    expect(compareEventSets([], baseline).recall).toBe(1);
  });
});

describe("missedEvents — the qualitative signal", () => {
  it("returns the baseline events the candidate didn't find, deduped", () => {
    const baseline = [
      ev("Twins vs Yankees", "Target Field", "2026-08-20T19:10"),
      ev("Lynx vs Aces", "Target Center", "2026-08-21T19:00"),
      ev("Twins vs Yankees", "Target Field", "2026-08-20T22:00"), // same key as #1
    ];
    const candidate = [ev("Lynx vs Aces", "Target Center", "2026-08-21T19:00")];
    const missed = missedEvents(baseline, candidate);
    expect(missed.map((e) => e.title)).toEqual(["Twins vs Yankees"]);
  });
});
