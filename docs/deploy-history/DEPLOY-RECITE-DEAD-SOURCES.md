# Deploy — re-citing eight dead sources, and the four that turned out not to be real

**28 Oct 2026.** One line of library code, one test, one data file for an
operator to apply. No schema change.

## What this was meant to be

A tidy-up. Eight live listings cited a page that no longer answers:

| listings | cited page | what it does now |
|---|---|---|
| 4 | `armorymn.com/events/` | 307, every path, to any script |
| 3 | `womenspress.com/event/toddler-music-lab-…/2026-11-03/` | 404 |
| 1 | `womenspress.com/organizer/minnesota-childrens-museum/` | 404 |

Half of it was a tidy-up. The other half was four fabrications, two of them
stamped verified, one of them today.

## The Armory four — citations repaired

`armorymn.com` is **not a dead link and not a redirect loop.** It is a Sucuri
WAF serving a JavaScript cookie challenge: a 307 whose body is
`<noscript>Javascript is required</noscript>` and an obfuscated script. The
site's own `robots.txt` answers 200 through the same WAF, says
`User-agent: *` / `Disallow:` — allow everything — and advertises a sitemap.
So this is the `minnesotaorchestra.org` / `guthrietheater.org` shape: a
published policy of yes and an edge rule of no.

**The sitemap is readable.** `post-sitemap.xml` came back 200 and listed 22
`/events/<slug>/` URLs, including one for each of our four shows. Opened each
in a browser, which the challenge admits:

| listing | our start | the venue's own page |
|---|---|---|
| Ganja White Night – Wobbleween (Night 1) | 30 Oct 2026, **21:00** | "Friday, October 30, 2026 · Doors at 6:00 // **Show at 6:15**" |
| Orville Peck (with Abbie Callahan) | 3 Nov 2026, 20:00 | "Tuesday, November 3, 2026 · Show at 8:00" ✓ |
| Jack White Live 2026 | 8 Nov 2026, 20:30 | "Sunday, November 8, 2026 · Show at 8:30" ✓ |
| Sabaton (with Pop Evil and Wings of Steel) | 22 Nov 2026, 19:00 | "Sunday, November, 22nd · Show at 7:00pm" ✓ |

Four dates confirmed, three start times matching the venue's **show** time
exactly — which is what establishes the convention, and what makes the fourth
a finding rather than a quibble. **Wobbleween Night 1 is listed at 21:00
against a 6:15 show**, two days out. Left alone: it is a time on a real show
on the right night, and a 2¾-hour move is a product call, not a citation
repair. The one-line addition is in the Verify section below.

Re-citing them from the shared index to each show's own page buys a reader the
exact page instead of a venue index, and buys the weekly sweep nothing — the
event pages carry the same 307. Said plainly rather than implied: after this
lands, those four rows will record `blocked:307` where they currently record
nothing at all, which is an honest note replacing a silence.

## The Women's Press four — not re-citable, because they are last year's

The 404 was the symptom. Going to the organiser instead:

| our listing | the museum's own page |
|---|---|
| Bounce & Boogie, **28 Oct 2026** 10:30 | "October 28, **2025** 10:30 am - 11:30 am" |
| Echo & Explore, **3 Nov 2026** 10:30 | 7 Oct **2025** and 4 Nov **2025** |
| Splish Splash, **18 Nov 2026** 10:30 | "November 18, **2025**" |
| Bounce & Boogie, **25 Nov 2026** 10:30 | "November 25, **2025**" |

Same month, same day, same 10:30 start, one year earlier. 28 Oct 2025 was a
Tuesday; 28 Oct 2026 is a Wednesday. The museum ran a four-week Tuesday
series — its own page says "join us for the entire 4-week series" — in autumn
**2025**.

Three checks, because a stale organiser page would look the same:

1. **The museum's event pages are current.** 46 of its 331 event URLs were
   modified in 2026, and the 2026 ones carry 2026 dates: Monster Yoga
   17 Oct 2026, Halloween Party 24 Oct 2026, New Year Party 30 Dec 2026.
   Every Toddler Music Lab page was last touched in 2025.
2. **Its rendered calendar is empty on those days.** The calendar is
   JavaScript, so it was opened in a browser. October 2026 holds Securian Free
   First Sunday, three Monster Yogas and two Halloween Parties — nothing on the
   28th. November 2026 holds Securian Free First Sunday on the 1st and nothing
   else at all.
3. **The series is eight rows, not four, and the first four are already
   archived** — 7, 14, 17 and 21 October, every one of them stamped verified.
   Those are the 2025 series' Tuesdays, archived as their dates passed. The
   same eight-row shape, from the same source, confirmed six times by the
   verify pass.

So these four come down rather than get re-cited. Nothing is deleted; one
`status` flip reverses it.

## Archiving them did not take them down

The first apply set them to `archived`, which is what `CLAUDE.md` means by
"never delete events — archive them". They left every list, every feed and
the sitemap. **And all four went on serving their own event pages**, which is
how the smoke caught it: `/event/4821c4fc…` answered with the full listing,
title, date and all, forty seconds after the apply, on a fresh render rather
than a stale cache.

`getEvent` filters `status <> 'draft'`, deliberately: `isPublicStatus` is
documented as "anything except an unpublished draft", so a show that really
happened keeps the URL that went out in a digest or a share. That is right for
a past event and wrong for a fabrication, which never happened at all.

The house takedown is `draft`, and two places already say so — `hideEvent` in
`lib/admin-actions.ts`, and the one-tap button in `/report-action`, whose own
email copy reads "it stays in the database as a draft and one click in Admin
puts it back". The corrections file had no way to ask for that: `archive: true`
was its only takedown. So the file asked for the wrong one.

**`hide: true` is now the other lever** (`lib/corrections.ts`,
`scripts/apply-correction.ts`). It writes `draft`, refuses to combine with
edits or with `archive: true`, says `already hidden` when the row is a draft
already, and prints `⊘ HIDE` so it can never be misread as an archive in a dry
run. A source tripwire in the tests asserts the two levers write **different**
statuses — the assertion that would have caught this — and was proven to bite
by pointing the hide branch at `archived`.

## The one-line fix, which is for the category

`womenspress.com` is now in `AGGREGATOR_HOSTS` (`lib/source-trust.ts`). A
monthly magazine running a community calendar is a roundup however local it is
— the rule the file already states for a tourism board and a radio station.

What that changes, for future finds and for the rows already here:

- `statusForNewEvent` holds a womenspress-sourced find as **draft**, so it
  never reaches a reader unverified. Had this line existed, all eight would
  have been drafts.
- `verify.ts` sorts roundup-sourced rows to the **front** of the verify queue
  and tells the agent its source is a roundup.
- `validateCorrection` refuses a correction that re-cites *to* womenspress.

Nothing hides or re-labels an existing published row at render time — every
consumer was checked. The two surviving womenspress rows (May 2026 museum
exhibits, both in the past, both unverified) are untouched.

`lib/__tests__/source-trust.test.ts` pins it, with the incident in the
comment. Proven to bite by commenting the host out: 1 failed, 64 passed.

## What this does not fix

The hole that let it through is `pageCoversDate` matching **month and day
only** — documented in `docs/SOURCE-CHECK.md` as the largest known hole in the
source check. This is its first measured live instance: a year-shifted listing
on a day the source really covers, confirmed. Closing it properly means
establishing a page's season span, which is a design decision and not this
deploy.

The second hole is the verify pass, which stamped six of these eight. That is
the weakness recorded on 10 Sep 2026 when a reader caught a fabrication the
verify pass had confirmed, and it is still open.

## Deploy — done, and what was observed

Code pushed to `main` (Vercel auto-deploys). No schema change.

Thirteen row changes, applied with `npm run correct` in five passes. Five
passes rather than one because each later one came out of smoking the one
before it — the lever mistake, then the Wobbleween span, then the same span at
Tape B, then the two nights that clearing those spans had left listed nowhere.
Every pass wrote its own backup; they are listed under **Rollback**.

```
pass 1   8 applied, 0 refused, 0 unchanged   4 citations repaired + 4 archived
pass 2   4 applied, 0 refused, 4 unchanged   those 4 archives -> hidden (draft)
pass 3   1 applied, 0 refused, 0 unchanged   Wobbleween N1 time, end, span
pass 4   1 applied, 0 refused, 0 unchanged   Tape B N1 end, span, citation
pass 5   2 applied, 0 refused, 0 unchanged   both second nights restored

caches cleared on every pass: +8, +4, +1, +1, +2 event pages
```

Read back from the database, not assumed:

```
published  10-30 18:15  v=1  Wobbleween (Night 1)   armorymn.com/events/wobbleween-night-1/
published  10-31 18:15  v=1  Wobbleween (Night 2)   armorymn.com/events/wobbleween-night-2/
published  11-03 20:00  v=1  Orville Peck           armorymn.com/events/orville-peck/
published  11-08 20:30  v=1  Jack White Live 2026   armorymn.com/events/jack-white/
published  11-20 21:00  v=1  Tape B                 armorymn.com/events/tape-b-night-1/
published  11-21 21:00  v=1  Tape B                 armorymn.com/events/tape-b-night-2/
published  11-22 19:00  v=1  Sabaton                armorymn.com/events/sabaton/
draft      10-28 10:30       Bounce & Boogie
draft      11-03 10:30       Echo & Explore
draft      11-18 10:30       Splish Splash
draft      11-25 10:30       Bounce & Boogie

source_checked_at   null on every re-cited row (so the next sweep reads the new page)
end_at / span       null on all six Armory rows that had an unattested one
armory upcoming     6 listings across 6 distinct URLs (was 4 sharing 1)
womenspress         0 published upcoming (was 4)
admin_audit         one row per change, each carrying its own why
```

The three `corrections*.json` files in the repo root are working files and are
not committed. Delete them once you have read them.
## Verify — taken on the live site

```
/event/4821c4fc…   "Event not found — City Pulse MN"   (was the full listing)
/event/25575fd3…   "Event not found"
/event/a404066f…   "Event not found"
/event/a1dbfabb…   "Event not found"
/day/2026-10-28    0 occurrences of "Toddler Music Lab"
/api/events        0 occurrences
/sitemap.xml       1578 URLs, none of the four ids
/event/b7a2f136…   200, and the page now links armorymn.com/events/jack-white
```

**One thing left open, and it is pre-existing:** those four pages answer **200**
with the not-found body, not 404. `notFound()` is called correctly in
`app/event/[id]/page.tsx`, so this is a soft 404 on every unknown event id —
a made-up UUID answers 200 too — and not something this change introduced.

**Checked rather than assumed, and it is smaller than it first looked:** the
not-found page carries `<meta name="robots" content="noindex"/>`, so a search
engine is told not to index it. The content is gone and the URL is not being
advertised. What is left is the status code itself being wrong, which costs
crawl budget and misleads anything that keys on 404 rather than on the body.
Worth its own look, at a lower priority than the first draft of this paragraph
implied.

Next sweep:

```bash
npm run check-sources -- --host=armorymn.com
```

Expect four listings at four distinct URLs instead of four sharing one, and
`blocked:307` recorded against each — the honest note, not a confirmation.

## The Wobbleween time — fixed, and it was wrong three ways

We listed it **9:00 PM – 2:00 AM, Oct 30 – 31**. The Armory's own page for the
show says **"Friday, October 30, 2026 · Doors at 6:00 // Show at 6:15"**, 18+,
and states no end time at all. Night 2's page says the same shape for Saturday.

Where the wrong numbers came from, from the audit trail: this row cited
`resources.onestowatch.com/armory-minneapolis-upcoming-shows/` until 5 Oct,
when a source-upgrade pass repointed it at the venue. `onestowatch.com` is in
`AGGREGATOR_HOSTS`. **Both** the 21:00 and the 02:00 came off that roundup —
and it gave the archived Night 2 row the identical 21:00, while the venue says
6:15 for that night too. One roundup, one wrong number, twice.

Three fields, and the reasoning for each:

- **start → `2026-10-30T18:15`.** The venue's show time, which is the
  convention the other three Armory listings already follow.
- **end → cleared.** CLAUDE.md: *"Never invent an event, a date, or an end
  date."* The venue publishes none, and the 02:00 came from the same roundup as
  the start it just disproved. A null end is a handled state —
  `DEFAULT_DURATION_MS` (2h) covers the is-it-on-now logic.
- **multi_day_end → cleared.** The Armory sells Night 1 and Night 2 as separate
  ticketed shows. A Friday show is not an Oct 30 – 31 run.

`verified: true`, legitimately: the evidence is the organiser's own page
showing exactly these values. The day does not change, so `event_key` stayed
`8b40652…` and there was no collision to check.

### There was no way to fix the span

`multi_day_end` was written by `collapse-multiday` and `upsert` and **nothing
else** — not the Admin panel, not corrections. So "Oct 30 – 31" had been on a
live listing for weeks with no operator fix short of raw SQL. It is a
`Correction` field now: a day (`YYYY-MM-DD`) or null to un-collapse, written as
`<day>T23:59` exactly as the collapse does. It is deliberately **not**
verify-relevant — `lib/verify.ts` is never shown the span — so changing it
leaves the stamp alone, and `verified: true` on a span-only change is refused
the same way a pin-only one is.

The repo's existing tripwire counted **two** `::text::timestamp` casts in that
UPDATE, which is the guard against the postgres.js five-hour param shift. It
now counts three and names all three columns, so the next timestamp column
added without the cast fails loudly instead of shipping times five hours off.

### Observed, after

```
db     start 2026-10-30 18:15 · end null · multi_day_end null · verified · key 8b40652…
live   "6:15 PM" · "October 30, 2026" · Friday · no "9:00 PM", no "2:00 AM", no "Oct 30 – 31"
```

## Tape B — the same fold, and the aggregators had the time right

Four rows for one weekend, which is what two sources times two nights produces:

```
archived   Fri 20 Nov 21:00   Tape B – Friday Pass     ticketmaster.com     verified
PUBLISHED  Fri 20 Nov 21:00   Tape B      span → 21    concertarchives.org  verified
archived   Sat 21 Nov 21:00   Tape B – Saturday Pass   ticketmaster.com     verified
archived   Sat 21 Nov 21:00   Tape B                   concertarchives.org
```

The dedupe kept one and archived three; the collapse then gave the keeper a
two-day span. **The venue's own pages settle it conclusively** — not by the
dates but by the bills, which share no act at all:

- **Night 1**, Friday 20 November 2026: *MERSIV, SAKA, FLY, STVSH + CLAYBROOK*
- **Night 2**, Saturday 21 November 2026: *TROYBOI, TAIKI, NIGHLIGHT, WINK*

Two different shows, sold separately, by the same headliner. Not a run.

**And the time was already right.** Both pages read *"Doors at 9:00 // Show at
9:00"*, so the 21:00 the aggregators supplied is correct and stays — worth
stating, because the Wobbleween fix two sections up could read as a rule that
aggregator times are always wrong. They are unattested, which is different.

So three fields, not four:

- **multi_day_end → cleared.** Different bills on different nights.
- **end → cleared.** The venue publishes none; the 01:00 came from
  `concertarchives.org`, the same page this row cited.
- **source_url → `armorymn.com/events/tape-b-night-1/`**, off
  `concertarchives.org`. A third-party concert archive is not the organiser.
  This resets `source_checked_at`, so next week's sweep reads the new page.
- **start → untouched at 21:00**, now resting on the organiser instead of an
  archive site.

### Observed, after

```
db     start 2026-11-20 21:00 · end null · multi_day_end null · verified
       source_url armorymn.com/events/tape-b-night-1/
live   "9 PM" · "November 20, 2026" · Friday · no "Nov 20 – 21" · links the venue page
```

That page also shows the other three Armory repairs in its sibling cards —
Wobbleween 6:15 PM, Orville Peck 8 PM, Jack White 8:30 PM — which is the whole
set visible in one fetch.

### What is actually left here

**Both nights are titled plain "Tape B"** while the venue distinguishes them.
Left alone on purpose: `event_key` is `sha(title | venue | start day)`, so
retitling moves the identity — and the next pipeline run would find "Tape B" at
its source, compute the OLD key, match nothing, and insert a duplicate beside
the renamed row. The dates already tell them apart for a reader. Worth doing
once, deliberately, for both rows — not on the way past.

**The ticket links point at aggregators.** `jambase.com/venue/the-armory-…` for
Tape B and `livenation.com/venue/…/armory-events` for Wobbleween are each that
site's generic page for the venue, not the show's tickets. `ticket_url` is not
a `Correction` field, so that one needs Admin. Measured across the calendar
while I was in here: of 632 upcoming published listings, **9** carry an
aggregator ticket link and **none** a reseller — small, and not new.

## Both second nights restored

The collapse had archived each second night into its Night 1 span, so clearing
those spans left two real Saturday shows listed nowhere. Both are back, with
the venue's own numbers rather than the ones they were archived with:

| | our start | the venue's page | citation was |
|---|---|---|---|
| Wobbleween Night 2 | **Sat 31 Oct, 18:15** (was 21:00) | "Saturday, October 31, 2026 · Show at 6:15" | `onestowatch.com` |
| Tape B Night 2 | **Sat 21 Nov, 21:00** (unchanged) | "Saturday, November 21, 2026 · Doors at 9:00 // Show at 9:00" | `concertarchives.org` |

Both ends cleared — neither venue publishes one — and both now cite the
organiser's own page for that night, which resets `source_checked_at` so next
week's sweep reads it.

For Tape B there were **two** archived candidates for the Saturday. Kept
`b439fe30`, titled plainly *Tape B*, over `9acaf562`, titled *Tape B – Saturday
Pass* — a pass is a ticket type, not the name of a show. The other stays
archived rather than deleted.

All four nights now read the same way:

```
published  Fri 30 Oct 18:15  Wobbleween (Night 1)  armorymn.com/events/wobbleween-night-1/  verified
published  Sat 31 Oct 18:15  Wobbleween (Night 2)  armorymn.com/events/wobbleween-night-2/  verified
published  Fri 20 Nov 21:00  Tape B                armorymn.com/events/tape-b-night-1/      verified
published  Sat 21 Nov 21:00  Tape B                armorymn.com/events/tape-b-night-2/      verified

live   /event/6ced099c…  "6:15 PM" · "October 31, 2026"  · links the venue's night-2 page
live   /event/b439fe30…  "9 PM"    · "November 21, 2026" · links the venue's night-2 page
live   /day/2026-10-31 lists Wobbleween · /day/2026-11-21 lists Tape B
```

### The file could take a listing down two ways and put one back none

`archive` and `hide` both existed; nothing restored. Admin has a Restore
button, and `restore-drafted.ts` republishes — but only rows drafted by the
wrong-event sweep, and it spends model money to re-derive a date the venue page
had already given me. So **`publish: true`** is the third lever
(`lib/corrections.ts`, `scripts/apply-correction.ts`).

Two deliberate asymmetries with the takedown flags:

- **It requires `evidence`.** It is the only lever that puts a listing in front
  of a reader, so a row comes back because a page says the event is real, never
  because someone remembered it. A takedown that is wrong is one click from
  fixed; this direction is the one that can do harm.
- **It may carry edits, and usually should.** A row was archived for a reason,
  and restoring it without fixing what was wrong republishes the reason. Both
  of these needed an invented end cleared and a citation moved off an
  aggregator in the same pass.

It writes `status` through the same `put`/`nextValue` path as every other
column, so a restore shows up in the dry run, the audit patch and the backup
like any other change — and re-running the file once the row is live reports
`nothing`. The dry run labels it `↑ PUBLISH`, never `± EDIT`. The source
tripwire now requires `status` to be read through `nextValue` too; proven to
bite by deleting that line.
## The fold will not do this again, and six rows still wear the old damage

Earlier in this guide I wrote that `planCollapse` was unchanged and would fold
the next pair the same way. **That was wrong, and reading the code is what
corrected it.** `lib/multiday.ts` holds
`PER_NIGHT = new Set(["sports", "music"])`: for those categories the interval
end is forced to the start day, the gap is 0, and the parent-child prefix fold
skips them outright. Music joined that set on **29 Sep 2026**, and the
docstring names the five two-night stands that put it there — *jeremy
messersmith, Sylvan Esso, The Suburbs, Angine de Poitrine, Phantom of the
Opera* — with the same reasoning I had just reached from the Armory's lineups,
and better proof: each pair carried two distinct `ticket_url`s.

Confirmed rather than assumed. `npm run collapse -- --dry-run` after the
restore proposes **four actions, none of them these** — all four are one
unrelated recurring art-contest exhibit:

```
[collapse] 970 events, 4 action(s) (DRY RUN)
[collapse] 4 run(s), 0 duplicate group(s), 0 fold(s), 16 row(s) archived
```

So Wobbleween and Tape B were **legacy** folds, written before the rule existed.
The rule stopped new ones; nothing ever cleared the spans it had already
written. **Six upcoming music rows still carry one**, and three of them are the
exact shows named in that docstring:

```
31 Oct..01 Nov  Phantom of the Opera                              Fitzgerald Theater
07 Nov..08 Nov  The Many Deaths of Laila Starr (Minnesota Opera)  Ordway Center
10 Nov..11 Nov  Schubert Club Presents (Concert)                  Ordway Concert Hall
10 Nov..11 Nov  Schubert Club International Artist Series: J E…   Ordway Center
13 Nov..14 Nov  The Suburbs                                       Turf Club
01 Dec..02 Dec  Angine de Poitrine                                First Avenue
```

Each shows a two-day run for what is almost certainly two separately ticketed
performances, and each wants its second night checked against the organiser
before anything is cleared or restored — the Turf Club and First Avenue pages
read fine to a script, the Ordway's may not. The tool to do it exists as of
today. Six rows, and the call is yours.
## Rollback

```bash
git revert <sha> && git push origin HEAD:main
```

For the data, every pass wrote a backup to `Documents\CityPulseMN\backups\`,
in the order they were applied:

```
2026-10-28-recite-dead-sources-before.json       all eight, before anything
2026-10-28-recite-dead-sources-hide-before.json  the four fabrications, as archived
2026-10-28-wobbleween-time-before.json           Night 1, at 21:00 with its span
2026-10-28-tapeb-span-before.json                Tape B Night 1, with its span
2026-10-28-second-nights-before.json             both second nights, as archived
```

Each holds the full prior row, so any one pass can be undone on its own.
Nothing in this session was deleted: the four fabrications are drafts, the
two superseded duplicates are archived, and `publish: true` or the Restore
button in Admin → Events brings any of them back.
