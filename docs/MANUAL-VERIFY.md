# The supervised verify pass

Shipped 12 October 2026. Lets the Monday verification be done in a supervised
session instead of being bought from the API, and makes the automatic run stand
down when it already has been.

Background on the pass itself is in `docs/VERIFICATION.md`. This doc is only
about *who pays for it* and *how the two paths stay identical*.

## Why

The verify pass is the project's biggest single API line. Measured over the
whole ledger (10 Sep – 12 Oct 2026, `model_spend`):

| job | runs | total | per run | cadence |
|---|---|---|---|---|
| **verify** | 8 | $68.37 | **$8.55** | twice weekly |
| pipeline | 5 | $61.38 | $12.28 | weekly |
| reels | 11 | $4.18 | $0.38 | twice weekly |
| check-reports | 3 | $1.45 | $0.48 | 48×/day |

That is ~$74/month for verify alone, and the work it does — open the
organiser's page, check the date against the listing — is exactly what a
supervised session does well, with a human reading the evidence.

So the expensive half can move. The two free halves stay in the script, where
every gate lives.

## The three commands

```bash
npm run verify -- --emit-queue=verify-queue.json --cap=60
```

One SELECT. No model call, no database write, no `ANTHROPIC_API_KEY`. Writes
the riskiest `--cap` events — never-verified-from-a-roundup first — as JSON.

Then, in a session **in this repo**, the prompt below. It writes
`verdicts.json`.

```bash
npm run verify -- --from=verdicts.json --dry-run    # rehearse
npm run verify -- --from=verdicts.json              # apply
```

Also free: Postgres and a cache purge, nothing else. The verdicts route through
the same `routeVerdicts` the paid loop uses.

### The prompt

> Read `verify-queue.json`. For each event in `events`, find **the organiser's
> or venue's own page** for it and decide whether the listing is right.
>
> Rules, each of which this project has been burned by:
> - **Check the year.** A page that looks authoritative may be last year's. A
>   2024 Halloween roundup put four fabricated listings on this calendar.
> - **A page you cannot find is not evidence of anything.** Use `not_found`.
>   Never report a cancellation because the page is missing.
> - **`cancelled` requires evidence** — a URL or the quoted wording. Without it
>   the verdict is downgraded to a flag, so an unevidenced cancel is wasted
>   work.
> - **One date of a run is not the run.** If the listing is one night of a
>   six-performance run, the start is right; say so in a `moved` note rather
>   than confirming silently.
> - Prefer the venue's own calendar. Ticketmaster, Songkick, Bandsintown and
>   tourism-board roundups are good enough to cite, not good enough to confirm
>   against — a confirmation resting on one gets flagged either way.
>
> Write `verdicts.json`: an array of
> `{"id": "...", "verdict": "...", "evidence": "https://...", "new_start": "YYYY-MM-DDTHH:MM"}`.
> `id` must be copied exactly. `verdict` must be one of the `allowedVerdicts`
> in the queue file. `evidence` is the page you actually read. `new_start` only
> for `moved`.
>
> Do not touch the database. Do not edit any other file. If you cannot reach a
> verdict for an event, **leave it out** — an omitted event is re-queued next
> week, a guessed one is a fabrication.

## The gate

The scheduled Monday run passes:

```
npm run verify -- --skip-if-verified-recently=72
```

If a pass completed inside 72 hours it logs that and exits, spending nothing.

### Why not `verified_at`

The obvious signal is the stamp the pass writes. It is **wrong**, and this was
the whole design risk. `import-sports` and `import-venues` also set
`verified_at = now()` on the rows they cover, and both run inside
`weekly-research.yml` at 06:00 UTC Monday — **six hours before** the Monday
verify job. A gate reading the stamp would have found fresh stamps every single
Monday, skipped the pass forever, and reported that it had correctly detected a
run. That is this project's recurring bug shape: an instrument measuring
something adjacent to the thing it names.

So the pass marks itself: one `admin_audit` row, `action = 'verify_pass'`,
written **after** the work, carrying `how` (`ci` / `local` / `file`) and the
counts. Nothing else writes that action.

It is written when the pass **adjudicated at least one verdict** — not merely
when batches came back. That distinction is the whole correctness of the gate,
and the first version got it wrong: it guarded on `done > 0`, counting loop
iterations that did not throw. But `parseVerdicts` swallows an unparseable model
reply and returns `[]`, which `verifyEventsBatch` passes straight through, so
every batch can "succeed" while deciding nothing. That is the *only* way this
pass fails silently — and the old guard would have written a full-coverage
marker for it and stood the next scheduled run down. It now shouts and exits
non-zero instead:

> ⚠ 25 batch(es) returned but produced NO verdicts at all — the model's replies
> are not parsing. Spent money, verified nothing, recording no pass so the next
> run still goes ahead.

A pass that adjudicated verdicts but found nothing wrong **does** mark itself —
"nothing was wrong" and "nothing ran" must not look the same.

`checked` is the number of events in batches that actually returned, **never
`candidates.length`**. The budget truncates most full windows, so recording
what the run set out to do would have overstated coverage by up to 2.5× — the
`collapsed_runs` bug exactly, a counter that reported intent and read clean
through five broken weeks. `ofCandidates` and `batches` ("10/25") ride along so
a truncated run is visibly truncated rather than looking like a clean sweep.

### Why 72 hours

The Thursday pre-send pass lands 93h before Monday's (Thu 15:00 UTC → Mon 12:00
UTC). Any window wider than that lets Thursday suppress Monday, collapsing the
cadence back to one pass a week — the exact failure the twice-weekly schedule
was built to fix. 72h leaves 21h of margin against the +1h02m–+3h52m scheduler
drift observed on this repo, and opens a window from Friday noon UTC onward.

### Why it fails open

`recentVerifyPass` returns "no recent pass" when it cannot tell — unreachable
database, missing `DATABASE_URL`, malformed answer — so the pass runs and
spends. This is the **opposite** of `hasSentDigestToday`, which fails closed
because a duplicated email is the expensive direction there. Here the expensive
direction is an unchecked week reaching readers. A lost secret must not quietly
switch verification off while every Actions run still shows green.

### What the gate does not touch

- **The Thursday pre-send pass** (`weekly-digest.yml`) carries no gate at all.
  An email cannot be recalled.
- **Manual dispatches.** The flag is applied on `schedule` only — dispatching
  the workflow means someone wants it to run now.

## The trade, stated plainly

A supervised session will not cover 200 events. The paid pass averages ~156
(8 batches of 8 × ~19.5 batches before the 20-minute budget). A 60-event
session that suppresses a 156-event pass **is a coverage cut**, not a free
saving.

The marker row records `checked` — and records it honestly, as events actually
adjudicated — so a floor is available if you want one: the gate could refuse to
stand down for a pass that covered less than *n* events. It is deliberately not
there yet, because the right *n* depends on how many you actually get through in
a sitting, and guessing it would be inventing a number.

```sql
select at, patch->>'how' as how, patch->>'checked' as checked,
       patch->>'ofCandidates' as queued, patch->>'batches' as batches
from admin_audit where action = 'verify_pass' order by at desc;
```

Run it a few weeks, read those counts, then decide.

Until then the honest summary is: **you choose coverage or cost each week, and
the gate makes that choice explicit instead of accidental.**

## Deploying

**Nothing to set.** No new secret, no schema change (`admin_audit` already
exists and takes an arbitrary `action`). The push carries the workflow edit.

### Verify

```bash
npm run verify -- --emit-queue=/tmp/q.json --cap=5     # free
npm run verify -- --from=/tmp/verdicts.json --dry-run  # free
```

- [ ] `--emit-queue` writes the file and says "No model call, nothing written"
- [ ] It runs with no `ANTHROPIC_API_KEY` present
- [ ] `--from` on a file with a bad verdict, a stale id and a duplicate prints
      **one `⚠ dropped` line per bad row with a reason** — never a silent count
- [ ] A `cancelled` verdict with no evidence is flagged, not applied
- [ ] A confirmation against `ticketmaster.com` is both stamped **and** flagged
      `weak_source`
- [ ] Each of these **exits 2** rather than starting a paid pass. All four
      previously fell straight through to the $8.55 agent loop:
      `npm run verify --from=x.json` (no bare `--`),
      `npm run verify --dry-run` (same, and the likeliest typo of the lot),
      `npm run verify -- --from x.json` (space, no `=`),
      `npm run verify -- --from=` (no value)
- [ ] A file with **two fenced blocks** applies the verdicts in both. Losing
      everything after the first fence while reporting "0 dropped" was the worst
      bug in the first draft of this
- [ ] A file giving one id **two different verdicts** rejects *both* and says
      so — position cannot settle which is right
- [ ] After a real `--from` run, `select * from admin_audit where action =
      'verify_pass'` has one row, and a second scheduled run inside 72h logs
      "standing down"

### Rollback

Revert the commit. The `verify_pass` audit rows are inert — nothing reads them
once the gate is gone, and `admin_audit` is append-only by design. Removing the
flag from `verify-events.yml` alone is enough to restore the old behaviour
without touching the code.
