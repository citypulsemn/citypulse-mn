import { describe, it, expect } from "vitest";
import {
  estimateCost,
  formatUsageLine,
  logUsage,
  RATES,
  WEB_SEARCH_USD_PER_CALL,
  type UsageLike,
} from "../api-usage";

const FULL: UsageLike = {
  input_tokens: 1_000_000,
  output_tokens: 100_000,
  cache_read_input_tokens: 0,
  cache_creation_input_tokens: 0,
  server_tool_use: { web_search_requests: 8 },
};

describe("estimateCost", () => {
  it("prices tokens off the published per-MTok rates", () => {
    const c = estimateCost("claude-sonnet-4-6", { input_tokens: 1_000_000, output_tokens: 0 });
    expect(c.tokensUsd).toBeCloseTo(3, 6); // $3/MTok input
  });

  it("bills web search on top of tokens, at $10 per 1,000", () => {
    const c = estimateCost("claude-sonnet-4-6", FULL);
    expect(c.searches).toBe(8);
    expect(c.searchUsd).toBeCloseTo(0.08, 6);
    expect(c.tokensUsd).toBeCloseTo(3 + 1.5, 6); // 1M in + 100K out
    expect(c.totalUsd).toBeCloseTo(4.58, 6);
  });

  it("halves tokens under batch but NOT the search fee", () => {
    // The pricing page grants 50% on input and output tokens and says nothing
    // about server-tool fees. Assuming the fee is discounted would under-report
    // the bill, so the fee is carried at full price.
    const c = estimateCost("claude-sonnet-4-6", FULL, { batch: true });
    expect(c.tokensUsd).toBeCloseTo(2.25, 6);
    expect(c.searchUsd).toBeCloseTo(0.08, 6);
  });

  it("reports an unknown model as unpriced, never as free", () => {
    // $0.00 would read as "this call cost nothing", which is a lie that hides
    // spend. null forces the reader to notice the rate is missing.
    const c = estimateCost("claude-some-future-model", FULL);
    expect(c.tokensUsd).toBeNull();
    expect(c.totalUsd).toBeNull();
    expect(c.searchUsd).toBeCloseTo(0.08, 6); // the fee is still knowable
  });

  it("survives missing, null, and nonsense usage without throwing", () => {
    for (const u of [null, undefined, {}, { input_tokens: null, output_tokens: undefined }]) {
      const c = estimateCost("claude-sonnet-4-6", u as UsageLike);
      expect(c.tokensUsd).toBe(0);
      expect(c.searches).toBe(0);
    }
    const nonsense = estimateCost("claude-sonnet-4-6", {
      input_tokens: NaN,
      output_tokens: -5,
      server_tool_use: { web_search_requests: NaN },
    } as UsageLike);
    expect(nonsense.tokensUsd).toBe(0);
    expect(nonsense.searches).toBe(0);
  });

  it("counts cache reads at a tenth of input and writes at 1.25x", () => {
    const r = RATES["claude-sonnet-4-6"];
    expect(r.cacheRead).toBeCloseTo(r.input * 0.1, 6);
    expect(r.cacheWrite).toBeCloseTo(r.input * 1.25, 6);
  });

  it("Sonnet 5's lower rate does not by itself mean a lower bill", () => {
    // Measured 7 Sep 2026: the same research prompt is 1040 tokens on Sonnet 4.6
    // and 1467 on Sonnet 5 — the newer tokenizer emits ~41% more. Priced per
    // token Sonnet 5 looks 33% cheaper; priced per unit of TEXT the gap nearly
    // closes. This pins the arithmetic so nobody re-derives the 33% headline.
    const text46 = estimateCost("claude-sonnet-4-6", { input_tokens: 1040 }).tokensUsd!;
    const text5 = estimateCost("claude-sonnet-5", { input_tokens: 1467 }).tokensUsd!;
    expect(text5 / text46).toBeGreaterThan(0.9); // ~0.94 — a few percent, not a third
    expect(text5).toBeLessThan(text46); // still cheaper, just barely
  });
});

describe("formatUsageLine", () => {
  it("puts the label, model, token counts and dollars on one grep-able line", () => {
    const line = formatUsageLine("research:music", "claude-sonnet-4-6", FULL);
    expect(line).toContain("[usage] research:music");
    expect(line).toContain("claude-sonnet-4-6");
    expect(line).toContain("in 1000000 out 100000");
    expect(line).toContain("8 search");
  });

  it("says which model it could not price instead of printing a number", () => {
    const line = formatUsageLine("x", "claude-mystery", FULL);
    expect(line).toContain("no rate for claude-mystery");
    expect(line).not.toContain("$0.0000");
  });

  it("marks batch calls so the log can be split by tier", () => {
    expect(formatUsageLine("x", "claude-sonnet-4-6", FULL, { batch: true })).toContain("(batch)");
  });
});

describe("logUsage", () => {
  it("never throws, whatever it is handed", () => {
    // Rule 1: a broken instrument must not kill its panel. A pipeline run that
    // dies because the cost logger choked would be a self-inflicted outage.
    expect(() => logUsage("x", "claude-sonnet-4-6", null)).not.toThrow();
    expect(() => logUsage("x", "", undefined)).not.toThrow();
    expect(() =>
      logUsage("x", "claude-sonnet-4-6", { server_tool_use: "not an object" } as unknown as UsageLike),
    ).not.toThrow();
  });
});

describe("the web-search fee", () => {
  it("is $10 per 1,000 searches", () => {
    expect(WEB_SEARCH_USD_PER_CALL * 1000).toBeCloseTo(10, 6);
  });
});
