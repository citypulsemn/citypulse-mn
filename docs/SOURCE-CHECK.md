# Source check — is a listing on the page it cites?

One HTTP fetch per distinct source URL, no model call, and it answers the
question that would have caught every fabrication this project has shipped:
**does the page we cite actually list this event?**

```bash
npx tsx scripts/check-sources.ts                    # look, write nothing
npx tsx scripts/check-sources.ts --apply            # flag what is missing
npx tsx scripts/check-sources.ts --host=arb.umn.edu # one source
npx tsx scripts/check-sources.ts --limit=40         # cap the fetches
```

*(An `npm run check-sources` alias exists in the working tree but is
deliberately not committed — `package.json` currently carries the uncommitted
reels entries, and staging it would drag those in. Add the alias when reels
lands.)*

## When it runs

**Last step of `.github/workflows/weekly-research.yml`**, with `--apply`, after
the pipeline and after the sports and venue reconciliations — because it judges
what all of them produced.

It runs *inside* that workflow rather than in its own, so its flags are in the
database **before the ops digest fires**. The digest triggers on
`workflow_run: completed` for weekly-research and reads the flag queue; a sweep
running after it would report a week late.

It is deliberately **not** wrapped in `continue-on-error`. Transient socket
failures are already swallowed and counted internally, so a non-zero exit means
a real fault — and when that happens the workflow conclusion goes to `failure`,
which turns the **GitHub Actions tile on `/admin/ops` red**. That tile is the
loudness mechanism; hiding the failure would make this another instrument
raising its hand into a void.

### It did not run at all for four weeks (29 Sep – 26 Oct 2026)

The paragraph above reasoned carefully about this check's *own* failures and
never considered the step **in front of it**. On 29 Sep an eleven-line comment
was written inside a `sql` template in `scripts/import-sports.ts` as `//` lines;
Postgres received them as the start of the statement and the step died with
`syntax error at or near "//"` on every week a team had a game to add. Nothing
after it ran. The newest `source_checked_at` in the database was **28 Sep** —
the day before — and only 189 of 691 published listings had ever been checked.

Two things to take from it:

- **A step's own error handling says nothing about what it is standing behind.**
  All three reconciliations now carry `if: ${{ !cancelled() }}`, so each runs
  whatever the others did, and the job still reports failure if any failed. They
  check different things against different sources; chaining them was never
  meaningful.
- **The loudness mechanism fired and did not produce action.** The workflow
  conclusion *was* `failure` and the Actions tile *was* red, for four Mondays.
  Red that nobody is looking at is indistinguishable from green. The thing that
  would actually have caught this is an instrument that notices the check has
  not run — `source_checked_at` going stale is visible in the database and in
  nothing anyone reads.

`lib/__tests__/sql-templates.test.ts` now fails the build on a `//` line inside
any SQL template, which is the narrow cause.

The broad cause — a passing `npm test`, a green build and a four-week-dead
weekly job all coexisting — now has the guard it needed. **The Monday ops email
carries a `Source check` section** that judges `max(source_checked_at)` and
alerts when it is overdue (`judgeSourceSweep` in `lib/vendor-health.ts`,
measured by `lib/source-sweep.ts`). It went in deliberately as an *email*
section and not only as an `/admin/ops` tile: the Actions tile was red for four
Mondays and produced nothing, because red on a page nobody opens is
indistinguishable from green. `/admin/ops` gets the tile too, from the same
judge and the same query, so the two cannot drift.

It judges two failures, not one:

- **It did not run.** Nothing stamped since the sweep was last *due*
  (`sweepsMissed`). One missed slot is a `warn`, two is `down`.
- **It ran and read almost nothing.** Only pages actually read are stamped, so a
  sweep that dies after a few fetches, or meets a wall of 403s, leaves a *fresh*
  stamp and no coverage. Fewer than half a run's page budget is a `warn`.

### Both halves were wrong first, and an adversarial review caught them

Worth recording, because the first version reproduced the bug it was built to
fix — an alarm reading green while the thing it watched was dead.

**It judged a stopwatch, not a schedule.** The bands were copied from
`judgeCron`: late past 1.25 periods, `down` past two. But the ops digest fires
on `workflow_run: completed` for Weekly Event Research and `check-sources` is
the *last step of that same workflow*, so the email samples **minutes after the
sweep should have run**. On the first dead Monday the newest stamp is therefore
exactly *one* period old, which a 1.25-period grace calls fine. Measured: green
on the first dead Monday, amber on the second, red on the third. And tightening
the threshold could not fix it, because `/admin/ops` samples the same judge
mid-week, where a Sunday read is six days after a perfectly healthy run. The
right question at every sampling time is not "how long ago?" but **"has it run
since it was last due?"**

**`pagesSwept` counted two runs.** The window was a fixed 8 days against a
7-day cadence, so it always carried the previous run's stamps. The two faults
compounded: on the first dead Monday the stamp was one period old *and*
`pagesSwept` was last week's 372, so the email read **"372 of 400 cited pages
re-read" on a week when zero pages were read.** It is anchored to the newest
stamp now (`SWEEP_RUN_WINDOW_HOURS`), which measures one run however long after
it the question is asked.

**It read its own column by accident of formatting.** `max(source_checked_at)::text`
returns `2026-09-28 13:14:38.494716+00`, which `Date.parse` handles only through
its lenient non-ISO path; the same instant with a `T` is `NaN`, because a bare
`+00` offset is not valid ISO-8601. `parseStampMs` normalises both. It would
have failed safe — `unknown` alerts — but as an unexplained grey square rather
than as the answer.

The share of the calendar never checked is reported as a **fact and never drives
the verdict**, because it can never reach zero — 76 listings sit behind hosts
that block us, redirect in a loop or have gone dead, and 86 more cite pages that
are not indexes and so cannot convict — and an alarm that is permanently
amber is one nobody reads. The line **names its
causes** rather than guessing at them; see below for why that matters.

Cost: about 12 minutes and no model spend. The weekly job has run 19–44 minutes
over the last five weeks against a 90-minute timeout, so there is room.

Needs one secret, `DATABASE_URL` — the only environment variable the whole call
chain reads.

## What it was built for

On 14 Sep 2026 **"Prairie Bathing Under a Harvest Moon"** was live, stamped
verified, and did not exist. Three Rivers Park District runs seven programmes on
26 September and none of them is that. What the listing really was:

| the real thing | where | when |
|---|---|---|
| Guided Forest Bathing Walk | Silverwood Park | 10 Oct |
| Night on the Prairie | Eastman Nature Center | 31 Oct |
| "The Harvest Moon" | — | **a blog post from September 2018** |

Three real things and a blog headline, blended into a fourth. The date was not
random either: the harvest moon genuinely falls near 26 Sep 2026. Real
vocabulary, real date anchor, no event.

It cited `threeriversparks.org/programs`, a live index page that names every
programme the district runs. The title was never on it.

## How it decides

`lib/source-presence.ts` is pure and golden-tested (31 tests).

**The unit of comparison is one ENTRY, never the page.** Matching against the
whole page would have cleared this listing: "prairie" is on it (Prairie Seed
Collection), so is "bathing" (Fall Colors Guided Forest Bathing), "harvest"
(Preserving the Harvest) and "moon" (Moonlit Magic). All four words present,
never together.

Three gates gate every negative, each one added after it flagged something real:

1. **The page must be an index.** ≥50 distinct dated entries. The first full
   sweep flagged five listings and four were real — a single-event page for
   *Clue*, the Guthrie's ticketing page, a Gophers news article. Our titles
   carry decoration those pages never use ("– Saturday Performance"), so they
   scored low and looked missing. What separated them from the real catch was
   not the score but how much calendar the page enumerates:

   | page | dated entries | verdict |
   |---|---|---|
   | threeriversparks.org/programs | **208** | the real catch |
   | securesite.guthrietheater.org | 32 | false positive |
   | gophersports.com article | 31 | false positive |
   | arb.umn.edu/events/calendar | 14 | false positive |
   | hennepinarts.org/events/clue | 9 | false positive |

2. **The page must cover the listing's date** — ≥2 *distinct* entries naming
   that day. `arb.umn.edu/events/calendar` is "Today at the Arb"; a page showing
   today proves nothing about the 26th. Distinct, because a nav element carrying
   a date can repeat down a page and boilerplate must not stand in for a listing.

3. **The title must have ≥3 distinctive words.** "Sting" missing from an index
   proves nothing.

4. **The page must not name the act beside the date.** Added 27 Oct 2026, after
   the gate below.

Anything else — a thin page, a 403, a partial match, a title of stopwords —
returns `unchecked`. **`unchecked` is never treated as either answer.**

### The score is one-directional, and our titles are longer than the page's

The first sweep after the four-week outage produced four flags against 475
present. **Three were false, and all three for one reason.** `scoreEntry`
divides by *our* token count, so a verbatim match on the act still reads as a
miss once the tour name is counted against it:

| our title | the line on the page it cites | score |
|---|---|---|
| SOMBR: You Are The Reason Tour | `SOMBR` | 0.333 |
| KATSEYE: THE WILDWORLD TOUR | `KATSEYE` | 0.333 |
| Motionless In White: The Sweat and Blood Tour | `Motionless In White` | 0.400 |

Our titles come off ticketing pages and carry the tour; `targetcenter.com` lists
the act. So `leadSegment` takes the head of a title — the part before a `:` or a
spaced dash — and a negative is withdrawn when that head is on the page.

**Two safer-looking fixes were measured and rejected.**

- *Lower `presentAt` from 0.6.* The genuine catch scored **0.25**, so every
  point of slack comes straight off the margin that makes the check work.
- *Score the page line against the title too* — the symmetric fix, which looks
  obviously right. `Minnesota Twins vs Detroit Tigers` is half contained in
  `Minnesota Twins vs Chicago White Sox`, so a game genuinely missing from a
  schedule page would be cleared by a different game. It also cleared the fourth
  flag for the wrong reason: the line it matched was `BOOP! The Musical`.

**The lead match must sit beside the listing's own date** (within three
entries), and that is not a refinement — without it the gate would be worse than
no gate. An index page prints its own series name at the top, so `Music on the
Mall` is the lead of every listing in `Music on the Mall: …`, and every night of
a real series becomes unconvictable. Inventing the next night of a real series is
one of the three fabrication shapes this project has actually shipped.

A lead match returns `unchecked`, never `present`: the act being on the calendar
on that date does not attest that *this* show is. The gate can only ever
withdraw an accusation.

Known ceiling, in the code as a `ponytail:` comment: a one-word lead that is
also a bare category link next to a dated entry ("Sports", "Music") would clear
a real absence. That costs a miss, never an accusation.

### The fourth flag was a bad citation, not a bad match — fixed 27 Oct 2026

`The Unauthorized Hallmark(ish) Parody Musical` cites
`tourstoyou.org/resources/venues/hennepin-arts/`, which lists the show
("Hallmark(ish) ~ December 14-15, 2026") beside archived runs from 2020, 2021 and
2022. The title has no lead segment to strip and shares only `Hallmark(ish)`, so
it could not be cleared by the matcher. **The listing was correct all along** —
Pantages Theatre, 14 Dec 19:30, confirmed by Hennepin Arts' own event page,
which scores 1.0.

So the repair was the `source_url`, not the matcher. `npm run correct` gained a
`source_url` field (see docs/MANUAL-VERIFY.md) and the row now cites
`hennepinarts.org/events/the-unauthorized-hallmark-ish-parody-musical-2026`,
with `verified_at` untouched and `source_checked_at` back to null so the new page
is read. The sweep reports `present 4 · NOT ON SOURCE 0` for that host.
`tourstoyou.org` is in `AGGREGATOR_HOSTS`, so nothing new publishes from it
unreviewed.

**A changed citation now nulls `source_checked_at` everywhere**, not just in the
correction tool. `upsertEvents`' conflict clause overwrites `source_url` on
every re-find and used to leave the stamp alone, so a row could carry a brand-new
source with a freshness earned by the old one — and since the budget is ordered
by that stamp, nulls first, the new page went to the *back* of the queue. That
also meant a weekly run could silently revert an operator's citation repair while
keeping it looking checked. Tripwired in
`lib/__tests__/upsert-queries.test.ts`. It does raise the never-checked count
whenever the pipeline legitimately moves a source, which is correct — those pages
genuinely have not been read — but it is worth watching against the ~400/run cap.

### The largest block was not JavaScript — the fixture gate, 27 Oct 2026

Once the composition was measured per listing, the biggest single thing the
sweep could not read turned out to be **33 listings citing team schedule
pages** — and the schedule was in the HTML the whole time, written in a shape
nothing here knew how to read.

A team's own schedule page never repeats the home team. We write *Minnesota
Gophers Men's Basketball vs. Western Illinois*; `gophersports.com` writes the
same game down five separate lines:

```
vs
Western Illinois
The Barn by Blue Cross and Blue Shield of Minnesota
TV: BTN
Nov 16 (Mon)
```

The full title scores **2 of its 6** distinctive words against that, and the
page carries 31 dated entries — under the 50-entry index bar. So the listing
could be neither confirmed nor convicted, permanently.

What makes a fixture checkable is that a schedule page writes each game as a
**block**, and the block says who, where and when. The gate confirms a listing
only when five things agree:

1. **A row naming the opponent and nothing else.** Scoring the opponent's words
   instead gives "Michigan" a perfect 1.0 against a *Michigan State* row.
2. **That row must prove it is a fixture row, by its own structure** — either
   its date sits immediately before it (`gopherpucklive.com` writes
   `Fri. Nov 13, 2026 … 3M Arena at Mariucci` then `Alaska-Anchorage`) or a
   home/away marker sits immediately before it (`gophersports.com` writes `vs`
   on a line of its own).
3. **The marker must say home.** An away row names the same opponent and means
   somewhere else: `at` / `Western Illinois` / `Western Hall, Macomb, Ill.` is
   byte-identical to a home row at the opponent line and differs only in its
   marker.
4. **The date must belong to that block**, found by scanning forward to the next
   marker — never by proximity.
5. **The block must name the venue the listing claims**, when the caller supplies
   one. The sweep does.

Five is what lifts this from *somebody on this page plays Western Illinois that
night* to *a home game against Western Illinois, at the arena we claim, on the
day we claim* — a stronger attestation than a title match. It is also the only
thing that separates one team's schedule from its sibling's: `gophersports.com`
runs parallel men's and women's pages with overlapping opponents, and token
overlap cannot tell them apart, because the site's own navigation names every
sport. Measured: a bogus *Gophers Volleyball vs. Western Illinois* scores **1.00**
against the basketball page — higher than the real title's 0.75.

**Rules 2, 3, 4 and 5 exist because an adversarial review broke the first draft
four separate ways**, each of which confirmed a listing the page did not attest:

- **Proximity has a one-line margin.** The first draft took the date printed
  nearest the opponent. On a real page "Western Illinois" sits five lines after
  `Nov 12 (Thu)` and four before its own `Nov 16 (Mon)` — so two extra lines in
  a block (a streaming line, a promo line, which real pages carry unevenly)
  make the previous game's date nearer. Reproduced: the draft then **confirmed
  the one live wrong listing and refused the right one**, inverting exactly the
  behaviour it was credited with.
- **A bare name is not a fixture.** With no structural requirement, a "Denver"
  in a region nav standing a few lines from a dated entry confirmed a listing —
  and because this gate runs *before* the index gate, inserting " vs. " into a
  title could turn a real `absent` into `present` and silence an accusation.
- **The away marker was read on our title and ignored on the page.**
  `opponentSegment` refuses " at " in *our* title, which is a rule about our
  syntax; the page's own marker was never consulted, and the residue check even
  stripped `at` as noise.
- **A row that prints its year must print ours.** `pageCoversDate` matches month
  and day alone — index pages omit the year — so a listing dated 2027-11-13 was
  confirmed by `Fri. Nov 13, 2026`. Wrong-year re-dating is one of the three
  fabrication shapes this project has shipped.

A fifth finding was a plain bug: a six-character floor on what counted as a
dated entry made `Nov 5` invisible, so the search reached past the true date to
the next game's.

**None of the five rules cost a confirmation.** Re-measured live after each:
still 26, the same 26.


It can only ever return `present`; it never convicts. Live, it confirms 26 of
the 33, all on `gophersports.com` and `gopherpucklive.com`, and no other host
changed. The seven it leaves alone each fail legibly: three volleyball titles
carry a nickname the page omits (*Penn State Nittany Lions* against a page that
says *Penn State*), three sit on a schedule-announcement article and a
text-only schedule page, where the team name appears with neither a marker nor
an adjacent date, and one is a listing that is simply wrong.

**It found a wrong listing on its first run.** We publish *Gophers Men's
Basketball vs. Western Illinois* on **12 Nov 2026**. The official schedule puts
Western Illinois on the **16th** and Southern on the 12th, and we carry the
16th as a separate listing. The gate declined to confirm the 12th — which is
the whole purpose, and the reason proximity was not good enough.

## What it does to a row

A missing listing is **flagged and un-verified. Never archived, never edited.**

Withdrawing `verified_at` is deliberate: the ops digest's queue only reports
flags on *unverified* listings, so a fabrication carrying a stamp would be
flagged into a place nobody looks — which is exactly how this one survived. And
a verified claim that its own cited source does not corroborate has not earned
the stamp.

Flags land as `verify_flag` audit rows with verdict `not_on_source`, so they
appear in the existing ops-digest queue and on `/admin/ops` with no new plumbing.
They are self-clearing the same way the others are: computed from the listing's
current state, not from flag count.

## The budget rotates — it used to have a hole

One fetch per distinct source URL, capped by `--limit` (default 400). On 21 Sep
2026 the calendar had **593 distinct pages**, so the cap binds.

Until that date the cap was taken off a list ordered by `source_url`. That is
alphabetical and identical every week: the same 400 pages were checked every
run, and the other ~193 were not checked late — they were **never checked at
all**. A fabricated listing was exempt from the fabrication check purely by
citing a host that sorts after the cut.

Pages are now ordered **stalest first** (`stalestFirst` in
`lib/source-presence.ts`), on a nullable `events.source_checked_at` stamped
after each page is read. Never-checked pages go first, then oldest-checked. The
whole calendar is covered every `ceil(pages / limit)` runs — two, at today's
numbers — and the run log says so:

```
[sources] 902 live listings across 593 distinct pages; fetching 400 stalest
          (593 never checked) · full sweep every 2 runs
```

A page counts as never-checked if **any** listing on it is unstamped, so a new
listing on an old page earns the page a fresh read.

**Only pages we actually read are stamped.** An unreadable one keeps its null
and comes up again next run, which is what you want from a dead source. The
ceiling: if unreadable pages ever approached `--limit` they would crowd out
every readable page and the sweep would stall silently. Comfortable at 41 of
593; if that ratio climbs, stamp failures with a backdated time instead.

## Four problems were wearing one name

Every doubt returned `unchecked`, so "how much of the calendar is structurally
unverifiable?" could not be answered from data. It was answered wrongly twice
in one day.

First as **"177 listings behind hosts that 403 a script"**, read straight off a
dry run's `unchecked` count. Then, correcting that, by probing **one page per
host** across 97 hosts and attributing each host's whole listing count to the
verdict of the single page sampled:

| cause | hosts | listings |
|---|---|---|
| readable, but not a dated index | 69 | 348 |
| readable index, simply not swept yet | 12 | 61 |
| blocked (401/403/429) | 12 | 59 |
| dead link, HTTP error, thin page | 4 | 10 |

**That table is wrong too, and the error is the instructive part.**
`first-avenue.com` has 170 upcoming listings. One of them cites
`/venue/first-avenue/`, which really is a JavaScript calendar — 200 OK with
zero dated entries. The other 163 pages on that host are each a listing's own
event page, and every one carries its title plainly. Sampling the venue page
and multiplying by the host's listing count invented about sixty unverifiable
listings that verify fine.

Measured per **listing** on 27 Oct 2026 — every cited page fetched, every title
scored, which is exactly what the sweep does:

| verdict | listings |
|---|---|
| **present** — the page names it | **465** |
| not an index, so the page cannot convict | 86 |
| unreachable (403 · 429 · redirect loop · 404) | 76 |
| day not covered, partial match, thin page, weak title | 15 |
| **absent** | **0** |

72% of the calendar was already verifiable from plain HTML, and the real
remainder is 177 — the number this started with, arrived at honestly for the
first time. The lesson is in the method, not the arithmetic: a per-host sample
answers a question about hosts, and every question worth asking here is about
listings.

So the sweep now records **why**, on every attempt, in
`events.source_check_note` — `category:detail`, written even when the timestamp
deliberately is not (`pageNote` in `lib/source-presence.ts`). The run prints the
breakdown, and the Monday email's coverage line names its causes instead of
guessing at them. The question is a query now.

Two things were measured and then deliberately **not** built:

- **A 429 retry.** `new.artsmia.org` answers 429 to every path including
  `robots.txt` and never clears — 15 seconds, the apex domain, three paths, no
  `Retry-After`. It is a block wearing a rate limit's number, so a backoff
  there would have been dead code.
- **Re-citing the aggregator-sourced rows** to the venue's own page. Of the 59
  blocked, 29 cite an aggregator or an API rather than the organiser, and the
  registry already holds an organiser URL for 27 of them — but every one of
  those targets is blocked or JS-rendered, so the re-citation buys a more
  honest citation and **no verification**. Worth doing as data hygiene, not as
  a fix for this.

## The decision this leaves open

`minnesotaorchestra.org` (13 listings) and `guthrietheater.org` (9) **serve
`robots.txt` happily and declare `Allow: /`** for `User-agent: *`; the Guthrie
even advertises its sitemap there. Every actual path then answers 403, sitemap
included. That is an overbroad edge rule contradicting the site's own published
policy — which is a different thing from the stance below, and the call is
Taren's: leave them, identify as a browser, or ask the organisations.

## Known limits, stated plainly

- **The check cannot tell one year from the next on a yearless page.**
  `pageCoversDate` matches month and day only, because index pages omit the
  year — so a listing re-dated by exactly a year, onto a day the page really
  covers, is confirmed. The fixture gate refuses this when the matched row
  prints a four-digit year; the title path, which confirmed 465 listings, has no
  such guard. Closing it properly means establishing a page's season span. It is
  the largest known hole in the check and it is NOT the blocked hosts.
- **Small organiser calendars are not checked.** The 50-entry bar excludes a
  parish with ten events. That is a miss, not a false accusation, and it is the
  right direction to err.
- **JavaScript calendars are a real limit, and a small one.** Of the 86 listings
  whose cited page cannot convict, almost none carry a client-side payload —
  they are team schedules, aggregator pages and single-event pages.
  `first-avenue.com/venue/first-avenue/` is a genuine JS calendar and exactly
  one listing cites it. Rendering JavaScript in the weekly job was costed
  against this measurement and is not worth it; what the measurement pointed at
  instead was the fixture gate above.
- **Sites that block us return 403** and stay `unchecked`. The fetch identifies
  itself honestly; a site that would rather we did not read it gets that wish.
  59 listings across 12 hosts, now countable rather than estimated.
- **A dropped connection no longer kills the run.** The first full sweep died at
  page 580 of 677: a pooled HTTP/2 socket emitted `'error'` *after* its fetch had
  already settled, so no promise was left to reject and Node raised an uncaught
  exception. There is now a top-level guard that swallows socket-shaped failures
  and counts them in the summary. Anything else still crashes loudly — a real
  bug hiding behind that handler would be worse than the crash it replaces.
- It proves a title is *on a page*, not that the event is real. A page can be
  wrong. This is a cheap first filter, not a verdict.
