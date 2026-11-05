# Deploy — two productions were carrying ten rows between them

**5 November 2026.** Data only. No code shipped, no tracked file changed, so
there is nothing to deploy: the ten corrections are already applied to
production and the site caches were purged by the apply. This guide is the
record and the rollback.

The two largest remaining duplication clusters on the calendar, both named as
open in `end-at-stuffed-with-run-end`:

| | published rows before | after |
|---|---|---|
| Monsters on Vacation @ Minnesota Children's Museum | **5** | 1 |
| Fall Flower Show @ Como Park Zoo & Conservatory | **5** | 1 |

One title was also wrong, which is what started this: the surviving Monsters
row was called *Monsters on Summer Vacation*.

## What was live

Every row below is the same single exhibition or show. The pattern is the one
the run-fold shipped for yesterday: `event_key` is
`sha256(title | venue | start DAY)` and the weekly pipeline writes the day it
*found* the thing, so each pass mints a fresh identity for a run already on the
calendar.

**Monsters on Vacation** — attested window 23 May 2026 – 10 Jan 2027:

| id | start | end held | title as stored |
|---|---|---|---|
| `e80b7021` | 2026-05-23 | 2027-01-10 | Monsters on **Summer** Vacation (Special Exhibit) |
| `9750dfbd` | 2026-08-17 | 2027-01-10 | Monsters on Vacation (Special Exhibit) |
| `ce9db21c` | 2026-08-24 | 2027-01-10 | Monsters on Vacation (Special Exhibit) |
| `8b031da6` | 2026-11-02 | 2027-01-10 | Monsters on Vacation – Special Exhibit |
| `48ad61ac` | 2026-11-12 | **2026-12-11** | Monsters on Vacation – Special Exhibit at Minnesota Children's Museum |

`9750dfbd` and `ce9db21c` are byte-identical in title, venue, city, end and
citation and differ only by one week of start date. That is the mechanism with
nothing else attached to it.

**Fall Flower Show** — attested second display 23 Oct – 29 Nov 2026:

| id | start | end held | title as stored |
|---|---|---|---|
| `7d5fa345` | 2026-10-23 | 2026-11-18 | Fall Flower Show – Part 2 **Opening** |
| `542818d1` | 2026-10-26 | 2026-11-25 | Fall Flower Show – Part 2 |
| `dcb7cd27` | 2026-11-01 | 2026-11-16 | 2026 Fall Flower Show – Part Two (Lion-Inspired) |
| `612541bd` | 2026-11-01 | **2026-11-13** | Como Conservatory Fall Flower Show – Lion-Themed Second Half |
| `515eb8bd` | 2026-11-02 | 2026-11-29 | Como Conservatory Fall Flower Show |

**Five different closing dates for one show, and not one of them on the row
with the right start.** `515eb8bd` had the correct 29 November; `7d5fa345` had
the correct 23 October; no row had both.

## What the organisers actually print

### Minnesota Children's Museum

> "Monsters on Vacation" is open for play at Minnesota Children's Museum from
> May 23 through Jan. 10, 2027.

— `mcm.org/monsters-on-vacation-opens-may-23/`, Visitor Information. The name is
confirmed independently by `mcm.org/special-exhibit-gallery/`, which titles the
current special exhibit *Monsters on Vacation* and nothing else.

Three things worth keeping:

**The stored title was not invented, it was two years stale.**
`mcm.org/monsters-are-taking-over-the-museum-this-summer/` is still live and
reads *"Monsters on Summer Vacation opens June 8, 2024 and runs through Labor
Day"*, describing a run with a near-identical component list. So *Summer
Vacation* is a real museum title attached to the wrong year — and the wrong year
is published on the organiser's own domain, which is what makes it a standing
trap rather than a one-off. Anything reading `mcm.org` for this exhibit can land
on it.

**The evidence page contradicts itself on the opening date.** The lede says the
exhibit *"opens June 23"*, against *May 23* in the headline, in the page title,
in the URL slug and in the Visitor Information line. Four placements to one, and
the same release describes *a Monster Party on June 6* as fun available *"In
addition to the 'Monsters on Vacation' special exhibit"* — impossible if the
exhibit opened on the 23rd. The lede is a digit slip.

**No mcm.org page prints a year beside "May 23".** Only the close carries one.
The 2026 start year rests on the museum's own post date of 8 May 2026 on
`/author/dcasper/`, on the 2027 close, and on `/upcoming-special-exhibits/`
placing the successor at *"Jan. 23 – May 9, 2027"*. That is inference, not
attestation. It is recorded rather than smoothed over — and the correction
leaves the start day exactly as the pipeline already had it, so it asserts no
year that was not already asserted.

### Como Park Zoo & Conservatory

> September 18 through October 18 and October 23 through November 29, 2026

> Sunken Garden will be closed for the mid-show change October 19 – October 22

— `comozooconservatory.org/como/sunken-garden-2/`. The closure is what separates
the halves. `/mmc-sunken-garden-live/` carries the second window on its own,
headed *"The Fall Flower Show Is Now Open!"*, with colour copy that matches the
schedule page's Part 2 description verbatim — so it is describing the second
display, not the first. A third Como page carries the same line.

**Como publishes no fall-show opening event, in any year.** Measured on Como's
own site rather than assumed: the event calendar holds no 2026 fall flower show
event of any kind, the site's event search for *flower show* answers *"There
were no results found"*, and the day view for 23 October 2026 — the display's own
first day — lists eight routine programs and no flower show. The event sitemap
does hold opening-day URLs, but for the holiday, summer and spring shows and for
no fall show in any year. So the pattern exists at Como and was never applied to
the fall show. `Part 2 Opening` was ours.

**Two wrong-year traps on Como's own domain**, named so the next pass does not
step in them: `/mums-the-word-at-como/` puts the second half at 5–27 November
behind a closure of *"October 31 – November 4"* (a 2022 post), and
`/fall-flower-show-flamingos/` says *"Part II of the Fall Flower Show is now open
through November 28th"* with no year beside it (2021). Both are the same
October-into-November shape as the real 2026 window. Only pages printing *2026*
adjacent were used.

## Which row survives, and why it is not the best-cited one

The survivor is **the row whose start DAY is the run's first day** — the same
rule the Guthrie and Walker dedupes used on 4 November. Identity is the start
day, so that row is the only one that can hold the run without re-keying onto a
date the organiser does not print.

It costs something each time. For Monsters the best-cited row is `48ad61ac`: it
cites `mcm.org` itself and was stamped verified on 2026-10-12. It is also the
only row that **contradicts the page it cites** — claiming the exhibit closes
11 December when that page prints 10 January 2027. Its 30-day window is a
default measured from the day the pipeline found the exhibit, and the stamp was
granted against a page that disagrees with it. That is the verify-prompt
weakness addressed in `219c6b4`, caught here in the wild.

So the survivor took the window and the better citation moved onto it:
`womenspress.com/organizer/` → the museum's own release.

## The shape change: the run moves off `end_at`

Both survivors had the run's last day stuffed into `end_at` with an invented
clock — `2027-01-10T17:00`, `2026-11-29T16:00`. Neither museum publishes a
closing instant for its show, and neither evidence page prints hours at all. So
`end_at` is cleared and the run moves to `multi_day_end`, the column counted in
days, exactly as `collapse-multiday` writes it.

Render is unchanged by the reshape — `spanEnd` reads both columns, and at 233 and
38 days both runs are past `EXPAND_MAX_DAYS = 14` under either shape — but the
row stops asserting a closing time nobody published.

Neither survivor is stamped. Title and `end_local` are both verify-relevant, so
`verified_at` clears and both rows go back through the verify pass. That is the
right outcome for a listing whose name was wrong and one whose end was eleven
days short, and it costs about 5p each.

## What it cost, measured on the running site

Observed against a local server reading production rows, before and after.

| surface | before | after |
|---|---|---|
| `/this-weekend` total cards | **104** | **97** |
| of those, cards for these ten rows | 9 | **2** |
| `/day/2026-11-10` Fall Flower cards | 1 | **0** |
| `/ongoing` cards | 12 | 12 (neither survivor is in them) |

**Seven duplicate cards gone from one page.** Both survivors render correctly:
*Monsters on Vacation · May 23 – Jan 10* and *Fall Flower Show · Oct 23 – Nov 29*.

**And the Fall Flower Show is now on no day page at all.** `612541bd` was the
only one of the five inside the 14-day cap, so it alone expanded across day
pages and was the single Fall Flower card on `/day` from 1 to 13 November. That
is also what made it the worst of them — a 13-day run asserting the show closes
on the 13th, sixteen days before the date Como prints three times. Rule 5, true
spans and never capped expansions. The survivor is a 38-day run, therefore past
the cap, so nothing replaces it on the grid.

Neither survivor reaches `/ongoing` either, but not because of this change:
`/ongoing` is capped at 12 and ordered ending-soonest-first, and all twelve slots
are held by runs closing between 7 and 17 November — three copies of *Kunene and
the King*, three of the *Travail Haunted Basement Bar*, and two Como admission
rows. The strip is saturated with other duplicates.

So the honest summary is: **the calendar is now correct and slightly less
visible.** Five rows claiming five windows is worse than one row with reduced
reach, and both reach losses have named code causes that a correction cannot
touch.

## The "daily from" line now has a named victim and a named non-victim

`EventDetailBody:77` prints `· runs N days · daily from <start>` for every span.
As shipped today:

| row | the line | true? |
|---|---|---|
| Monsters on Vacation | runs 233 days · **daily from 9 AM** | **no** |
| Fall Flower Show | runs 38 days · daily from 10 AM | yes |

`mcm.org/museumevents` prints school-year hours as *"Monday: closed"*, then
*"Tuesday–Thursday: 9 a.m. - 4 p.m."* and later openings Friday to Sunday. The
9 AM start is attested on every day the museum opens — but the museum is shut
roughly 33 of the 233 days this row claims. Como's own notice says the Zoo &
Conservatory *"is now open 10 a.m. to 4 p.m. every day"*, so the flower show's
line is true.

`all_day` suppresses the line and is **not** a `Correction` field, so no
correction can fix the Monsters one. It needs the one-line deletion in the
component — the open item this now has a concrete attested case for.

## Verification

Both claims were put to two independent refuters each before anything was
written, under read-only rules and organiser-domain-only evidence.

| claim | verdict |
|---|---|
| Como: 23 Oct – 29 Nov 2026, and no opening event | **not refuted**, 2 of 2, high confidence |
| MCM: named *Monsters on Vacation*, 23 May 2026 – 10 Jan 2027 | 1 not refuted, **1 refuted** |

The refutation was right and narrow: it refuted the word *never*. The museum
**does** use *Monsters on Summer Vacation* — on the live 2024 page. The
correction stands, and two sentences of the `why` were wrong before the refuters
read them: a claim that no mcm.org page uses *Summer*, and a claim that both
years sit adjacent in the Visitor Information line. The Como `why` also carried a
wrong sitemap claim (*"fall opening-day pages for 2023 only"*, carried over from
a memory note) which is now what was actually measured. All three were fixed
before the apply.

## Quality gate

No source file changed, so there is nothing for `tsc`, `vitest` or `next build`
to measure — `git status` shows no tracked modification. What applies:

- `npm audit` → **0 vulnerabilities**
- dry run clean: 10 plans, **0 refused**, no `event_key` collision on either rename
- backup written before the write: `Documents/CityPulseMN/backups/2026-11-05-monsters-fallflower-before.json` (5,134 bytes, 10 rows)
- `admin_audit` → **10** `correction` rows, both edits flagged `keyRewritten: true`
- apply reported `10 applied, 0 refused, 0 unchanged` and purged 10 event pages
- post-apply read-back: exactly one published row per production, with the
  corrected title, `end_at` null, `multi_day_end` set, stamp cleared
- surfaces smoked on a server reading production rows (table above)

## Deploy

Nothing to deploy. The data change is applied and the caches are purged. The
corrections file and this guide are committed as the record.

## Verify

On the live site:

1. `/event/e80b7021-7f9f-4e37-84f5-dec1e40ace5f` reads **Monsters on Vacation**,
   *May 23 – Jan 10*.
2. `/event/7d5fa345-0fec-4f7e-9a8b-0eeac5e24a9d` reads **Fall Flower Show**,
   *Oct 23 – Nov 29*.
3. `/this-weekend` shows each of them **once** under *Happening all weekend*,
   and no card named *Part 2*, *Part Two*, *Lion-Themed* or *Summer Vacation*.
4. `/day/2026-11-10` has no Fall Flower card. Expected, and the reason is in
   *What it cost* above.

## Rollback

Per row, from the backup:

```
npm run correct -- --from=<file>.json --apply
```

with `{"id": "...", "publish": true, "why": "...", "evidence": "..."}` to restore
an archived row, and the backup's `title` / `end_local` / `multi_day_end` values
to put a survivor back. Nothing was deleted; the eight archived rows keep their
event pages, and `publish: true` is one apply away.

## Left open

- **`isUpcoming` drops an over-cap run after day one** (`lib/dates.ts:233`). It
  reads `daysSpanned(ev).at(-1)`, which for a span past the 14-day cap is the
  START day, so both survivors read as not upcoming and leave the venue, city
  and neighborhood pages the day after they open. This is now the reason a real,
  currently-running flower show appears on no day page. One-line class of fix,
  and the biggest single reach win available.
- **`EventDetailBody:77`'s `· daily from <time>`** — false on the Monsters row
  and on 80-odd others. Unfixable by correction; `all_day` is not a
  `Correction` field.
- **`/ongoing` is saturated by other duplicates** — 3× *Kunene and the King*,
  3× *Travail Haunted Basement Bar*, 2 Como admission rows hold 8 of its 12
  slots. The admission rows are the already-identified archive candidates.
- **Additive drift still escapes the fold** — `Fall Flower Show – Part 2` against
  `2026 Fall Flower Show – Part Two (Lion-Inspired)` is 0.444, because *two* and
  *2* are different tokens. Digit/word equivalence belongs in
  `normalizeRunTitle` and would move `planCollapse` in both directions, so it is
  its own item.
- The **Como admission rows** (*Daily General Admission*, *Daily Open
  Admission*, *Daily Zoo Visit*) are still live and still not events. Named in
  `end-at-stuffed-with-run-end`; deferred, not done.
- The MCM pin disagrees with itself across the venue's rows — `44.9477369` on
  three of them against `44.946774` on the fourth, about 110 m apart. Out of
  scope here, worth a pass with the rest of the venue pins.

Related: `DEPLOY-RUN-REFIND-FOLD.md`, `DEPLOY-RUN-FOLD-TITLE-DRIFT.md`,
`DEPLOY-CITATION-REPOINT.md`.
