# Deploy — the ops digest reads the run's own verdict, not just the row a step wrote

**3 November 2026.** On four consecutive October Mondays the "Weekly Event
Research" workflow failed and the Monday email reported the pipeline healthy.
This adds a Jobs section that reads each watched workflow's own conclusion. One
new module, one new section, one new aux read, two lines of workflow
configuration. No schema change, no data change, no new dependency.

## What the gap cost

| | |
|---|---|
| **Oct 5, 12, 19, 26** | `weekly-research.yml` → **failure** |
| `pipeline_runs.ok` | **`true`** on all four |
| What the digest said | pipeline healthy, four Mondays running |

The pipeline *step* succeeded every time. What died was a later step —
`import-sports`, a `//` comment inside a SQL tagged template (Postgres 42601 at
`scripts/import-sports.ts:261`) — and at those commits the steps after it carried
no `if:` guard, so GitHub skipped them, including **"Check every listing against
the page it cites"**.

Pages source-checked per week:

```
09-28  321      10-05  0      10-12  0      10-19  0      10-26  49      11-02  491
```

Three weeks with the fabrication check off, on a site that has had two
reader-caught fabrications. Meanwhile the verify pass — its own workflow — kept
stamping 110–212 events verified per week, so confirmations kept flowing while
the thing that cross-examines citations was dead. The 28 Oct Toddler Music Lab
incident sits inside that window.

**The cause is already fixed** (`fc7c22f`, 26 Oct: the SQL comment, plus
`if: ${{ !cancelled() }}` on the downstream steps so one failure cannot cascade
again). This change removes the *blindness*, which is the part that let it run
for a month.

The lesson is the same one twice now: **the instrument was reading a table the
failing step never reached.** A row written by a step cannot report the step that
never ran. The run's own conclusion can.

## The shape

`lib/actions-health.ts` — plain `fetch`, no SDK (the standing `npm audit` 0
rule), modelled on `lib/search-console.ts`:

```ts
export const WATCHED_WORKFLOWS   // the four SCHEDULED workflows
export function parseWorkflowRuns(raw): WorkflowRun[]        // pure
export function judgeActions(health): {lines, alert}         // pure
export function actionsConfigured(token?): boolean           // pure
export async function getActionsHealth(token?, repo?)        // I/O, null when unconfigured
```

### What it watches, and what it deliberately does not

`weekly-research`, `weekly-digest`, `verify-events`, `check-reports` — the four
on a `schedule`. Manual-only workflows (`gsc-report`, `purge-cache`) are absent:
a dispatch someone ran once and abandoned is not news. **`ops-digest` itself is
absent** because it is mid-run while it reports, so its own conclusion is always
`null` and would read as a permanent unknown. A test pins all three choices.

### "Not configured" and "failed to read" are different states

This is the one place the design deviates from the GSC pattern, deliberately.

`/admin/ops` renders on Vercel, where there is no GitHub token and never needs to
be one. An unconfigured read must therefore be a **quiet** line — otherwise the
panel alarms forever and the alarm stops meaning anything. But a read that *was*
configured and then timed out is a real failure, and letting it degrade to the
same quiet null would recreate exactly the blindness this section exists to end.

So the gather checks configuration **before** applying the deadline, and a
timeout throws:

```ts
if (!actionsConfigured()) return null;            // quiet: no token here
const got = await withDeadline(getActionsHealth().then(...), ACTIONS_BUDGET_MS, { read: false });
if (!got.read) throw new Error("GitHub Actions read timed out");   // alerts
```

(`withDeadline<T>`'s fallback must share the promise's type and `null` was
already taken, hence the tagged result rather than a sentinel.) A source-grep
tripwire pins this, because the tempting simplification is the bug.

### What it prints

All green collapses to **one** line — the operator reads this on a phone, and
four green lines every week is how a section becomes scenery. Only trouble is
named:

- latest run bad → `weekly research — LAST RUN FAILURE (Oct 26) → <url>`, **alert**
- latest ok, earlier ones bad → `weekly research — last run ok, but 4 of the last 5 failed`, no alert
- no runs at all → `NO RUNS RECORDED`, **alert** (a cron GitHub quietly disabled)
- run in progress (`conclusion: null`) → not a failure

`cancelled` counts as bad: the 14 July pipeline was cancelled by GitHub's own
timeout mid-flight and recorded `ok=false` with nothing upserted, which is
precisely the shape worth seeing on a Monday.

## Verified against the real API, not a mock

Live read, 3 Nov, through the real endpoint with a real token:

```
weekly research   success  failure  failure  failure  failure
subscriber email  success  success  success  success  success
verify pass       success  success  success  success  success
report checker    success  success  success  success  success

Jobs
- weekly research — last run ok, but 4 of the last 5 failed      alert: false
```

Then end to end through `npm run ops-digest -- --dry-run`:

```
## Pipeline
- ok ✓ — 122 upserted (-169) · 3 deduped (-9) · 7 collapsed (-4) · 192 archived (+37)

## Jobs
- weekly research — last run ok, but 4 of the last 5 failed
```

`alert: false` is the right answer today: the latest run is green because
`fc7c22f` fixed it. **Had this section existed on 5 October it would have read
`weekly research — LAST RUN FAILURE (Oct 5) → …` and added an alert to the
subject line** — which is the whole point.

And the unconfigured path, run without the env file:

```
lines: ["not reported here — no GitHub token in this environment"]
alert: false
```

The test fixture is the real API response for those five runs, not an invented
one — the rule this project paid for when a duplicate-detection test passed on a
title shortened by hand while the production string failed.

## It was proved to fail, not assumed to

Nine mutations, every one caught:

| mutation | result |
|---|---|
| unmutated | GREEN |
| not-configured alerts (would make `/admin/ops` shout forever) | **RED** |
| no runs recorded treated as a pass | **RED** |
| `cancelled` no longer counts as bad | **RED** |
| a run still in progress counts as a failure | **RED** |
| the flapping-job line also alerts | **RED** |
| an undated run is kept instead of dropped | **RED** |
| all-green prints a line per workflow | **RED** |
| the Jobs section reports but does not alert | **RED** |
| **a timed-out read degrades to the quiet not-configured null** | **RED** |

All three touched files restored byte-identical afterwards.

Two real bugs were caught by these tests while writing them: `getActionsHealth`'s
`repo` parameter has a default, so passing `undefined` resolves to the default
and the `!repo` guard was unreachable — and the assertion written to prove the
short-circuit was itself making a live network call from a unit test.

## What shipped

| file | change |
|---|---|
| [lib/actions-health.ts](../../lib/actions-health.ts) | **new** — the watch list, the pure parser and judge, the live read |
| [lib/ops-digest.ts](../../lib/ops-digest.ts) | `OpsInputs.actions`; the Jobs section, placed directly after Pipeline |
| [lib/ops-inputs.ts](../../lib/ops-inputs.ts) | the `actions` wrap: configured-check first, deadline second, timeout throws |
| [.github/workflows/ops-digest.yml](../../.github/workflows/ops-digest.yml) | `permissions: contents+actions: read`, and `GITHUB_TOKEN`/`GITHUB_REPOSITORY` in env |
| `lib/__tests__/actions-health.test.ts` | **new** — 17 golden tests on the real API response |
| `lib/__tests__/ops-digest.test.ts` | +5 section tests, +1 gather tripwire |

**The permissions block is load-bearing.** This repo's default `GITHUB_TOKEN`
grants only contents/metadata/packages read — the `gsc-report` run log prints
them — so reading another workflow's runs needs `actions: read`. And naming a
`permissions:` block *replaces* the default set, which is why `contents: read` is
spelled out too or `actions/checkout` loses access.

## Quality gate

- `npx tsc --noEmit` — clean
- `npm test` — **150 files, 3,010 tests** (2,987 → 3,010), green
- `npm run build` — clean
- `npm audit` — **0 vulnerabilities**
- Mutation-tested in nine directions; live-verified against the real API both configured and not

## Deploy

1. Push to `main`. Vercel auto-deploys the site; the workflow change takes effect
   on the next Actions run.
2. Nothing else. No secret to add — `github.token` is issued automatically.

First real proof is the next ops digest, which fires on `workflow_run: completed`
for Weekly Event Research — Monday 9 Nov.

## Verify

```bash
npm run ops-digest -- --dry-run
```

A `## Jobs` section must appear directly after `## Pipeline`. Locally the token
comes from `.env.local`, so it reads live; without it the section says "not
reported here" and does not alert.

In Actions, confirm the run's log does not contain `section unavailable` for
Jobs — that would mean the `actions: read` permission did not take.

## Rollback

`git revert` and push. `lib/actions-health.ts` is new and nothing else imports
it; the `OpsInputs.actions` field and the section go with the revert. No data to
undo, and the workflow permissions change is inert on its own.

## Left open

- **`/admin/ops` will show "not reported here" for this section.** A GitHub PAT
  with `actions: read` in the Vercel environment would light it up there too.
  That is a real token in a third place, so it is Taren's call, not a default.
- **No cadence check.** A weekly workflow whose latest run is three weeks old
  reads green here, because the rule is "the latest run's conclusion", not "a run
  happened when it should have". GitHub does silently disable schedules on a
  quiet repo, so an expected-interval check per workflow is the obvious next
  step — deliberately not built, because it needs a per-workflow expected
  cadence and this change is already the one item.
- **`check-reports` runs every 30 minutes** on paper (~5/day in practice, per the
  GitHub cron cap), so its five-run window covers only a few hours. A failure
  there is caught only if it is recent or persistent.
