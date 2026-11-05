# Deploy — a run longer than 14 days read as finished on its second day

**Date:** 5 November 2026
**Files:** `lib/dates.ts`, `lib/multiday.ts`, `lib/__tests__/dates.test.ts`, `lib/__tests__/venue-pages.test.ts`
**Type:** bug fix (ENGINEERING rule 5) + a de-duplication that removes the thing that keeps causing it
**Schema:** none. **Data:** none. Code only.

---

## What was wrong

`isUpcoming` is the single predicate behind "does this venue / city / neighborhood
have anything on, and should we advertise the page". It asked the question like
this:

```ts
const lastDay = daysSpanned(ev).at(-1)!;
return `${lastDay}T23:59` >= chiWallClock(now);
```

`daysSpanned` answers a *different* question: **which calendar cells do I paint?**
For a run longer than `EXPAND_MAX_DAYS` (14) it deliberately returns the **start
day alone**, because a three-month exhibition painted across ninety cells is the
July flood incident ([HOTFIX-calendar-flood.md](HOTFIX-calendar-flood.md)).

So `.at(-1)` on that list is the start day, and from its **second day** every run
over 14 days read as already finished.

This is ENGINEERING **rule 5** — *true spans, never capped expansions* — broken for
the third time. It was caught on `/this-weekend` in R1.5 and in `lib/ongoing.ts`.
Both of those fixed themselves and left the shared predicate alone.

### Measured through the callers, on live data, the morning of 5 Nov

Not on fixtures — the real 600 published rows, through the real functions:

| | before | after |
|---|---|---|
| rows reading as upcoming | 530 | **561** (+31) |
| rows *lost* | — | **0** |
| venue pages reading empty that are not | 2 | **0** |
| venue pages in `sitemap.xml` | 28 / 47 | **30 / 47** |
| city slugs in `sitemap.xml` | 18 | **19** |
| "Also tracked" (quiet) list on `/venues` | 19 | **17** |
| calendar cells painted by `daysSpanned` | 815 | **815** (unchanged) |

The two pages that said they had nothing on, while something was running inside
them:

- **Minnesota Children's Museum** — 0 → 2 (*Monsters on Vacation*, *Beach Monster Exhibit*)
- **Minnesota Zoo** — 0 → 1

Four more were under-counting:

| venue page | before | after |
|---|---|---|
| `children-s-theatre-company` | 3 | 7 |
| `como-park-zoo-and-conservatory` | 16 | 20 |
| `science-museum-of-minnesota` | 10 | 11 |
| `minnesota-landscape-arboretum` | 5 | 6 |

The clearest single case: **Dr. Seuss's How the Grinch Stole Christmas!** opened at
Children's Theatre on 3 November and runs to 3 January. On 4 November the site
decided it was over.

### Honest accounting of the 31

The 31 restored rows are not 31 things worth seeing:

- **7 are daily-admission rows that are not events at all** — three Como, two
  SEA LIFE, one Minnesota Zoo, one Nickelodeon Universe. `/cities/apple-valley`
  enters the sitemap *solely* on the Minnesota Zoo admission row. Archiving those
  is already a known open item; this fix makes them more visible, not less.
- **6 are duplicate rows of 4 productions** — 3× *Twelve Kinds of Ice*, 2× *Kunene
  and the King*, and 2 of the 3 *Olalekan Jeyifous* rows. `children-s-theatre-company`
  going 3 → 7 is mostly one show counted three times.
- So roughly **18 distinct real things** come back, not 31.

**Found while looking at the result:** *Beach Monster Exhibit* and *Monsters on
Vacation* sit at the same venue with the **same 233-day span**, 23 May – 10 Jan.
Almost certainly one exhibit under two names. Yesterday's Monsters dedupe queried
`title ilike '%monsters on%vacation%'` and never saw it. Not touched here.

---

## What changed

### 1. The span rule has one home in the read path (`lib/dates.ts`)

It existed **twice** — as `lib/multiday.ts spanEnd` and again inlined inside
`daysSpanned` — each carrying a comment saying it mirrored the other. That
duplication is what keeps generating rule-5 defects: a new surface reaches for
whichever copy is nearest, and `daysSpanned`'s copy comes with a cap attached.

`lib/multiday.ts` already imported `MONTHS` from `lib/dates.ts`, so `dates.ts` is
the end of the graph that can hold the rule **without an import cycle**. It now
exports `spanEndISO`, `daysSpanned` calls it, and `multiday.ts spanEnd` is a
one-line delegation. Behaviour is unchanged for every existing caller — the
delegation is pinned by a test that compares the two across ten shapes. The
`Spannable` type is shared now too, so `multiday.ts` no longer declares its own.

**Two copies remain and cannot delegate** — an adversarial review caught the first
draft of this section claiming otherwise. `lib/events.ts readEventsForDay`
re-expresses the whole rule in SQL (late-night carve-out included, `EXPAND_MAX_DAYS`
hardcoded as `<= 13`) because a day query runs in Postgres. And `lib/event-view.ts`
takes a plain string-max of start/end/multiDayEnd with no later-date guard and no
late-night rule — `eventTimeState`, live on the event page, and `isEnded`, tests
only. That one is deliberately the conservative archive-frame answer, but it is a
third answer. Both are now named in the source comment and in rule 5.

### 2. `isUpcoming` reads the true end

```ts
const startKey = dkey(evDate(ev));
const endKey = spanEndISO(ev)?.slice(0, 10);
const lastDay = endKey && endKey > startKey ? endKey : startKey;
```

The non-span case keeps the old value **exactly**: `daysSpanned`'s first entry is
`dkey(evDate(ev))`, and its `endKey <= start` guard is mirrored on the last line.
That is why 0 rows were lost — the change is strictly additive.

### 3. The cap itself is untouched

`EXPAND_MAX_DAYS` is still 14, `daysSpanned` still returns the start day alone for
a longer run, and the calendar still paints 815 cells. A test asserts that
asymmetry on purpose, so the next reader sees intent rather than an oversight.

---

## What this does **not** fix: the day pages

The ask was "so these runs come back to the day and venue pages." The venue half
is done. **The day half is a different mechanism and this change does not touch
it** — saying otherwise would be wrong, and the earlier
[Monsters/Fall Flower guide](DEPLOY-MONSTERS-FALLFLOWER-DEDUPE.md) overstated it.

`/day/<date>` is capped by its **own** clause in `lib/events.ts readEventsForDay`:

```sql
and (coalesce(multi_day_end, end_at) at time zone 'America/Chicago')::date
  - (start_at at time zone 'America/Chicago')::date <= 13
```

Verified after the fix: `/day/2026-11-10` still renders **6 cards and zero Fall
Flower**, exactly as before.

### Why the cap should stay there

Measured what removing it would do, per day, on live rows:

| day | cards now | uncapped | |
|---|---|---|---|
| 2026-11-05 | 11 | 47 | +194% |
| 2026-11-09 | 4 | 33 | **+725%** |
| 2026-11-16 | 5 | 35 | +600% |
| 2026-11-23 | 6 | 35 | +483% |

The added rows are **the same ~30 cards on every single day** — which is the July
flood verbatim, at ten times the scale. On a quiet Monday the day page would be
88% standing exhibitions.

`/ongoing` is the surface built for these, and it is already full: 12 slots, 8 of
them held by duplicate rows (3× Kunene, 3× Travail, 2 Como admission).

### The option space, for Taren

1. **Leave it.** Over-cap runs show on their start day and on `/ongoing`. Costs
   nothing. The Fall Flower Show stays off day pages for the rest of its run.
2. **A capped "Also running" strip at the foot of the day page** — the same
   ending-soonest-first order as `/ongoing`, ~6 items, below the two groups that
   are there now. Not a flood: it is a labelled shelf, and the day page already
   has the `dayTimeLabel` logic to print "Through Nov 29" correctly. This is what
   the roadmap itself proposed when `/ongoing` was built.
3. **Uncap the day query.** The numbers above. Not recommended.

Option 2 is the one worth building, and it is a product change, not this bug fix.
It would also need `components/EventsExplorer.tsx` to match, or the server day page
and the homepage day panel disagree again. Not *exactly* the R1.7b divergence — that
one was a single off-by-one band (15-day spans only, diverging on every day of the
run); this would diverge for every run over 14 days and only on its **middle** days,
since the SQL's first branch still matches the start day. Wider, shallower, same
shape. Build it on its own query rather than by relaxing the capped one, so the
source tripwires at `lib/__tests__/upsert-queries.test.ts:53-60` stay intact.

---

## Verification

Every new test was checked by **mutation**: break the fix, confirm the test dies.

| mutation | tests that failed |
|---|---|
| `isUpcoming` back to `daysSpanned(ev).at(-1)` | **6** — incl. the caller-level venue-page test |
| `spanEnd` stops delegating (`return ev.multiDayEnd ?? null`) | 1 — the drift test |
| `EXPAND_MAX_DAYS` raised to 400 | 4 — incl. the deliberate-asymmetry guard |

The caller-level test matters on its own. The last two defects of this shape were
invisible to pure tests and only showed at the caller, so
`lib/__tests__/venue-pages.test.ts` now asserts that a venue whose **only** live
event is an over-cap run is not listed as quiet — and that one whose over-cap run
has **closed** still is.

### Observed on the running site

- `/venues/minnesota-children-s-museum` → "2 upcoming events", both cards render,
  no console errors
- `/venues/minnesota-zoo` → 1 card
- `/venues` → "Also tracked" is 17 entries; neither venue is in it
- `/sitemap.xml` → 30 venue URLs, 19 city URLs, includes both new venue slugs and
  `/cities/apple-valley`
- `/day/2026-11-10` → 6 cards, 0 Fall Flower (**unchanged, as intended**)
- `/ongoing` → 12, `/this-weekend` → 97 (**both unchanged** — they already used
  true spans, so nothing double-counts)

---

## What a 15-agent adversarial review changed

Five design claims, two refuters each on different lenses, then a synthesis pass
that re-read the code where reports disagreed. **All five came back refuted** — four
on quantifiers, one on a real defect in what had already been written.

**Real, and fixed before this guide was final.** The comment in `lib/dates.ts` called
`spanEndISO` "the only copy of it". It is not: see the two above. Corrected in the
source, in `docs/ENGINEERING.md` rule 5, and in section 1.

**Also corrected.** `docs/MULTIDAY.md` still cited `EXPAND_MAX_DAYS` at
`lib/dates.ts:182`; it is line 177 — and that is the one file whose stale text already
caused three corrections to be written against a cap that did not exist. Separately,
the new fixtures used `end: ""`, a shape the database never produces: `rowToEvent`
does `end: r.end ?? r.start`, so the **207 published rows with a null `end_at` carry
`end === start`**. The fixtures use the real shape now. Behaviour was identical
either way — the `multiDayEnd` branch wins — but the comment was false.

**Overstatements the review was right about.** An event's own `/event/<id>` URL is
**not** gated by `isUpcoming` (`app/sitemap.ts:44-48`), so no event URL was ever
missing from the sitemap; only `/cities/<slug>` and `/venues/<slug>` are supply-gated,
and each drops only when the long run was that slug's last upcoming item. The numbers
in this guide are for those two blocks and are unaffected. The test diff is also not
purely additive: one existing import line was widened.

**Found, verified, and deliberately left alone** — separate defects, not this fix:

- **`eventsInWindow` (`lib/dates.ts:93-105`) has no span awareness at all.** Not
  capped — start-instant only. The explorer's list view, map view, map list and the
  "N matches" count all read `windowedEvents`, so **any** multi-day run whose start
  falls outside the viewed window disappears from them, including a three-day one.
  Wider blast radius than the bug fixed here, and `docs/MULTIDAY.md` currently claims
  every "is this running on day X?" reader uses the true span.
- **Rule 6 is breached on day pages right now.** `/day/<date>` prints "Nothing on the
  calendar here yet" on a day when an over-cap run genuinely is on. Pre-existing, not
  introduced here — and it is the real argument for option 2.
- **`lib/events.ts:202-205`**: with no database configured the day read is
  `dayKeyOf(e) === dayKey`, start day only, no span expansion at all. A worktree smoke
  cannot see this class of bug in either direction.
- **The SQL coalesces to `multi_day_end` without checking it is later than the start
  day**, where `spanEndISO` rejects it. Latent divergence; **measured on live data: 0
  published rows have that shape.**

**One undeclared improvement.** The old inlined derivation did `ev.start.slice(0, 10)`
and threw a `TypeError` on a null start; `spanEndISO` guards it. `daysSpanned` is
null-safe now where it was not. Nobody asked for that and it is not load-bearing, but
it changed, so it is recorded.

## Quality gate

| | |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` | **3,107 passed in 151 files** (was 3,092 — the 15 new tests, nothing double-counted) |
| `npm run build` | clean |
| `npm audit` | **0 vulnerabilities** |
| smoke | above |

---

## Deploy

Code only. Nothing to run, no migration, no data apply.

```bash
git add lib/dates.ts lib/multiday.ts lib/__tests__/dates.test.ts lib/__tests__/venue-pages.test.ts docs/deploy-history/DEPLOY-ISUPCOMING-OVERCAP.md
git commit -m "fix — a run longer than two weeks read as finished on its second day"
git push
```

Vercel auto-deploys from `main`. The affected pages are ISR at `revalidate = 3600`
and `getEvents` is `unstable_cache`d at the same hour, but a new deployment starts
with a cold cache, so the first request to each page is already correct. No
revalidation call is needed.

### Verify after deploy

1. `https://citypulsemn.com/venues/minnesota-children-s-museum` — says **2 upcoming
   events**, not "nothing on"
2. `https://citypulsemn.com/venues/minnesota-zoo` — 1 event
3. `https://citypulsemn.com/venues` — "Also tracked" has 17 names, neither of the
   two above among them
4. `https://citypulsemn.com/sitemap.xml` — contains `/venues/minnesota-children-s-museum`
5. `https://citypulsemn.com/day/2026-11-10` — **still** no Fall Flower Show. If this
   one changed, something else changed too.
6. Spot-check the homepage calendar for November: no cell should have gained
   standing exhibitions.

## Rollback

`git revert` the commit. The change is additive to one predicate and a pure
refactor of one function; nothing persists it, so a revert is complete and
immediate. There is no data to undo.

---

## Left open

- **The 7 daily-admission rows** (`Daily General Admission`, `Daily Open Admission`,
  `Daily Zoo Visit`, `Daily Indoor Theme Park`) are not events and are now more
  visible, not less. `/cities/apple-valley` is in the sitemap because of one of
  them. Archive them and move the hours to the venue page.
- **The day-page shelf** — option 2 above, needing the SPA panel to match.
- ***Beach Monster Exhibit* vs *Monsters on Vacation*** — same venue, identical
  233-day span. Probably one exhibit, two titles.
- **Duplicate rows still live** among the restored 31: 3× *Twelve Kinds of Ice*,
  2× *Kunene and the King*, 3 *Jeyifous* rows. `children-s-theatre-company` now
  advertises 7 events that are really 5.
- **`EventDetailBody:77`** still prints `· daily from <time>` on long runs that are
  closed on Mondays. Not a correction-field fix; needs the one-line component change.
- **Walker Art Center, Minneapolis Institute of Art and SEA LIFE have no venue page
  at all** — 13 of the 31 restored rows are at venues outside the registry, so they
  gained nothing from this fix beyond their city page.
- **`eventsInWindow` is not span-aware** (see above). Probably the largest remaining
  reach defect on the site, and a different shape from this one: it drops short runs
  too.
- **`/day/<date>` says "nothing on the calendar" on days that have an over-cap run.**
  Rule 6. Option 2 fixes it; nothing else will.
- **The SQL and `lib/event-view.ts` still hold their own span derivations.** Neither
  can import the shared one. Grep for both when the rule changes.
