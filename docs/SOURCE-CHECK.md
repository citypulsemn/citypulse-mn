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
any SQL template, which is the narrow cause. The broad cause — a passing
`npm test`, a green build and a four-week-dead weekly job all coexisting — has
no guard yet.

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

## Known limits, stated plainly

- **Small organiser calendars are not checked.** The 50-entry bar excludes a
  parish with ten events. That is a miss, not a false accusation, and it is the
  right direction to err.
- **JavaScript calendars are invisible.** If the events are drawn client-side we
  read only the nav menu, and gate 1 refuses.
- **Sites that block us return 403** and stay `unchecked`. The fetch identifies
  itself honestly; a site that would rather we did not read it gets that wish.
  Roughly 60 of 677 pages refuse us, `guthrietheater.org` and
  `bringmethenews.com` among them.
- **A dropped connection no longer kills the run.** The first full sweep died at
  page 580 of 677: a pooled HTTP/2 socket emitted `'error'` *after* its fetch had
  already settled, so no promise was left to reject and Node raised an uncaught
  exception. There is now a top-level guard that swallows socket-shaped failures
  and counts them in the summary. Anything else still crashes loudly — a real
  bug hiding behind that handler would be worse than the crash it replaces.
- It proves a title is *on a page*, not that the event is real. A page can be
  wrong. This is a cheap first filter, not a verdict.
