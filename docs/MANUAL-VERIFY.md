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
the riskiest `--cap` events — never-verified-from-a-roundup first — as JSON, in
`batches`, each with the `prompt` the paid pass would send for it.

Then, in a session **in this repo**, the instructions below. They write
`verdicts.json`.

```bash
npm run verify -- --from=verdicts.json --dry-run    # rehearse
npm run verify -- --from=verdicts.json              # apply
```

Also free: Postgres and a cache purge, nothing else. The verdicts route through
the same `routeVerdicts` the paid loop uses.

### The instructions

**The rules live in the queue file, not here.** Each batch carries the output of
`buildVerifyPrompt`, the same text the paid pass sends. This doc used to hold its
own copy, which never learned `saw` when the year gate shipped, nor the venue
calendars. Following it would have had every confirmation withheld as unproven.

Give each batch's `prompt` to a separate subagent, so 200 events of web pages do
not pile up in one conversation. Have it save its reply, the fenced JSON block,
as `batch-N.md`. Then join them, because `--from` applies every fenced block in a
file:

```bash
cat batch-*.md > verdicts.md
```

If a batch fails, **leave it out**. Its events are re-queued next week, while a
guessed verdict is a fabrication. Subagents do not touch the database or edit any
other file.

### The scheduled trial (Nov 2026)

A Claude Code scheduled task does all of this at 11am Central on Mondays on
Taren's PC, using the Claude subscription rather than the API. Its prompt and setup
are in `docs/deploy-history/DEPLOY-LOCAL-VERIFY-TRIAL.md`, and its files are kept in
`Documents\CityPulseMN\verify\<date>\`. If it does not run, or decides too few
events, the 20:00 UTC paid job runs as usual, so a missed Monday costs about $8
rather than a week of unchecked listings.

It needs the PC awake and the Claude app open. It must only ever run the two free
commands: `.env.local` holds `ANTHROPIC_API_KEY` because the local reels job needs
it, so a plain `npm run verify` on this PC **bills the API**.

## The gate

The scheduled Monday run passes:

```
npm run verify -- --skip-if-verified-recently=72
```

If a pass that decided at least 80 events completed inside 72 hours, it logs that
and exits, spending nothing.

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

`checked` is a count of **distinct events**, and getting it honest took two
goes. It is never `candidates.length` — the budget truncates most full windows,
so recording what the run set out to do overstated coverage by up to 2.5×, the
`collapsed_runs` bug exactly. And on the file path it is not
`confirmed + cancelled + flagged` either: a weak-source row gets **both** a
stamp and a flag, so summing the buckets double-counts it. The first real run
recorded 163 for 153 events before that was fixed; the 18 Oct 2026 marker row
still carries the inflated figure, since `admin_audit` is append-only.

`ofCandidates` and `batches` ("10/25") ride along on the paid path, and `ofFile`
and `dropped` on the file path, so a truncated or partly-rejected run is
visibly so rather than looking like a clean sweep.

### The floor: 80 decided events

On 2 Nov 2026 a file holding **one** event was applied at 13:58 UTC. When Monday's
paid job fired at 21:29 UTC it found that marker, stood down and reported success,
so about 150 events went unchecked that Monday. The first draft of this doc named
this risk and left the floor out until there was data. Now there is.

`standDownFor` counts **confirmed plus cancelled**, not `checked`. `checked` also
counts flags, so a pass whose every confirmation was withheld as unproven could
read 160 while having verified nothing. Real passes from 15 Oct to 5 Nov decided
94–134, so 80 sits under all of them. A smaller pass is printed and ignored.

### Why 72 hours

The Thursday pre-send pass lands 101h before Monday's (Thu 15:00 UTC → Mon 20:00
UTC). Any window wider than that lets Thursday suppress Monday, collapsing the
cadence back to one pass a week — the exact failure the twice-weekly schedule
was built to fix. The digest job has fired up to 6.4h late, and 72h still clears
that. It opens a window from Friday evening UTC onward.

### Why it fails open

`recentVerifyPasses` returns no passes when it cannot tell — unreachable database,
missing `DATABASE_URL` — and `decidedCount` reads a malformed count as zero, so the
pass runs and spends. This is the **opposite** of `hasSentDigestToday`, which fails closed
because a duplicated email is the expensive direction there. Here the expensive
direction is an unchecked week reaching readers. A lost secret must not quietly
switch verification off while every Actions run still shows green.

### The Thursday pass (changed Nov 2026)

The pre-send pass in `weekly-digest.yml` had no gate at all until November, because
an email cannot be recalled. It now passes `--skip-if-verified-recently=12`, and a
scheduled task runs the supervised pass at 8am Central on Thursdays. Three things
keep the original point intact:

- **12 hours, not 72.** Monday's pass is about 70 hours old by Thursday morning, so
  a 72-hour window would have let it stand down the check before the email.
- **The floor still applies.** A pass that decided fewer than 80 events is ignored.
- **It still fails open.** If the local pass did not run, or the database cannot be
  read, the paid pass runs before the email goes out, as it always did.

### What the gate does not touch

- **Manual dispatches of `verify-events.yml`.** The flag is applied on `schedule`
  only — dispatching the workflow means someone wants it to run now.

## The trade, stated plainly

A supervised session will not cover 200 events. The paid pass averages ~156
(8 batches of 8 × ~19.5 batches before the 20-minute budget). A 60-event
session that suppresses a 156-event pass **is a coverage cut**, not a free
saving.

The trial queues 200, because a dry run projected 160 would miss the floor. It still
confirms fewer than the paid pass: 15 against 25 on the same 32 events on 6 Nov. Read the
results with:

```sql
select at, patch->>'how' as how, patch->>'checked' as checked,
       patch->>'confirmed' as confirmed, patch->>'cancelled' as cancelled,
       patch->>'flagged' as flagged, patch->>'ofFile' as of_file
from admin_audit where action = 'verify_pass' order by at desc;
```

## Applying what the pass found

The pass flags; it never applies a date. So roughly half the open flags carry a
ready-to-apply date or room taken from the venue's own calendar, and until
18 Oct 2026 the only way to act on one was hand-written SQL.

```bash
npm run correct -- --from=corrections.json                        # dry run
npm run correct -- --from=corrections.json --apply --backup=before.json
```

`lib/corrections.ts` holds the shape. It exists for one reason: **`event_key` is
unique across every status**, and identity is `sha256(title | venue | start
DATE)` — so editing a title, a room or a day changes the row's identity, and the
new identity may already belong to another row, including an archived one
nobody can see on the site. The script computes the new key and **refuses the
correction if anything else holds it**, naming the other row.

That is not theoretical. On 18 Oct a flag said an Underoath date should move
from 12 Dec to 23 Nov. A 23 Nov row was already published and verified, its
title differing only by an en-dash where the other used an em-dash — so the
moved row's key came out byte-identical. The right action was archiving a
duplicate, not moving a date, and a hand-written UPDATE would have hit the
unique index and told you nothing about why.

Three other things it does that `admin-actions.ts updateEvent` cannot:

- **Coordinates move with the room.** `updateEvent` has no lat/lng, so a venue
  change made there leaves the pin at the old address. A venue change without
  coordinates is refused.
- **`verified_at` is cleared by default.** A stamp left on a row whose date just
  changed would claim a source vouched for the *new* date, when the source is
  why it changed. `"verified": true` keeps it, and is only allowed alongside a
  cited `evidence` page — then the correction *is* the verification, and
  clearing it would re-spend to re-establish a fact already cited.
- **Re-running is a no-op.** A correction whose values the row already has
  reports `no change` instead of writing a second audit row claiming one.
- **A citation can be repaired** (`"source_url"`, added 27 Oct 2026). This is
  the one field that is right to change on a listing whose every fact is
  already correct — the Hallmark(ish) row at the Pantages was accurate in
  title, room, date and time, and cited a touring-Broadway roundup that mixed
  its live run in with archived 2020–2022 runs, so the weekly source check
  flagged it falsely. Three things follow from it, and all three are in
  `planCorrection` rather than the script:
  - **`verified_at` is untouched.** `source_url` is deliberately not in
    `VERIFY_RELEVANT`; the pass never sees it, so a better citation is not a
    changed fact. Setting `"verified": true` on a citation-only correction is
    *refused* for the same reason — pointing at a page is not reading it.
  - **`source_checked_at` goes back to null** (`resetsSourceCheck`). The new
    page has never been read, whatever the old one's stamp says, and
    `stalestFirst` reaches only ~400 pages a run — a stale stamp would park
    the new page behind every genuinely unread one.
  - **A roundup or a reseller is refused**, naming the host. Citing a
    third-party seasonal list is the defect this field exists to repair, and
    `statusForNewEvent` will not publish on one anyway. A social page is
    *allowed*: `lib/source-trust.ts` is explicit that those are good enough to
    cite and not good enough to verify on. Note the two host lists overlap —
    `eventbrite.com` is in both, so an Eventbrite page is caught by the roundup
    rule even though it is also a directory.

- **A description can be corrected** (`"description"`, added 6 Nov 2026), so a
  date fix does not leave the old date in the prose. The pass never reads it, so
  it leaves `verified_at` alone, and `"verified": true` on prose alone is refused.
- **A corrected row keeps its correction.** An edit sets `corrected_at`, and
  `upsertEvents` then stops research overwriting the title, venue, address, pin,
  times, description or source. Price, ticket link and image still update, and
  `import-sports` still moves a game's time. A correction that moves a row's DATE
  gives it a new identity, so research can still re-create the old date from the
  page that misled it. To release a row, set `corrected_at` back to null.

#### `end_at` could never be cleared, and said it had been

Found 27 Oct 2026 by an adversarial review of the `source_url` change, which
edits the same UPDATE. `{"end": null}` is the documented way to clear an end
time. The script wrote `fields.end_local ?? row.end_local` — and `??` falls
through on null, so it evaluated `null ?? "2026-10-23T23:00"` and wrote the
**old timestamp straight back**. The column could not be cleared at all: the
null branch was reachable only when the row was already null, because `put`
skips a field whose value already matches.

Everything downstream said it had worked. `describePlan` printed `end_local:
2026-10-23T23:00 → (none)`, the `admin_audit` row stored that line, and the run
counted the id as applied. `end_local` is in `VERIFY_RELEVANT`, so the row also
lost its `verified_at` to a change that never happened and went back into the
~5p-a-listing queue. Re-running the file rewrote the same lie every time.

**The golden test named "can clear an end time without clearing it by accident"
was green the whole time.** It asserted the *plan*, and the plan was always
right — the same shape as the drift guard that searched for a call a rename had
removed. The decision now lives in `nextValue` in `lib/corrections.ts`, where
presence in the plan decides and the value never does, with goldens for the
clear, the keep, the pass-through, and `""`/`0`. A tripwire asserts the script
reads every column through it and that both timestamps still carry their
`::text::timestamp` cast.

Verified end to end against the live database inside a transaction that was
rolled back: `{"end": null}` now clears, a real end time still lands without the
five-hour shift, and the row came back unchanged afterwards.

### A primary source is not the same as a current one

Baby Bugs is the case worth remembering. The listing's `source_url` was
`first-avenue.com` — the organiser's own site, so never flagged weak. First
Avenue announced on 2 Oct that the show had moved to March 2027, retiring the
old slug behind a 301. The paid verify pass stamped the row `confirmed` for
21 Oct on **15 Oct at 19:18:27**, thirteen days later, and the subscriber email
went to 44 people four seconds afterwards.

The likely reason is that a general search for the show still returns AXS,
TickPick, SeatPick and ConcertFix, all of which were still selling the dead
October date. Stale resale inventory reads exactly like confirmation. `source_url`
being primary says where we got the listing, not that the page still says what
it said.

Note also that `digest_sends` records only a recipient count and a note — not
which events went out. So after finding an error like this there is **no way to
establish what the list was actually told**.

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
