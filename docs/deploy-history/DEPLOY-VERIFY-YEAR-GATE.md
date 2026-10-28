# Deploy — a confirmation has to show the date it read

**28 Oct 2026.** Prompt change, one pure gate, two tripwires. No schema change,
no data change.

## What failed, twice measured

The verify pass stamps `verified_at`, and a stamp stops anyone looking again.
Twice now it has stamped a listing the organiser does not attest:

- **5 Sep 2026 — Damian Marley at the Fillmore.** The cited roundup never
  mentioned the show. A reader caught it. Fixed by rewriting the prompt to ask
  the venue rather than the source, and by adding the `wrong_event` verdict.
- **28 Oct 2026 — Toddler Music Lab at Minnesota Children's Museum.** Eight
  listings were the museum's autumn **2025** four-week Tuesday series with the
  year bumped: same month, same day, same 10:30 start. **Six carried a stamp.**

The second one is the interesting failure, because the pass was not being lazy.
The museum's own page for each session is still up and still reads
*"October 28, 2025 10:30 am - 11:30 am"*. An agent told to find what the venue
says is in that room that night finds the right title, in the right room, on the
right month and day — and confirms. Every instruction in the prompt was
followed.

**Nothing in the prompt, and nothing in `lib/verify.ts`, had ever read the
year.** Same blind spot as `pageCoversDate` in the source check, which matches
month and day only. Two instruments, one hole.

## The fix: make the year arithmetic, not persuasion

Asking the agent more firmly to check the year would be a rule with no
enforcement — and this project already knows where that ends. `cancelled` has
required `evidence` since the beginning, precisely because a drastic verdict
that needs no proof is an opinion. `confirmed` is drastic too; the prompt itself
says so: *"Confirming an event you did not actually find is the one mistake that
matters here."* It required nothing.

So `confirmed` now carries **`saw`** — the date as the page prints it, copied
rather than paraphrased. Then the check is a string comparison in pure code.

`confirmationDateProblem(saw, expectedStart)` in `lib/verify.ts` returns the
operator-facing reason, or null. Three ways a confirmation fails, each
withholding the stamp:

| what came back | flag | why |
|---|---|---|
| nothing quoted | `unproven` | a confirmation with no shown work |
| `"Fri, Oct 28"` | `unproven` | a page that never prints the year cannot settle it |
| `"October 28, 2025"` for our 2026 row | `wrong_year` | the live fabrication, caught |

Our year appearing among several is fine — venue pages print a season as well as
a date, so `"2026-27 season · Friday, November 20, 2026"` passes.

The gate sits in `routeVerdicts`, after the unknown-venue gate and **before**
`out.confirms.push`, so it withholds the stamp the way `no_venue` does rather
than flagging alongside it the way `weak_source` does. That ordering is
deliberate and pinned by a test: a row with both problems reports the venue one,
matching the existing chain.

`RoutableEvent` gained `start`. Its absence is the mechanical reason nothing
could compare the year — both callers already had the field, and the type did
not pass it along.

`scripts/resweep-verified.ts` gets the same gate from the same function. That
job only ever *removes* confidence, so a re-check that cannot name the year it
read **clears** the existing stamp instead of keeping it. One definition, both
callers, which is what that file's docstring already asked for.

## The prompt

`buildVerifyPrompt` had **no test coverage at all** before today, which is
awkward for a function where every paragraph was bought by an incident — a
deleted rule fails nothing, the pass just quietly gets worse. There are now
tripwires for all three: the roundup that named no event, the resale inventory
still selling a moved date, and the year.

The new text names the incident rather than scolding, which is how the rest of
this prompt is written:

> CHECK THE YEAR, AND SHOW IT. The commonest way a fabricated listing survives
> this pass is a page from LAST year. On 28 October 2026, eight Toddler Music Lab
> listings at Minnesota Children's Museum turned out to be the museum's autumn
> 2025 series with the year bumped … and six of them had been stamped
> "confirmed" against the museum's own pages, which are still up and still read
> 2025.

It also states the consequence (`a "confirmed" with no "saw" stamps nothing`),
gives the two correct escapes (a different year is `wrong_event`; a page with no
year is `not_found`), and puts `saw` in the output example — a required field
missing from the example is a field that never gets filled.

## Proven on live rows, for nothing

`npm run verify -- --from=<file> --dry-run` runs the real routing path against
real database rows with **no model call**. Three verdicts against three live
listings, one per branch:

```
⚑ WEAK-SOURCE  "Bent Brewstillery Halloween Fest …"      — confirmed against racketmn.com, a roundup …
⚑ WRONG_YEAR   "Candy-Inspired Beer Infusion Night …"    — the page prints 2025 and we list 2026-10-31 —
                                                            same day, wrong year, which is how a past
                                                            event gets republished
⚑ UNPROVEN     "Gangster Ghost Tours at Landmark Center" — confirmed without quoting the date the page printed

confirmed 1, cancelled 0, flagged 3 — dry run, nothing written.
```

The right-year row confirmed and picked up its pre-existing weak-source flag, so
the new gate sits alongside the old ones rather than replacing them.

## The risk, and the decision taken on it

**If the model does not fill `saw`, the next scheduled run stamps nothing.**
That is the conservative direction, but it would waste a run — this pass is the
project's biggest API line at **$8.55**, and `weekly-digest.yml` calls it with
no dry-run.

One batch (`npm run verify -- --cap=8 --dry-run`, eight events, about 34p,
nothing written) would have settled it in advance. **Offered and declined:**
ship as is and let the first scheduled run be the test. That is a reasonable
call — the failure mode is safe and recoverable — but it moves the whole
question onto that run, so the run now has to report its own result instead of
leaving a quiet zero in the digest.

`unprovenAlarm` (pure, in `lib/verify.ts`) decides what a finished run owes its
operator:

| what the run produced | what it says |
|---|---|
| no confirmations, some `unproven` | **error, and `exitCode = 1`** — names the cause, and points at this file for the fallback |
| some of each | a one-line warning with both counts |
| no `unproven` at all | nothing |
| nothing but `wrong_year` | nothing — that is the gate finding real contradictions, not an uncooperative model |

**The first version of that alarm was wired into one summary path and stayed
silent on the other** — which is the path the free `--from` test uses, so the
test said nothing and looked like a pass. Both paths call the shared pure
function now. Verified on each:

```
five confirmations, none quoting a date:
  confirmed 0, cancelled 0, flagged 5
  ⚠ NOTHING was confirmed and 5 confirmation(s) were withheld as "unproven" …
  exit=1

one of each:
  confirmed 1, cancelled 0, flagged 3
  1 confirmation(s) withheld for quoting no date, against 1 that did quote one.
  exit=0
```

So: watch the next scheduled verify run. A red workflow with that message means
the gate held and the prompt did not, and the fallback is to flag `unproven`
alongside the stamp instead of withholding it — weaker, but it keeps the pass
earning its money while the prompt gets another pass. The `wrong_year` withhold
would stay either way.
## Deploy

```bash
git push origin HEAD:main
```

No schema change, no data change, nothing reader-facing. The flags land in
`admin_audit` as `verify_flag` rows exactly like `no_venue` and `weak_source`,
which already use labels outside `VERDICTS`, so the ops digest picks them up
with no change.

## Verify

Free, any time:

```bash
npm run verify -- --emit-queue=q.json     # one SELECT, no model call
npm run verify -- --from=verdicts.json --dry-run
```

Then the one paid batch above. After a real run, the ops digest's flagged-
listings line should start showing `wrong_year` and `unproven` counts, and
`wrong_year` is the one worth reading: each is a listing whose own source
contradicts its year.

## What this does not fix

- **`pageCoversDate` still matches month and day only.** The source check has
  the same hole from the other side, documented in `docs/SOURCE-CHECK.md`.
  Closing it means establishing a page's season span.
- **The six stamps already on the museum series' siblings.** Those four rows are
  drafts now, so they are out of the pass's window entirely. The general cleanup
  tool is `resweep-verified`, which as of today clears a stamp whose re-check
  cannot name its year — but it spends model money per row, so it is a decision
  rather than a chore.

## Rollback

```bash
git revert <sha> && git push origin HEAD:main
```

Nothing to undo in the database. Reverting restores the old prompt and the old
routing, and any `wrong_year` / `unproven` flags already written stay as a
record — they are audit rows, not state.
