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

The eight row changes were applied with `npm run correct`, in two passes
because of the lever mistake above. Backups are in
`DocumentsCityPulseMNackups`:
`2026-10-28-recite-dead-sources-before.json` (all eight, pre-change) and
`2026-10-28-recite-dead-sources-hide-before.json` (the four, as archived).

```
pass 1   8 applied, 0 refused, 0 unchanged        4 citations + 4 archives
         site caches cleared (+8 event pages)
pass 2   4 applied, 0 refused, 4 unchanged        the 4 archives -> hidden
         site caches cleared (+4 event pages)
```

Read back from the database, not assumed:

```
published  10-30 21:00  v=1  Wobbleween (Night 1)   armorymn.com/events/wobbleween-night-1/
published  11-03 20:00  v=1  Orville Peck           armorymn.com/events/orville-peck/
published  11-08 20:30  v=1  Jack White Live 2026   armorymn.com/events/jack-white/
published  11-22 19:00  v=1  Sabaton                armorymn.com/events/sabaton/
draft      10-28 10:30       Bounce & Boogie
draft      11-03 10:30       Echo & Explore
draft      11-18 10:30       Splish Splash
draft      11-25 10:30       Bounce & Boogie

source_checked_at   null on all four Armory rows (so the next sweep re-reads them)
admin_audit         8 correction rows + 4 more, each carrying its why
armory upcoming     4 listings across 4 distinct URLs (was 4 sharing 1)
womenspress         0 published upcoming (was 4)
```

`corrections.json` is a working file and is not committed. Delete it.

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
`app/event/[id]/page.tsx`, so this is a soft 404 on every unknown event id, not
something this change introduced. It does not put the listing in front of a
reader — the content is gone — but it does keep the URL looking alive to a
crawler. Worth its own look.

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

## Three things this leaves for you

**1. Night 2 is not on the calendar.** It is archived — the collapse folded it
into Night 1's span, and clearing that span does not bring it back. It is a
real Saturday show at the Armory and we now list neither it nor a span hinting
at it. The venue page gives the same shape, so the entry is ready:

```json
{
  "id": "6ced099c-51ab-4c13-bace-4c833b451f5a",
  "why": "a separately ticketed second night, archived by the multi-day collapse; the venue sells it on its own page. Time from that page, not from the onestowatch roundup this row still cites.",
  "evidence": "https://armorymn.com/events/wobbleween-night-2/",
  "source_url": "https://armorymn.com/events/wobbleween-night-2/",
  "start": "2026-10-31T18:15",
  "end": null,
  "verified": true
}
```

That corrects it but does **not** republish it — `status` is not a correctable
field and `hide`/`archive` only go one way. Restoring is the Restore button in
Admin → Events, or `update events set status = 'published'`. Putting a listing
back on the calendar is a product call, so it is not taken here.

**2. Tape B, 20 – 21 Nov, is the same shape.** Same venue, same fold: the
published row spans two days and the archived sibling is titled "Tape B –
Saturday Pass", which is the venue telling us they are sold separately. One
correction away now that the field exists.

**3. The fold itself.** 23 upcoming published listings carry a span. Most are
true runs — *Beavers and Botanicals* over five days, *A Christmas Carol*, a
comedy residency, weekend markets — and should stay. The question is the ones
sold **per night**: Wobbleween, Tape B, and arguably the two-performance
orchestra and opera programmes. `planCollapse` folds on a shared title prefix
and consecutive days, which cannot see the difference between a run you buy one
ticket for and two shows you buy two. Teaching it that is a product decision
with 23 listings behind it, not a repair.
## Rollback

```bash
git revert <sha> && git push origin HEAD:main
```

For the data, `2026-10-28-recite-dead-sources-before.json` holds every prior
value. The four hidden rows come back with one `status` update each — or the
Restore button in Admin → Events, which is the same thing. Nothing was deleted.
