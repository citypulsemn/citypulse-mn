# Deploy — a falling number now raises a flag

**3 November 2026.** The age guard shipped earlier today made the week-over-week
figures honest. Nothing escalated them, so a halved week printed in black text
and the subject line still said `⚠️ 3 alerts`. This adds the escalation. Two pure
functions, one new aux read, two sections wired. No schema change, no data
change, no new secret, no new dependency. Deploy is a push.

## The brief said "a WoW drop threshold". The data says that is the wrong shape

A single-week threshold is the obvious fix and it fails in both directions at
once. Measured against the 16 weeks in `ops_digest_runs`:

**At -50% it cries wolf.** It would have fired three times — twice on views
(-56% on 12 Oct, -56% on 2 Nov) and once on ticket clicks (-70% on 2 Nov). All
three are the calendar, not a defect: a Halloween ramp and a one-week
mspmag Restaurant Week listing that carried 568 ticket clicks on its own. This
email has one reader; an alarm that is usually wrong is an alarm that gets
ignored, and there is a whole section of `docs/ENGINEERING.md` about that.

**And it would have missed the thing that prompted it entirely.** The sitemap
fell from 2,242 URLs on 7 Sep to 1,409 on 2 Nov — 37% of our own published
surface — and in that whole slide **no single week ever dropped more than 11%**.
A WoW threshold tight enough to catch it would fire constantly on views.

So: three rules, each calibrated against the real series rather than chosen.

| | value | historical fires | what it is for |
|---|---|---|---|
| `cliffPct` | **-80%** | **0** across all four metrics | the instrument died, not a quiet week |
| `slideWeeks` | **4** | 0 on views/tickets · 3 sitemap · 1 impressions | a steady bleed |
| `windowWeeks`/`windowPct` | **8 weeks / -25%**, opt-in | 3 sitemap · 1 impressions | a slide that a bounce reset |

### Why -80% for the cliff

The steepest real weekly drops in the whole history are views -56%, ticket
clicks -70%, sitemap -11%, impressions -35%. A fall past -80% has never
happened, so it does not mean "a bad week" — it means a beacon stopped firing or
a sitemap stopped generating. Its wording says so: *check the instrument before
the business.*

### Why 4 weeks for the slide

**Views have never fallen more than 2 weeks running, and ticket clicks never
more than 1, in 16 weeks.** So four consecutive declines cannot be noise on the
seasonal pair — the rule is self-calibrating there. The sitemap, meanwhile, ran
**six** down weeks (7 Sep → 19 Oct) and impressions four (14 Sep → 12 Oct). This
rule would have raised the sitemap on the **5 Oct send, five weeks before anyone
noticed it by hand.**

### Why the window rule is opt-in, and only the Index surface passes it

A streak resets on one good week. The sitemap's six-week slide was broken by a
single +1% week on 26 Oct, so by 2 Nov the streak read **1** while the surface
was still down 37% from September. The cumulative rule catches that.

It cannot be applied to views or ticket clicks. Measured over the same history
it fires on both *today* — views -63%, ticket clicks -61% over 8 weeks — and
that is the Halloween calendar emptying. Our own published surface has no such
excuse: a sitemap that loses a quarter of its URLs in two months is a supply
problem in any season. A test pins this asymmetry deliberately, so nobody
"tidies" the option away.

## The shape

`lib/ops-digest.ts`, both pure:

```ts
export function baselineSeries(rows, minAgeSeconds?): Record<string, number>[]
export function declineReason(label, series, opts?: { window?: boolean }): string | null
```

`baselineSeries` is the age-guarded history; `pickBaseline` is now **its first
entry**, so the guard that shipped this morning still has exactly one
definition. `declineReason` takes the series newest-first with element 0 the
live number, reports the most acute finding first (cliff → slide → window), and
**stops reading at the first non-finite value** — a gap in the history is not a
decline, and judging across a hole would invent one.

`OpsInputs` gains `prevSeries`, read under its own `wrap` key
(`baseline_series`) like every other aux read. If it fails, both sections lose
their trend line and keep every number they were already reporting;
`declineReason` is silent on an empty series, so the degradation needs no
special case. That is the R2.3 contract, and a test holds it.

### A bug caught before it shipped

The first version read `limit 8` — exactly `windowWeeks`. Today's own send is
excluded as too new, so the read came back with **7 usable rows, one short**, and
the window rule written for the sitemap decline would not have fired on the
sitemap decline. `BASELINE_READ_ROWS` is now derived (`windowWeeks + 8`) so
raising the window cannot reintroduce it, and a test asserts the read is strictly
larger than the window needs.

## It was proved to fail, not assumed to

Fourteen mutations, every one caught:

| mutation | result |
|---|---|
| unmutated | GREEN |
| cliff loosened to -50% (the 3 historical false alarms) | **RED** |
| cliff tightened to -95% | **RED** |
| slide loosened to 3 weeks | **RED** |
| slide tightened to 5 weeks | **RED** |
| window loosened to -10% | **RED** |
| window tightened to -70% | **RED** |
| window rule always on (opt-in removed) | **RED** |
| judges across a gap in the history | **RED** |
| a flat week counts as a decline | **RED** |
| the cliff never fires | **RED** |
| the slide never fires | **RED** |
| **Engagement finds the reason but does not alert** | **RED** |
| **Index surface finds the reason but does not alert** | **RED** |

The last two matter most: "reports it but does not escalate it" is the exact bug
this change exists to fix, so it had to be impossible to reintroduce.
`lib/ops-digest.ts` restored byte-identical afterwards.

The calibration itself is a test, not a comment. `REAL` in
`lib/__tests__/ops-digest.test.ts` holds the production series, and one case
walks **every window of the real history** asserting views and ticket clicks stay
silent. Loosening a threshold turns it red.

## What shipped

| file | change |
|---|---|
| [lib/ops-digest.ts](../../lib/ops-digest.ts) | `baselineSeries`, `DECLINE`, `BASELINE_READ_ROWS`, `declineReason`; `pickBaseline` delegates; Engagement and Index surface escalate |
| [lib/ops-inputs.ts](../../lib/ops-inputs.ts) | `baselineRows()` shared by two readers; `prevRunSeries()`; the `baseline_series` wrap |
| `lib/__tests__/ops-digest.test.ts` | +23 tests incl. three calibration cases against the real series, and a gather-side tripwire |
| `lib/__tests__/subscribe-source.test.ts` | the second `OpsInputs` fixture gains `prevSeries` |

## Quality gate

- `npx tsc --noEmit` — clean
- `npm test` — **149 files, 2,987 tests** (2,964 → 2,987), green
- `npm run build` — clean
- `npm audit` — **0 vulnerabilities**
- Mutation-tested in fourteen directions (table above)

## Deploy

1. Push to `main`. Vercel auto-deploys.
2. Nothing else. No secret, no migration, no data step.

## Verify

Observable immediately:

```bash
npm run ops-digest -- --dry-run
```

Measured on the live instrument before this change and after:

```
before   ⚠️ City Pulse ops — 3 alerts (Nov 3)
         ## Index surface
         - 1408 URLs in the live sitemap (-7% WoW)

after    ⚠️ City Pulse ops — 4 alerts (Nov 3)
         ## Index surface ⚠️
         - 1408 URLs in the live sitemap (-7% WoW)
         - the sitemap is down 37% over 8 weeks, 2242 → 1408
```

**Engagement correctly does NOT alert** at views -55% and ticket clicks -67%.
That is the calibration working, not a miss: both are inside normal seasonal
range for this site, and neither has ever fallen four weeks running.

GSC impressions cannot be checked locally — `GSC_SERVICE_ACCOUNT_JSON` lives
only in Actions — so `inputs.search` is null here and that half of the Index
rule is exercised by tests rather than by this run. It will read live on the
Monday send, where impressions are 13,672 against 29,056 eight weeks ago and
should add a second line.

## Rollback

`git revert` and push. Additive in `lib/ops-digest.ts` apart from `pickBaseline`
delegating to `baselineSeries`; reverting restores both. No data to undo.

## Left open

- **Nothing here diagnoses the decline, only reports it.** Pipeline intake has
  fallen from 534 rows/week (17 Aug) to 122 (2 Nov) while run duration halved,
  44 min → 18 min, and `cost_searches` tracks intake — so the pipeline is doing
  less work per run rather than finding less per unit of work. That is the next
  question.
- **The thresholds are calibrated on 16 weeks of one site's data**, 11 of which
  have impressions. They are a floor on evidence, not a law; re-read them once
  there is a year of history, and especially after a full seasonal cycle.
- **A recovery is not announced.** The alert clears silently when the number
  turns around. That is probably right for an email with one reader, but it does
  mean "no alert" and "recovered" look identical.
