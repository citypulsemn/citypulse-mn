# Deploy — the week-over-week baseline was this morning's own row

**3 November 2026.** Every week-over-week figure the ops digest printed after a
Monday send was comparing today against a few hours ago. One pure predicate, one
query helper, three call sites rewired. No schema change, no data change, no new
secret, no new dependency. Deploy is a push.

## What was wrong

`lib/ops-inputs.ts` held **three byte-identical copies** of:

```sql
select totals from ops_digest_runs order by sent_at desc limit 1
```

at `:100` (engagement totals), `:279` (sitemap URLs) and `:303` (GSC
impressions). `ops_digest_runs` gains a row on every real send, and the Monday
Actions job writes its row at ~09:01. So any read later that day picked up
**that row** as "last week":

- a `npm run ops-digest -- --dry-run`
- a second Actions run
- **any load of `/admin/ops`**, which shares `gatherOpsInputs` by design

Dry runs do not write a row (`scripts/send-ops-digest.ts` records only on a real
send), so the pollution came from the scheduled send itself — which is why this
only ever misfired on the day the numbers mattered most.

### What it cost, measured

The 2 Nov dry run printed this:

```
- views 581 (+2% WoW) · ticket clicks 126 (+3% WoW)
- saves 1 (±0%) · calendar adds 0 (±0%)
- 1409 URLs in the live sitemap (±0%)
```

The same instrument, same stored rows, with the guard in place:

```
- views 579 (-55% WoW) · ticket clicks 131 (-67% WoW)
- saves 1 (-83% WoW) · calendar adds 0 (±0%)
- 1408 URLs in the live sitemap (-7% WoW)
```

The real week, from `ops_digest_runs.totals`:

| | 26 Oct | 2 Nov | reported as |
|---|---|---|---|
| views | 1,294 | 569 | **+2% WoW** |
| ticket clicks | 403 | 122 | **+3% WoW** |
| sitemap URLs | 1,508 | 1,409 | **±0%** |
| GSC impressions | 20,954 | 13,672 | **±0%** |

It did not grey out. It printed a confident near-zero delta across a week in
which views more than halved and the indexed surface fell 7% — on top of a
decline from 2,242 sitemap URLs on 7 Sep. **A partial measurement must not
render as a pass**, and this was worse than partial: it was a measurement of
itself.

## The shape of the fix

### One definition, not three patches

The obvious fix is `where sent_at < now() - interval '3 days'` three times. That
is the smaller diff and it is the wrong one — three copies of the query is
precisely *how* the engagement baseline and the sitemap baseline came to report
the same lie independently. The house rule from `docs/HANDOFF.md` applies: *one
definition of a rule*, the way the dedupe gate imports the self-check's own
predicate rather than restating it.

So: a pure predicate in `lib/ops-digest.ts`, one query helper in
`lib/ops-inputs.ts`, three callers.

```ts
export const BASELINE_MIN_AGE_HOURS = 72;
export type BaselineRow = { age_seconds: number; totals: unknown };
export function pickBaseline(rows, minAgeSeconds = BASELINE_MIN_AGE_HOURS * 3600)
```

### Why the database computes the age

`pickBaseline` takes `age_seconds`, not a timestamp. The query is
`extract(epoch from (now() - sent_at))::float8`, so there is **no timestamp
parameter to get wrong** — the postgres.js gotcha (a param shifting +5h unless
cast `::text` before `::timestamp at time zone`) cannot reach this code. It also
makes the predicate trivially pure and testable with no database at all.

### Why 72 hours

Past any same-day or next-day re-run, well short of the 7-day cadence, and the
same number `STALE_REPORT_DAYS` already uses. A send that genuinely lands 2 days
after another will skip it and compare against the week before — a couple of
days stale, but honest, which "WoW" cannot be against a 2-day-old row.

### Why `limit 8` and not `limit 1`

One row is not enough once rows can be rejected: five manual runs in a day would
exhaust a `limit 1` read and report "first report". Eight covers a full day of
re-runs at the weekly cadence.

### Why the three callers stayed separate

Each keeps its own `wrap` key — `engagement_prev`, `index_prev`, `search_prev`.
Hoisting them into one shared read would have been fewer queries and would have
**regressed the R2.3 contract**: those keys exist precisely so a failed read of
last week's numbers degrades one line instead of blanking a section that is
otherwise reporting fine. Three cheap indexed reads of a nine-row table is the
right trade.

### A bug fixed in passing

`pickBaseline` **skips** an old-enough row whose totals do not parse and tries
the next one, rather than ending the search. The old code took row 1 and gave
up: the double-stringified rows `parseStoredTotals` was written for would pin the
report to "first report" forever, which is the same class of silent failure.

## It was proved to fail, not assumed to

Each case was run as a mutation against the new guard:

| mutation | result | wanted |
|---|---|---|
| unmutated | GREEN | GREEN |
| **no age guard at all (the old behaviour)** | **RED** | RED |
| age guard inverted | **RED** | RED |
| boundary off by one (`<=` for `<`) | **RED** | RED |
| unparseable row ends the search | **RED** | RED |
| non-finite age trusted | **RED** | RED |

`lib/ops-digest.ts` restored byte-identical afterwards (verified).

## What shipped

| file | change |
|---|---|
| [lib/ops-digest.ts](../../lib/ops-digest.ts) | `BASELINE_MIN_AGE_HOURS`, `BaselineRow`, `pickBaseline()` — pure, the one definition |
| [lib/ops-inputs.ts](../../lib/ops-inputs.ts) | one `prevRunTotals()` helper; the three baseline reads call it; the `parseStoredTotals` import replaced by `pickBaseline` |
| `lib/__tests__/ops-digest.test.ts` | +9 golden tests and +1 gather-side tripwire |
| `docs/OPS-DIGEST.md` | the baseline line now says the guard exists |

The tripwire asserts the bare `limit 1` query is gone and that `prevRunTotals()`
appears exactly four times — one declaration, three callers — so a fourth
baseline read cannot quietly grow its own copy.

## Quality gate

- `npx tsc --noEmit` — clean
- `npm test` — **149 files, 2,964 tests** (2,954 → 2,964), green
- `npm run build` — clean
- `npm audit` — **0 vulnerabilities**
- Mutation-tested in six directions (table above), including the exact old behaviour

## Deploy

1. Push to `main`. Vercel auto-deploys.
2. Nothing else. No secret, no migration, no data step.

The next scheduled run is Monday 9 Nov (`ops-digest.yml`). `/admin/ops` is
correct the moment the deploy lands.

## Verify

Observable immediately, no waiting for Monday:

```bash
npm run ops-digest -- --dry-run
```

The Engagement and Index surface lines must show real deltas, not `±0%`:

- `views 579 (-55% WoW)` — not `(+2% WoW)`
- `1408 URLs in the live sitemap (-7% WoW)` — not `(±0%)`

Then load `/admin/ops` and confirm the same two sections read the same way; the
page and the email share `gatherOpsInputs`, and a test pins that they cannot
drift.

## Rollback

`git revert` and push. Purely additive in `lib/ops-digest.ts`; reverting
restores the three inline queries. No data to undo — `ops_digest_runs` is
untouched, and every historical row stays exactly as written.

## Left open

- **Nothing alerts on a WoW collapse.** `buildSections` sets `alert = true` for
  Engagement (`lib/ops-digest.ts:523`) and Index surface (`:573`) **only when the
  read fails**. The 3 Nov digest reports views −55%, ticket clicks −67% and the
  sitemap −7%, and its subject line still says `⚠️ 3 alerts` — Coverage, Queue
  and Self-check, the same three as before. The number is now honest; the email
  still does not escalate it. A threshold here is a judgement call (how big a
  drop, over how many weeks, and seasonality is real — Halloween and a one-week
  Restaurant Week listing carried much of October), so it is Taren's to set.
- **The decline itself is undiagnosed.** Pipeline intake has fallen from 534
  rows/week (17 Aug) to 122 (2 Nov) while run duration halved, 44 min → 18 min.
  `cost_searches` tracks intake closely, so the pipeline is doing less work per
  run rather than finding less per unit of work. That is the next question, and
  it is not this change.
