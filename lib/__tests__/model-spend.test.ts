import { describe, it, expect } from "vitest";
import { totalSpend, describeSpend, type SpendRow } from "../model-spend";

const row = (job: string, cost_usd: number): SpendRow => ({
  job, cost_usd, searches: 0, calls: 1, unpriced_calls: 0, runs: 1,
});

describe("totalSpend", () => {
  it("sums the jobs", () => {
    expect(totalSpend([row("pipeline", 37.03), row("verify", 41.81)])).toBeCloseTo(78.84, 2);
  });

  it("is zero for an empty ledger, which the tile must not show as a bill", () => {
    expect(totalSpend([])).toBe(0);
  });

  it("ignores a non-finite cost rather than poisoning the total with NaN", () => {
    // A single bad row must not turn the whole figure into "NaN recorded".
    expect(totalSpend([row("pipeline", 10), row("verify", NaN)])).toBe(10);
  });
});

describe("describeSpend", () => {
  it("leads with the most expensive job", () => {
    // The point of the ledger: in September the job nobody was watching was
    // the bigger one, so it has to read first.
    expect(describeSpend([row("pipeline", 37.03), row("verify", 41.81)]))
      .toBe("verify $41.81 · pipeline $37.03");
  });

  it("says nothing is recorded rather than implying $0 was spent", () => {
    expect(describeSpend([])).toBe("nothing recorded yet");
  });

  it("does not mutate the caller's array", () => {
    const rows = [row("pipeline", 1), row("verify", 99)];
    describeSpend(rows);
    expect(rows[0].job).toBe("pipeline");
  });
});
