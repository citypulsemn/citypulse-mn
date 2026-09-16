# Deploy — the ops dashboard (`/admin/ops`)

One screen that answers "is anything wrong right now?" — the Monday ops email on
demand, plus the half of the system our own database cannot see.

## What shipped

**`/admin/ops`** — a new admin tab, first in the row. Two halves:

1. **Outside services** — six tiles: GitHub Actions, Vercel, Supabase, Resend,
   Anthropic, and Weekly email. Colour plus a word, never colour alone.
2. **The calendar itself** — every section the Monday ops email already reports
   (pipeline, coverage, verification, engagement, queue, self-check, …),
   alerting sections first and open.

### The design decision that matters

The page calls **the same `gatherOpsInputs` and the same `buildSections`** the
email uses. `gather()` moved out of `scripts/send-ops-digest.ts` into
`lib/ops-inputs.ts`; the sender now imports it. There is one gatherer and one
formatter, so the page and the email cannot drift — and a test enforces it
(`the gatherer and the page cannot drift apart`).

### The rule the vendor tiles are built around

**A probe that could not run is never green.** No token, a 500 from the vendor,
a timeout, an unexpected response shape — all render as a grey `unknown` tile,
and `unknown` counts toward "things to look at". A dashboard that shows green
when its own probe is broken is worse than no dashboard, because it buys your
silence. 27 tests in `lib/__tests__/vendor-health.test.ts`, and the largest
block of them is exactly this.

This is why the tiles exist at all. Everything the ops email reads lives in our
Postgres; every recent incident lived somewhere else and was silent —
Supabase egress over plan (found via 402s), Vercel CPU at 4h16m against a 4h
limit, GitHub dropping ~60% of scheduled runs, the report-checker email not
sending for days because an unset Actions secret is `""` and not `undefined`.

## Files

| File | What |
|---|---|
| `lib/ops-inputs.ts` | **moved** from the sender's private `gather()`; unchanged behaviour |
| `lib/vendor-health.ts` | pure: `judgeUsage`, `judgeCron`, `judgeDelivery`, `worstStatus`, `summarise`, `unknownTile` |
| `lib/vendors.ts` | the five probes; never throws, never green when blind |
| `app/admin/ops/page.tsx` | the screen |
| `lib/api-usage.ts` | **added** `recordUsage` / `runUsageTotals` — in-process spend accumulator |
| `scripts/run-pipeline.ts` | writes the run's cost once, at the end |
| `db/schema.sql` | `pipeline_runs.cost_usd`, `.cost_searches`, `.cost_unpriced_calls` |
| `components/admin/AdminTabs.tsx` | the Ops tab |
| `app/globals.css` | `.ops-*` |

## Deploy steps

1. **Merge and push.** Vercel deploys from `main` as usual.
2. **Apply the schema.** Already applied to production on 13 Sep 2026; the
   statements are additive and idempotent, so re-running is safe:
   ```sql
   alter table pipeline_runs add column if not exists cost_usd numeric(10,4);
   alter table pipeline_runs add column if not exists cost_searches integer;
   alter table pipeline_runs add column if not exists cost_unpriced_calls integer;
   ```
3. **Open `/admin/ops`.** It works immediately — Supabase is green and the other
   four read `unknown` until you add tokens. That is correct behaviour, not a
   bug.

## Turning the grey tiles green

Each is optional and independent. Add to **Vercel → Settings → Environment
Variables** (Production), and to **GitHub → Settings → Secrets** only if you
want the same tiles inside Actions.

| Variable | Where to get it | Turns on |
|---|---|---|
| `GITHUB_TOKEN` | github.com → Settings → Developer settings → Personal access tokens → fine-grained, repo `citypulse-mn`, **Actions: read** | did the weekly pipeline actually fire, and pass |
| `RESEND_API_KEY` | already a secret — just add it to Vercel too | sending-domain verification |
| `VERCEL_API_TOKEN` | vercel.com → Settings → Tokens | month-to-date spend |
| `VERCEL_TEAM_ID` | only if the project sits under a team | scopes the billing query |

Optional thresholds — without them the tile reports the number and stays
neutral rather than inventing a cliff:

| Variable | Default | Effect |
|---|---|---|
| `SUPABASE_DISK_LIMIT_GB` | `8` | amber at 80% of it, red at 100% |
| `VERCEL_BUDGET_USD` | none | amber/red against your budget |
| `ANTHROPIC_BUDGET_USD` | none | same, for research spend |

### What is deliberately NOT here

- **Supabase egress** has no clean Management API endpoint — it is visible only
  on the billing dashboard. The tile says so instead of pretending disk size is
  the whole story.
- **Vercel Active CPU** is not exposed as a usage gauge; `/v1/billing/charges`
  gives cost. The tile tracks cost.
- **Weekly email** is not an outside service, but it fails like one — it needs
  GitHub's scheduler to fire and Resend to accept the batch, and when either
  lets go the evidence is an absence. It uses the Monday email's own
  `DIGEST_STALE_DAYS`, passed in rather than duplicated, so the tile and the
  report can never disagree about what "missed" means. Added 16 Sep 2026 after
  a 6 Aug miss went unnoticed as a sentence in a paragraph.
- **Anthropic** has no usage API for a non-admin key, so that tile is **our**
  measurement of **our** pipeline calls. It reads `$0.00` until the next weekly
  run writes the first priced row.

## The spinner bug (14 Sep 2026)

The first version awaited both gathers before rendering anything. In production
it span forever: ~20 sequential queries plus five HTTP calls behind one `await`
is a page with no floor on how slow it can get, and a spinner is the least
useful thing an ops screen can show — the moment you need it is the moment
something is already wrong. Each probe had a 6s ceiling; the page had none.

Fixed three ways, all in `app/admin/ops/page.tsx`:

- **Streaming.** Each half is its own `<Suspense>` boundary, so the shell paints
  immediately (measured TTFB 0.09s warm) and each section fills in when ready.
- **Deadlines.** `withDeadline` (lib/vendor-health.ts) caps the vendor half at 8s
  and the calendar half at 15s. Overrunning renders "no answer within Ns" —
  the same rule as the tiles: could-not-tell is an answer, not a wait.
- **`export const maxDuration = 30`** so the platform kills it rather than
  letting it run.

## Verify checklist

- [ ] `/admin/ops` paints the header immediately, then fills in — never a bare spinner
- [ ] Supabase tile is green with a real disk figure
- [ ] Any service without a token shows **grey `UNKNOWN`**, not green
- [ ] Alerting sections sort above healthy ones
- [ ] On a phone, tiles are one column and readable without zooming
- [ ] `npm run ops-digest -- --dry-run` still prints the same report

## Rollback

Nothing here changes reader-facing pages or the pipeline's behaviour.

- Remove the Ops tab entry in `components/admin/AdminTabs.tsx` to hide it.
- Revert the commit to remove the page entirely. `lib/ops-inputs.ts` is a pure
  move — reverting restores `gather()` to the sender.
- The three `pipeline_runs` columns are nullable and additive; leave them.
