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
- **The six stamps already on the museum series' siblings.** Those rows are
  drafts now, so they are out of the pass's window entirely. The general cleanup
  tool is `resweep-verified`, which as of today clears a stamp whose re-check
  cannot name its year — but it spends model money per row, so it is a decision
  rather than a chore.
- ~~**Those four rows are drafts now.**~~ **Only four of the eight were.** See
  the postscript below — the other four were archived, and an archived row keeps
  serving its event page.

## Rollback

```bash
git revert <sha> && git push origin HEAD:main
```

Nothing to undo in the database. Reverting restores the old prompt and the old
routing, and any `wrong_year` / `unproven` flags already written stay as a
record — they are audit rows, not state.

---

# Postscript — 30 Oct 2026: the other four

**Data change only. No code shipped. Four listings taken down.**

The 28 Oct takedown reached four of the eight rows. The other four had already
been archived by the pipeline, and **an archived row goes on serving its own
event page** — `getEvent` filters `status <> 'draft'`, not `<> 'archived'`.
Deliberately so: something that really happened keeps the URL that went out in a
digest. A fabrication never happened, so it is the wrong shelf.

Measured before the change, all four live at HTTP 200 on the public site:

```
archived  Wed 2026-10-07 10:30  Toddler Music Lab: Echo & Explore               verified 21 Sep
archived  Wed 2026-10-14 10:30  Toddler Music Lab: Funky Soundscapes            verified 12 Oct
archived  Sat 2026-10-17 10:30  Toddler Music Lab: Funky Soundscapes (MEA …)    verified 21 Sep
archived  Wed 2026-10-21 10:30  Toddler Music Lab: Splish Splash Water Perc…    verified 15 Oct
```

## One page settles all eight

The 28 Oct corrections cited a different museum page per row. There is a single
page that settles the whole series — the museum's own announcement, posted
**2 Oct 2025**, which prints the weekday beside every date:

> Tues. Oct. 7 — Echo & Explore · Tues. Oct. 14 — Funky Soundscapes ·
> **Fri. Oct. 17 (special MEA session)** — Funky Soundscapes ·
> Tues. Oct. 21 — Splish Splash Water Percussion · Tues. Oct. 28 — Bounce &
> Boogie · Tues. Nov. 4 · Tues. Nov. 11 · Tues. Nov. 18 · Tues. Nov. 25

<https://mcm.org/new-toddler-music-lab-series-in-sprouts-this-fall/>

Nine sessions, all 10:30–11:30 in the Sprouts gallery. Our eight rows are eight
of those nine with the year bumped. **The weekday is the tell, and it needs no
source at all**: 7, 14 and 21 October were Tuesdays in 2025 and are Wednesdays
in 2026. The MEA session is the clearest — the museum wrote *Fri.* Oct. 17, and
our row put it on a **Saturday**, when MEA break is a Thursday and Friday.

Worth recording for the next occurrence: a series announcement that prints
weekdays is a better citation than a per-session page, because the contradiction
is arithmetic rather than a reading.

## The source

All eight cited `womenspress.com/organizer/minnesota-childrens-museum/` — a
third-party organiser roundup that **now returns 404**. Measured across the
archive: of 4,098 archived rows, exactly **one** cites an `/organizer/`-shaped
page. This was a localised failure, not a class sitting in the archive.

## Applied

```bash
npm run correct -- --from=corrections-toddler-archived.json \
  --apply --backup=…/backups/2026-10-30-toddler-archived-hide-before.json
```

`hide: true`, not `archive` — the lever the `Correction.hide` docstring was
written for, four days after it was written. 4 applied, 0 refused, four
`admin_audit` rows, and the revalidation channel reported `↻ site caches cleared
(+4 event page(s))`.

**Verified after:** all eight Toddler Music Lab rows read `draft`; the four URLs
render *"We couldn't find that"* with no trace of the listing; none of the four
ids appears in `sitemap.xml`. Screenshot taken of the MEA row's URL.

## What this surfaced, and did not fix

**`/event/[id]` answers 200 for an event that does not exist.** A soft 404:
`notFound()` is called, the right page renders, the status code is wrong. Not
caused by this change — a UUID that has never existed behaves identically.

**Two corrections to what this section first said**, both found by the
investigation the next day and recorded here because the wrong version was
pushed:

- **The cause is not ISR.** I wrote that the soft 404s were "the ISR routes".
  They are the routes with a `loading.tsx` in scope. `/cities/[slug]` is
  dynamic and answers 404 correctly; `/collections/[slug]` is statically
  generated and soft-404s. A `loading.tsx` wraps its segment in `<Suspense>`,
  so the response is flushed with 200 before `notFound()` runs.
- **It was not letting search engines index the dead URL.** Next already emits
  `<meta name="robots" content="noindex">` on a soft 404 — the same directive
  the hard 404 carries. The real defect is that it lands in the *body* rather
  than the *head*, where a crawler is guaranteed to read it. A weaker version
  of the problem than the one I described.

Fixed 30 Oct — see [DEPLOY-SOFT-404.md](DEPLOY-SOFT-404.md).

**Two live listings from the same dead roundup, left alone on purpose.** Both at
Minnesota Children's Museum, both `published`, both running 23 May 2026 →
10 Jan 2027, neither ever verified, neither source-checked:

- `Monsters on Summer Vacation (Special Exhibit)`
- `Beach Monster Exhibit`

The exhibit is **real** — the museum announced it on 8 May 2026 — but it is
called *Monsters on Vacation*, and the museum's page runs one exhibit, not two.
`Beach Monster Exhibit` looks like a roundup writer's paraphrase ("friendly
monsters are taking their beach vacation") promoted to a title, i.e. a duplicate
of a real exhibit under an invented name. The 10 Jan 2027 end date is attested
nowhere I could find.

Not touched, because every available move is a product call on a live, real
listing: which title wins, whether the end date stands, which row is archived.
Taking down a real exhibit to tidy a duplicate is the wrong direction of error.
