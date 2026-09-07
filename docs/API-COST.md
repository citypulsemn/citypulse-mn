# Claude API spend — where it goes, and what actually moves it

Audit date: **7 Sep 2026**. Prices read off `platform.claude.com/docs/en/about-claude/pricing`
that morning; re-fetch before trusting any figure here.

## The headline

Three of the four things you would reach for first do **not** work on this
workload, and one of them is measurably a wash. The levers that do work are
batch processing and search-result filtering. Everything below is the evidence.

**The single most useful change was not a saving at all:** nothing in this
project recorded `response.usage`, so every number here had to be estimated
from the code. That is now logged (§ Instrumentation), and one Monday pipeline
run will replace this document's ranges with measurements.

## Scope, quality bar, baseline

- **Scope**: every Claude call this repo makes — `lib/agents/research-agent.ts`
  (4 call sites) plus the manual `scripts/research-places.ts` and
  `scripts/resweep-verified.ts`. The `lib/reels/*` call sites are a separate
  uncommitted workstream and were not touched or counted.
- **Platform**: first-party Anthropic API, TypeScript SDK. No Bedrock/Vertex,
  so every lever below is actually available.
- **Quality bar**: **there is no eval for the LLM output.** The 1,969 tests
  cover pure logic; `research-prompts.test.ts` pins the prompt *text* and says
  so in its own header — "Real proof is Monday's pipeline run". This is why
  free wins are proposed below and tradeoffs are marked "needs an eval": with
  no outcome check, a saving cannot be told apart from a regression.
- **Baseline**: **unknown — estimated, not measured.** No usage logging existed
  and no Admin API key is configured. If you can read the real monthly figure
  off the Console, it replaces the estimate and re-ranks everything.

## Token profile (estimated from the code)

Call volume is deterministic and was computed from `HORIZON`, `CATEGORY_KEYS`,
and `pipeline-config.ts`:

| Job | Cadence | Calls/wk | Searches/wk |
|---|---|---|---|
| `weekly-research` near band (7 cats × 8) | weekly | 7 | 56 |
| `weekly-research` venue sweeps (10 shards × 10) | weekly | 10 | 100 |
| `weekly-research` mid band (7 × 6) | biweekly | 3.5 | 21 |
| `weekly-research` far band (7 × 4) | every 3rd wk | 2.3 | 9 |
| `verify-events` (batches of 8, 12 searches each) | weekly | 5–25 | 60–300 |
| `check-reports` | every 2h, only when reports pend | ~0 | ~0 |
| **Total** | | **28–48** | **246–486** |

That is roughly **1,070–2,100 web searches a month**.

**Where the money is, in order:**

1. **Web-search results entering context as input tokens.** The dominant line,
   and the least visible one. Unique per request, so nothing caches it.
2. **The web-search fee: $10 per 1,000 searches — about $10.70–$21.00/month.**
   Billed *on top of* tokens. No model choice, no cache, no batch discount is
   known to touch it. The only lever is making fewer searches.
3. **Output tokens** — ~3K per call across 120–210 calls/month.

Rough total **$27–49/month**, most of it search-driven. Treat the range as a
placeholder until the usage log lands.

## Ranked shortlist

Ranked by savings ceiling, **not** application order.

| Lever | Type | Savings ceiling | Data source |
|---|---|---|---|
| Batch API on `weekly-research` | free win | ~50% of that job's tokens | code estimate |
| `web_search_20260209` dynamic filtering | free win | a share of the biggest input line | code estimate |
| Fewer searches (`maxSearchUses`) | **tradeoff** | the whole $10.70–$21/mo fee, pro rata | code estimate |
| Sonnet 4.6 → Sonnet 5 | ~neutral | **~6%, measured** | measured |
| Prompt caching | **none** | **zero — measured** | measured |

## Why the obvious levers don't apply here

### Prompt caching is worth nothing on this workload — measured

Caching is the first thing every cost guide recommends, and it cannot help here.
Three independent reasons, each measured on 7 Sep 2026 with `count_tokens`:

- **The shared prefix across the 7 category prompts is 11 tokens** — the string
  `"You are the "`. The category name and both dates are interpolated into
  line 1, so there is essentially no common prefix to cache.
- **Even fully restructured** — hoisting every volatile line out and putting the
  static rules block first — the shareable block is **757 tokens**. Sonnet's
  minimum cacheable prefix is **1,024**. Below that a `cache_control` marker
  caches *nothing*, silently: no error, just `cache_creation_input_tokens: 0`.
- **Every call is single-turn.** Caching earns its keep on agent loops that
  resend a growing history each turn. Nothing here has a second turn.

Do not spend a day adding `cache_control` to these calls. It would read as a
no-op at best and a 1.25x write surcharge at worst.

### Sonnet 5 is a quality upgrade, not a cost saving — measured

The price table makes it look like a free 33% cut: Sonnet 4.6 is $3/$15 per
MTok, Sonnet 5 is $2/$10. But models from 4.7 onward use a newer tokenizer that
emits more tokens for the same text. Measured on this project's own research
prompt:

| Model | Tokens for the identical prompt | $/MTok in | Cost for that prompt |
|---|---|---|---|
| `claude-sonnet-4-6` | 1,040 | $3 | $0.00312 |
| `claude-sonnet-5` | 1,467 (**+41%**) | $2 | $0.00293 |

**Net: about 6% cheaper, not 33%.** Sonnet 5 is still the better model and worth
migrating to on quality — but budget it as roughly cost-neutral, and do not
count a third of the bill that isn't there. `lib/__tests__/api-usage.test.ts`
pins this arithmetic so the 33% headline doesn't get re-derived later.

**Migration trap if you do move:** on Sonnet 4.6, omitting `thinking` means no
thinking. On Sonnet 5, omitting it runs **adaptive thinking**, and those tokens
bill as output. A naive model-string swap would quietly *raise* the bill. Pair
the swap with `output_config: { effort: "low" }` — these are extraction tasks,
not reasoning-ceiling work.

## Proposed changes

### 1. Usage logging — free win, **applied**

`lib/api-usage.ts` + `logUsage()` at all four call sites. One grep-able line per
call with token counts, search count, and an estimated dollar figure:

```
[usage] research:music · claude-sonnet-4-6 · in 48213 out 3102 cache r0/w0 · $0.1911 (tokens $0.1111 + 8 search $0.08)
```

Design notes: an unknown model reports `$?`, never `$0.00` (a false zero hides
spend); every function is total and `logUsage` swallows throws, because under
rule 1 an instrument must never kill the run it measures. The web-search fee is
carried at full price under batch — the pricing page grants 50% on input and
output tokens and says nothing about server-tool fees, so assuming the discount
would under-report the bill.

Also collapsed four hardcoded `"claude-sonnet-4-6"` literals into one `MODEL`
constant — the audit had to grep eight files to answer "what are we running on".

**Sum a real run with:** `grep '\[usage\]' <actions-log>`

### 2. Batch the weekly research pipeline — free win, **proposed**

50% off input *and* output tokens, no quality change. Nobody is waiting: the
pipeline runs Monday 06:00 and the digest goes Thursday.

Confirmed against the batch docs: **server tools work in batches** — "the batch
worker runs the same server-side agentic loop as the synchronous Messages API",
and it additionally throttles `web_search` per organization so a concurrent
batch doesn't exhaust the rate limit.

A second benefit that has nothing to do with cost: `stream` is not supported in
batch and is not needed — the batch worker owns the long-running call. That
retires the `.stream()` + `timeout: 600_000` + "Premature close" workaround, and
removes the failure mode that killed the Jul 14 run when the Actions timeout cut
it off mid-flight.

Shape: build all ~23 requests, submit one batch, poll, then run the existing
per-category processing over the results. Most batches finish in under an hour;
expiry is 24h. The cost is wall-clock — either the workflow waits (simple, burns
Actions minutes) or it splits into submit + a later poll job (cheaper, more
moving parts).

### 3. ⚠ Do NOT batch `verify-events` without capping it first

`DEFAULT_CAP` is **200** events, but the job never reaches it — a wall-clock
time budget stops it after ~5 batches. **That time budget is currently acting as
an accidental cost cap.** Batching removes it: all ~25 batches would submit at
once, taking searches from ~60/wk to ~300/wk. At $10/1,000 that is roughly
**+$10/month in search fees alone** — batching this job would make the bill go
*up*.

If you want verify batched, set an explicit event cap first and size it
deliberately, rather than inheriting whatever the clock allowed.

### 4. `web_search_20250305` → `web_search_20260209` — free win, **proposed**

The newer variant does dynamic filtering, which keeps page boilerplate out of
context — aimed squarely at the biggest input line. Available on Sonnet 4.6
today, so it does not require the model migration. Code execution runs under the
hood and is **free when used with web search**, so it adds no charge — but do
not also declare `code_execution` in `tools` (two execution environments
confuse the model).

Needs a before/after on the usage log to confirm it cuts tokens without cutting
recall. That is what §1 is for.

### 5. Fewer searches — **tradeoff, needs an eval**

The only lever on the $10.70–$21/month fee line. `maxSearchUses` is 8/6/4 by
band and `VENUE_SWEEP_SEARCHES` is 10. Cutting these cuts the fee pro rata and
cuts coverage with it. Given that exhaustive coverage is the product, this is
listed for completeness and **not recommended** without an eval that can show
what the lost searches were finding.

## Levers skipped

| Lever | Why |
|---|---|
| Prompt caching | Measured: 11-token shared prefix, 757 even restructured, below the 1,024 minimum. Single-turn calls. |
| Context editing / compaction | No multi-turn loops exist. |
| Tool search / `defer_loading` | One tool per request; pays above ~10K schema tokens. |
| Cheaper model (Haiku) | Would need an eval, and the fee line dominates anyway. |
| Files API + code execution | Nothing to mount or compute over. |
| `max_tokens` reduction | It is a backstop, not a knob — capping truncates mid-JSON and buys a retry. |

## Next step

1. Let one Monday run write `[usage]` lines, then sum them. That turns this
   document's ranges into the real bill and re-ranks everything above.
2. With that in hand, decide on batching the research pipeline (§2) — the only
   change here with a material, quality-free saving.
3. If the Console shows a monthly figure meaningfully different from $27–49,
   say so — the shortlist is sized off that estimate.
