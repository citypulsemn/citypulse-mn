# Deploy — an alarm for the silence that lasted four weeks

**27 Oct 2026.** Code only. No schema change, no secrets, no migration.

## What shipped

`check-sources` — the free weekly fabrication check — was dead for four weeks in
Sep–Oct 2026 behind a broken step in front of it. The only evidence was
`events.source_checked_at` going stale: the newest stamp in the whole table sat
at 28 Sep, and **nothing read that column.** `stalestFirst` sorts the weekly
budget by it; no instrument judged it.

The workflow conclusion *was* `failure` and the `/admin/ops` Actions tile *was*
red, for four Mondays, and neither produced action. So the new verdict goes in
the **Monday ops email**, which is the surface that actually gets opened — on a
phone, at 9pm. `/admin/ops` gets the same verdict as a tile, from the same judge
and the same query, so the page and the email cannot drift.

- `lib/vendor-health.ts` — `judgeSourceSweep(health, schedule, now)` returning
  `{status, lines}`, beside the existing `judgeCron` / `judgeDigest` /
  `judgeCostCoverage` family, plus the pure helpers it rests on: `lastDueAt`,
  `sweepsMissed`, `expectedPages`, `parseStampMs`.
- `lib/source-sweep.ts` (new) — `getSourceSweepHealth()`, the one query, scoped
  to exactly the rows the sweep itself looks at: published, upcoming, http(s).
- `lib/source-presence.ts` — `SWEEP_PAGE_BUDGET = 400` exported, and
  `scripts/check-sources.ts`'s `--limit` default now reads it, so the sweep and
  the alarm cannot disagree about what a full run looks like.
- `lib/ops-digest.ts` — `OpsInputs.sourceSweep`, `SOURCE_SWEEP_SCHEDULE`, and a
  `Source check` section. `buildSections` gained `now: Date = new Date()`
  (defaulted, so every existing caller is unchanged) and `composeOpsDigest`
  passes its own `now`.
- `lib/ops-inputs.ts` — gathered through the existing `wrap` helper, so a failed
  read becomes an alerting "unavailable" section and never a dead email.
- `lib/vendors.ts` — `sourceCheckTile`, registered in `gatherVendorTiles`.

## The first version was wrong twice, in the way it was built to prevent

An adversarial review of the finished code found two HIGH faults that compounded
into exactly the bug this alarm exists to catch: **it read green while the thing
it watched was dead.** Both are fixed; recording them because the reasoning is
the deliverable.

### It judged a stopwatch when the question was a schedule

The age bands were copied from `judgeCron` — late past 1.25 periods, `down` past
two. But the ops digest fires on `workflow_run: completed` for Weekly Event
Research, and `check-sources` is the *last step of that same workflow*. The email
is therefore composed **minutes after the sweep should have run**, so on the
first dead Monday the newest stamp is almost exactly *one* period old, and a
1.25-period grace calls that fine.

Measured before the fix:

```
0 dead Mondays -> OK     1 -> OK     2 -> WARN     3 -> DOWN
```

An alarm for a four-week silence, quiet through three weeks of it. The flagship
test asserted day 28 — an age the email can never observe, since it samples at
7, 14, 21.

Tightening the threshold could not fix it either: `/admin/ops` samples the same
judge **mid-week**, where a Sunday read sits six days after a perfectly healthy
Monday run, so anything tight enough for the email is a false alarm on the page.

So the judge now asks `sweepsMissed` — *has it run since it was last due?* —
with `lastDueAt` computing the Monday 06:00 UTC slot from the cron. That is
correct at every sampling time without either surface needing a looser rule.

### `pagesSwept` counted two runs, so the partial-run half could never fire

The window was a fixed 8 days against a 7-day cadence, so every measurement
carried the previous run's stamps. Combined with the above, on the first dead
Monday the email would have printed:

> `372 of 400 cited pages re-read in the last 8 days (most recent 7d ago)`

on a week when **zero** pages were read. It is anchored to the newest stamp now
(`SWEEP_RUN_WINDOW_HOURS = 24`), which measures one run however long after it
the question is asked — and a window merely *shorter* than the cadence would
have reported zero pages on a healthy Thursday tile read.

### It read its own column by accident of formatting

`max(source_checked_at)::text` returns `2026-09-28 13:14:38.494716+00`, which
`Date.parse` handles only through its lenient non-ISO path:

```
Date.parse("2026-09-28 13:14:38.494716+00")  ->  ok
Date.parse("2026-09-28T13:14:38.494716+00")  ->  NaN     (bare +00 is not ISO-8601)
```

One normalising keystroke upstream would have turned the alarm into a
permanently grey tile. It would have failed *safe* — `unknown` alerts — but as
an unexplained grey square rather than as an answer. `parseStampMs` normalises
both forms, with the live string as a test fixture.

## Why the rest is built the way it is

**Coverage is a fact and never the verdict.** Around 177 listings sit behind
hosts that 403 a script (minnesotaorchestra.org, guthrietheater.org,
artsmia.org, ESPN), so "never checked" can never reach zero. If it drove the
status the alarm would be permanently amber — and an alarm that is always on is
one nobody reads, which is the failure being replaced. The number is printed on
every verdict, including the dead one.

**One missed sweep is `warn`, not `down`.** It already counts as an alert and
reaches the subject line, which is all that is needed to catch it in week one,
and GitHub's scheduler drops runs routinely.

**`unknown` always alerts.** A null stamp, an unparseable one, a stamp from the
future, no page budget, an uncountable `pagesSwept`, a failed read, a null
measurement — every one alerts. "We could not tell" is never green, the rule
`lib/vendor-health.ts` was written to enforce.

## Verification

**The alarm fires on live production data right now**, which is the strongest
proof available: every recovery run earlier today was a dry run, and dry runs do
not stamp, so the newest stamp is genuinely still 28 Sep.

```
npm run ops-digest -- --dry-run
```

```
## Source check ⚠️
- ⚠️ 4 scheduled sweeps missed — nothing source-checked for 29 days, and it runs every 7 days
- 479 of 644 upcoming listings have never been checked (some hosts refuse a script — see docs/SOURCE-CHECK.md)
```

Both samplings, after the fix:

| sampling | state | verdict |
|---|---|---|
| email, Monday | healthy run | `ok` — "the latest sweep read 372 of 400 cited pages (today)" |
| email, Monday | **1st dead Monday** | **`warn`** — was `ok` before the fix |
| email, Monday | 2nd dead Monday | `down` — "2 scheduled sweeps missed" |
| email, Monday | the real outage | `down` — "5 scheduled sweeps missed" |
| email, Monday | ran, read 3 pages | `warn` — "read only 3 of 400 pages" |
| tile, Thu/Sat/Sun | healthy Monday run | `ok` at all three — no false alarm |

Against the database directly:

| check | result |
|---|---|
| the anchored window isolates one run | 1h → 141 pages, 24h → 141, 720h → 142 (the extra correctly excluded) |
| the interval travels as a bound parameter | `make_interval(hours => $1)`, no text splicing |
| `parseStampMs` on the live string | no five-hour shift — `2026-09-28T13:14:38.494Z` |
| rule 1, page tile | bounded by the 6s per-probe and 8s panel deadlines |
| rule 1, page sections | bounded by the 15s `CALENDAR_DEADLINE_MS` |
| rule 1, email | `wrap` → alerting "unavailable" section, never a throw |

Gate: `npx tsc --noEmit` clean · `npm test` green across 552 files · `npm run
build` clean · `npm audit` 0 vulnerabilities.

Three drift tripwires went in alongside, in the house query-text style: the
alarm and the sweep carry the **same three scope clauses**; **only
`check-sources` ever stamps the column with a time** (`upsertEvents`,
`apply-correction` and `source-sweep` are asserted never to write `now()` to
it); and both surfaces are asserted to call the same judge with the same
schedule.

## Deploy

```bash
git push origin HEAD:main
```

Vercel auto-deploys. Nothing to run and nothing to set.

## What happens on Monday

The digest is composed minutes after the sweep stamps, so:

- **Sweep ran** → `sweepsMissed` is 0 and `pagesSwept` ≈ the budget → green,
  and the `never checked` figure should fall sharply from 479.
- **Sweep did not run** → one missed slot → amber, in the email, in the subject
  line, on the first Monday rather than the fourth.

## Rollback

```bash
git revert <sha> && git push origin HEAD:main
```

Nothing to undo in the database — this deploy only reads.

## Known ceilings

- **The alarm can only speak when the digest runs**, and the digest triggers on
  Weekly Event Research completing. If that workflow is never dispatched at all,
  neither fires. In the real incident it *did* run and *did* complete (with
  failure), so the digest fired and this would have spoken. The "workflow never
  ran" case belongs to the GitHub Actions tile and its `judgeCron`.
- **A deliberate `--host=` run on a later day** becomes the newest stamp and
  reads as a partial sweep. That is a `warn` an operator who just ran one will
  recognise, and erring towards "look at this" is the right direction.
- **`pagesExpected` is `min(SWEEP_PAGE_BUDGET, pagesTotal)`**, right while the
  budget binds (388 pages today against 400). If the calendar grows past ~800
  cited pages a single healthy run covers under half of them and the partial-run
  test would fire on good weeks. The fix then is to raise the budget, not to
  relax the test, and the `never checked` line in the same section is what shows
  it coming.
