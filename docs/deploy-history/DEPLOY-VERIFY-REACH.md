# Deploy — the verify pass reached a quarter of its own window (26 Aug 2026)

## What was wrong

`npm run verify` selects published events in the next 7 days, sorts by start
time, takes `cap: 40`, and runs once a week.

Measured against production on 26 Aug:

```
window (next 7 days, all with a source URL)   165
the cap reached                                40   (Aug 26 16:00 → Aug 27 17:00)
never reached                                 125   — 71 of them never verified, ever
```

**Forty events is about 25 hours of coverage.** The next run is seven days
later, so anything falling Friday through Wednesday happened without this pass
ever looking at it. Not a backlog that catches up — the events expire first.

This is the instrument whose job is catching a wrong listing before a reader
does. It is the one that never looked at the Twins.

## Where the hole landed

The importers cover their own venues continuously, so the gap fell almost
exactly on the categories with no feed:

| | upcoming | verified | source |
|---|---|---|---|
| sports | 84 | 81% | league feeds |
| music | 502 | 64% | venue calendars |
| family | 273 | 39% | Park Board |
| **arts** | 212 | **8%** | none |
| **festival** | 98 | **2%** | none |
| **food** | 72 | **1%** | none |
| **weird** | 53 | **0%** | none |

Those bottom four are ~435 listings from the same research pipeline that was 65%
wrong about the Twins.

## Three changes, not two

### 1. Never-verified first

The importers stamp `verified_at` on rows they cover, so the soonest slice was
thick with music and sports a primary source had already vouched for this week,
while listings nobody had ever confirmed sat past the cap.

```ts
const an = neverVerified(a) ? 0 : 1;
const bn = neverVerified(b) ? 0 : 1;
if (an !== bn) return an - bn;
return a.start.localeCompare(b.start);
```

Soonest-first still applies *inside* each group — tonight's unconfirmed show
outranks tonight's confirmed one, and both outrank Sunday's.

**On its own this is worth 6 slots** (34 fresh looks → 40 at cap 40). Small. Its
real job is below.

### 2. Cap 40 → 200

200 rather than 165 so a festival week has headroom. The first number I picked
was 160 and the drift guard rejected it for being under the window I had just
measured — which is exactly what that test is for.

### 3. Writes flush per batch

**This is why the cap could be raised at all.** The script collected every
verdict and wrote nothing until all batches finished. At 5 batches that is
survivable. At 21 it means a timeout at batch 19 discards nineteen batches of
paid-for verification — *including a cancellation we had evidence for*.

Each batch now writes its own confirms, cancels and flags before the next one
starts.

## Why a time budget instead of a bigger guessed cap

Per-batch time isn't knowable in advance — it depends on how many web searches
each event needs, and there is no `ANTHROPIC_API_KEY` on the dev machine to time
one honestly. Guessing a batch count that "should fit" is how a job gets killed
at 90% done.

So `RUN_BUDGET_MS = 20 minutes`, checked **before** each batch and never during
(a batch in flight has been paid for and always finishes). The Actions
`timeout-minutes` went 25 → 30 so it is a backstop rather than the thing that
stops the run.

The three changes interlock: the budget may truncate, the flush makes truncation
lossless, and **the ordering makes truncation safe** — whatever the run reaches,
it reached the unverified rows first.

## Result, measured on live data

```
OLD (cap 40)    picks  40   fresh looks  34   re-checks   6    5 batches
NEW (cap 200)   picks 165   fresh looks 105   re-checks  60   21 batches
```

**Fresh looks 34 → 105**, bounded by time. 21 batches in 20 minutes needs ~57s a
batch; if they run at 90s the budget stops it around batch 13, which is still
~104 events — and by the ordering, all of them never-verified.

The run now says which it did:

```
[verify] window 165 · checking 165 (cap 200)
[verify] 105 never verified before, 60 re-checks
[verify] ⚠ N never-verified event(s) in this window are past the cap
```

That warning is rule 6. Silent truncation reads as "we checked the week" when we
did not.

## Deploy steps

1. Merge to `main`. Nothing is build-time; no schema change; no new secrets.
2. The workflow change ships with the merge — `timeout-minutes: 30`.
3. Nothing runs until Thursday 16:00 UTC. To watch it sooner, dispatch **Verify
   Upcoming Events** manually with dry run **on**.

## Verify

Dispatch the workflow with dry run on and read the first three log lines: the
window count, the fresh/re-check split, and either no warning or a named number
past the cap. Then check the run's duration — under 20 minutes means the budget
never bit and all 165 were reached.

After the first real run, `verified_at` should climb in arts/festival/food/weird
specifically. Those four are the whole point.

```bash
npm run verify -- --dry-run --cap=8
```

`--cap=N` is new, for exactly this — one batch, cheap, when you want to see the
shape without paying for a full pass.

## Rollback

Two constants in `lib/verify.ts` (`DEFAULT_CAP`, `RUN_BUDGET_MS`) and the sort
comparator in `selectForVerification`. Setting `DEFAULT_CAP = 40` restores the
old cost exactly while keeping the ordering and the per-batch flush, both of
which are improvements independent of the cap. Nothing written by this change is
destructive; the cancellation policy is untouched.

## Quality gate

`npx tsc --noEmit` clean · **1443/1443** tests (+7) · `npm run build` exit 0 ·
`npm audit` 0 vulnerabilities · new selector run against production rows to
confirm the 34 → 105 figure rather than deriving it.

## Not done

**The cadence is still weekly**, and that is now the binding constraint rather
than the cap. Two runs a week would roughly double reach for the same cap, since
the window rolls between runs — a one-line cron change, deliberately not made
here because it doubles the API spend and that is Taren's call.

**~435 listings in arts/festival/food/weird still have no primary source.** This
change points a stronger instrument at them; it does not give them a feed. The
Ticketmaster key remains the highest-leverage open item.
