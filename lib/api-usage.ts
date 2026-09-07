/**
 * What each Claude call actually cost.
 *
 * WHY. On 7 Sep 2026 an audit of this project's API spend could not answer the
 * simplest question — where the money goes — because nothing recorded it. Every
 * figure had to be estimated from the code, and the estimate for the single
 * biggest line (web-search results entering context as input tokens) was a
 * range with a factor of two in it. Every request already returns the answer in
 * `response.usage`; we were throwing it away.
 *
 * So this logs a line per call. It is an INSTRUMENT, and under rule 1 an
 * instrument may never break the thing it measures: every function here is
 * total — unknown model, missing usage, malformed numbers all return a value
 * rather than throwing, and `logUsage` swallows anything that still escapes.
 * A pipeline run must never fail because the accountant tripped.
 */

/** The shape we need from `response.usage`, kept structural so the SDK's own
 *  type (which gains fields between versions) satisfies it without a cast. */
export interface UsageLike {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  server_tool_use?: { web_search_requests?: number | null } | null;
}

/**
 * USD per million tokens, read off platform.claude.com/docs/en/about-claude/pricing
 * on 7 Sep 2026. Prices change — when a number here looks stale, re-fetch that
 * page rather than trusting this table.
 */
export const RATES: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-sonnet-4-6": { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  "claude-sonnet-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  "claude-opus-5": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-haiku-4-5": { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
};

/** $10 per 1,000 searches. Billed on top of tokens, and — unlike tokens — no
 *  model choice, cache, or batch discount is known to touch it. The only lever
 *  on this line is making fewer searches. */
export const WEB_SEARCH_USD_PER_CALL = 0.01;

/** The Batch API's discount on tokens. It is NOT applied to the web-search fee
 *  here: the pricing page states the 50% on input and output tokens and says
 *  nothing about server-tool fees, so we assume the fee is undiscounted rather
 *  than quietly under-reporting the bill. */
export const BATCH_TOKEN_MULTIPLIER = 0.5;

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0);

export interface CostBreakdown {
  /** null when the model isn't in RATES — an unpriced call is reported as
   *  unpriced, never as $0.00, which would read as "this call was free". */
  tokensUsd: number | null;
  /** Always known: the fee depends on the count, not the model. */
  searchUsd: number;
  totalUsd: number | null;
  searches: number;
}

export function estimateCost(
  model: string,
  usage: UsageLike | null | undefined,
  opts: { batch?: boolean } = {},
): CostBreakdown {
  const u = usage ?? {};
  const searches = num(u.server_tool_use?.web_search_requests);
  const searchUsd = searches * WEB_SEARCH_USD_PER_CALL;

  const rate = RATES[model];
  if (!rate) return { tokensUsd: null, searchUsd, totalUsd: null, searches };

  const mult = opts.batch ? BATCH_TOKEN_MULTIPLIER : 1;
  const tokensUsd =
    ((num(u.input_tokens) * rate.input +
      num(u.output_tokens) * rate.output +
      num(u.cache_read_input_tokens) * rate.cacheRead +
      num(u.cache_creation_input_tokens) * rate.cacheWrite) /
      1_000_000) *
    mult;

  return { tokensUsd, searchUsd, totalUsd: tokensUsd + searchUsd, searches };
}

/** One grep-able line per call. Keep the shape stable — it is meant to be
 *  parsed out of GitHub Actions logs and summed. */
export function formatUsageLine(
  label: string,
  model: string,
  usage: UsageLike | null | undefined,
  opts: { batch?: boolean } = {},
): string {
  const u = usage ?? {};
  const cost = estimateCost(model, usage, opts);
  const money =
    cost.totalUsd === null
      ? `$? (no rate for ${model})`
      : `$${cost.totalUsd.toFixed(4)}` +
        (cost.searches > 0 ? ` (tokens $${cost.tokensUsd!.toFixed(4)} + ${cost.searches} search $${cost.searchUsd.toFixed(2)})` : "");

  return (
    `[usage] ${label} · ${model}${opts.batch ? " (batch)" : ""} · ` +
    `in ${num(u.input_tokens)} out ${num(u.output_tokens)} ` +
    `cache r${num(u.cache_read_input_tokens)}/w${num(u.cache_creation_input_tokens)} · ${money}`
  );
}

/** Fire-and-forget. Never throws — see the rule-1 note at the top. */
export function logUsage(
  label: string,
  model: string,
  usage: UsageLike | null | undefined,
  opts: { batch?: boolean } = {},
): void {
  try {
    console.log(formatUsageLine(label, model, usage, opts));
  } catch {
    // An instrument that can break the run is worse than no instrument.
  }
}
