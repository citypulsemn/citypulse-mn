# Deploy — Ops digest catches a MISSED weekly send

*Aug 19, 2026. The weekly subscriber email silently didn't go out on Aug 6, and it
took 13 days and a manual database query to notice. This is the alarm that would
have caught it the following Monday.*

## The incident
`digest_sends` had rows for Jul 16, 23, 30 and Aug 13 — **nothing for Aug 6**, and
zero `ok = false` rows, so it wasn't a send that failed. The GitHub Actions history
explains it:

```
ANNOTATION: "The job was not acquired by Runner of type hosted
             even after multiple attempts"
conclusion: cancelled   ·   steps: []   ·   duration: 15m01s
```

GitHub's hosted runners never picked up the job. It sat unassigned until it hit the
workflow's `timeout-minutes: 15` and was cancelled **with zero steps executed** —
none of our code ran. Not a bug in `lib/digest`; a runner-capacity failure.

Related, and worth knowing: **every** scheduled run is late. Against a `0 15 * * 4`
cron, real start times were +1h02m, +1h39m, +3h48m and +3h52m. That queueing
pressure is the same thing that produced the no-show, so it will recur.

## Why nobody noticed — the real defect
The ops digest printed `last digest: <note>` straight from the most recent
`digest_sends` row. After a miss it kept rendering **the previous week's note as if
it were current** — a stale value with a fresh face, and no way to tell the
difference. That is the same failure class this codebase already takes seriously
(rule 6): an instrument that reads plausibly while being wrong.

## What shipped
- **`getDaysSinceLastDigest()`** ([lib/digest-send.ts](../../lib/digest-send.ts)) —
  whole days since the last **real** send. The `ok = true and recipients > 0` filter
  is load-bearing: dry runs return before the insert today, but a legacy
  `dry run · 2 personalized` row (0 recipients) is still in the table, and counting a
  rehearsal as a send would mask precisely the gap this exists to catch.
- **`DIGEST_STALE_DAYS = 8`** with the alert in the Subscribers section
  ([lib/ops-digest.ts](../../lib/ops-digest.ts)). The digest goes out Thursday and
  this report runs Monday, so a healthy week reads **4 days** and one skipped send
  reads **11** — 8 catches the miss without ever firing on a normal week or on
  GitHub's routine multi-hour delays.
- **The age prints even when healthy.** The first cut stayed silent on a good week;
  that was wrong for exactly the reason this incident happened — *an absent line
  reads like an absent check*. One short line keeps the instrument visibly alive.
- Its own error key (`digest_age`), per the R2.3 aux convention: a failed read
  prints "could not check for a missed send" rather than either a silent "fine" or
  taking out the whole Subscribers section.

## Verification (observed, not intended)
- **Ran the real ops digest against production** (`npm run ops-digest -- --dry-run`):
  ```
  ## Subscribers
  - 7 subscribed (+2 last 7 days)
  - last digest: 0 personalized
  - last successful send: 6 days ago
  ```
  6 days (Aug 13 → Aug 19), subject correctly stays `✅ all green`. The
  counterfactual holds: on Monday Aug 10 this would have read **11 days** and fired.
- **Tests +7** (1247 total): quiet at 4 days *and* at the threshold-minus-one;
  fires at 11 with the day count, the word MISSED, and the workflow name so the
  alert is actionable; `null` reads "no successful digest send recorded yet" without
  crying wolf; a failed read says "could not check" **and** leaves the rest of the
  section intact; singular grammar at 1 day.
- Gate: `tsc` clean · 1247/1247 · `npm run build` clean · `npm audit` 0.

## Deploy steps
Merge to `main`. No schema, no secret. Takes effect on the next Monday ops digest.

## Follow-ups worth considering
- **Raise `timeout-minutes`** in `weekly-digest.yml` from 15 to ~30. The job wasn't
  slow — it never started — so a higher ceiling gives the runner more chance to
  acquire it before cancellation.
- **A second scheduled attempt** later on Thursday, skipping if a send already
  succeeded that day. GitHub can't be made reliable; a retry makes one no-show
  harmless instead of merely visible.
- Aug 6's subscribers never got that week's email. Nothing to replay now, but worth
  knowing it happened.

## Rollback
`git revert`. Additive — the helper, one field, one constant, one branch.
