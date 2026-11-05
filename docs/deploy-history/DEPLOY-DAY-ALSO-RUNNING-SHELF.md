# Deploy — the day page stopped saying "nothing on" while three exhibitions were open

**Date:** 5 November 2026
**Files:** `lib/ongoing.ts`, `lib/events.ts`, `app/day/[date]/page.tsx`, `components/DayPanel.tsx`,
`components/EventsExplorer.tsx`, `app/globals.css`, three test files
**Type:** feature (roadmap 2.2's own proposed generalisation) + a rule-6 fix
**Schema:** none. **Data:** none. Code only.

Follows [DEPLOY-ISUPCOMING-OVERCAP.md](DEPLOY-ISUPCOMING-OVERCAP.md), which fixed the venue
half of the same problem and named this as the option worth building.

---

## What was wrong

A run longer than `EXPAND_MAX_DAYS` (14) shows on its start day and nowhere else. That is
right for the calendar grid — a 233-day exhibition across 233 cells is the July flood
([HOTFIX-calendar-flood.md](HOTFIX-calendar-flood.md)) — and Taren confirmed the cap stays on
4 November.

But the same cap governs `/day/<date>`, which is the page that ranks for *"things to do in
minneapolis \<date\>"* and earns 1.24 clicks per page, the best rate on the site. So it printed:

> Nothing on the calendar here yet — new events land with every Monday refresh.

on days when exhibitions, plays and a flower show were all open. That is **rule 6, honest
emptiness**, failing on the best-converting surface we have.

**Measured on live rows:** between today and 31 January there is exactly **one** such day —
**19 January 2027**, where the day query returns **0** and **13 long runs** are open. One day,
but the page was flatly wrong on it, and the under-reporting is wider: on 10 November the
page said "6 events" while **29** runs were also open.

---

## What shipped

### 1. One planner, called by both day surfaces (`lib/ongoing.ts`)

`alsoRunningPlan(events, dayKey, cap)` → `{ items, total }`.

A row is "also running" when it started **strictly before** the day, is still running by
**true `spanEnd`** (rule 5 — never the capped expansion), and its run is **longer than the
cap**. Ordered **ending soonest first**, because "last day" is the only urgent thing about a
run that has been open for two months. Capped at 6; `total` is reported honestly so the shelf
can link on to `/ongoing` without inventing a number.

**Complementary by construction.** The day query admits a row when its start day *is* the day,
or when it spans the day with a date diff `<= 13`. The planner takes exactly the rest, from
the same `EXPAND_MAX_DAYS` constant. A test sweeps 43 start offsets × 8 run lengths and asserts
both directions: no row in both lists, and no row open on the day in neither.

### 2. Its own query (`lib/events.ts`)

`readAlsoRunningForDay` / `getAlsoRunningForDay`, cached per day key like its sibling.
`readEventsForDay` is **byte-identical** — its `::date <= 13` clause and the source tripwire at
`lib/__tests__/upsert-queries.test.ts` are untouched, which is what the separate query buys.

The SQL is a **prefilter, not the rule**: it mirrors the span derivation and inverts the cap to
`> 13` so a day page isn't shipped 600 rows. The planner runs over the result either way, so the
authority is in one place. A new tripwire pins `> 13` against the sibling's `<= 13`, since
editing one without the other would make a run show twice or vanish between them.

### 3. The page and the panel

`/day/<date>` reads both in parallel and renders the shelf under the existing two groups. The
homepage day panel runs **the same planner** over its own filtered set, so the two cannot
answer differently — the R1.7b lesson, applied before they could drift.

The empty state now accounts for the shelf, and the count line carries two true numbers
instead of one:

| day | before | after |
|---|---|---|
| 2026-11-10 | `6 events` | `6 events · 29 also running` |
| 2027-01-19 | `No events listed for this day yet.` | `13 also running` |

### Two deliberate asymmetries

- **Calendar cell counts are unchanged.** The cell for 10 November still reads "6 events".
  That is the grid's own measure, and making every cell +29 would erase the signal the cap
  exists to protect. The panel showing more than the cell suggested is the *inverse* of the
  R1.7b bug, where the panel showed less — far less harmful, and the day page's two-part count
  says the same thing in words.
- **Shelf items are not in the day page's ItemList JSON-LD.** The same ~30 standing runs on all
  365 day pages would make every day's structured list near-identical, and each already carries
  its own schema on its own event page. This project has killed a page type over thin content
  before.

---

## The problem this surfaces, and why it matters before deploy

The shelf is correct. The **data feeding it, for the next three weeks, is not.** Measured
through the real planner on live rows, counting how many of the 6 visible slots are a distinct
real event:

| day | total | shown | admission rows | duplicate rows | **actually real** |
|---|---|---|---|---|---|
| 2026-11-10 | 29 | 6 | 4 | 1 | **1** |
| 2026-11-20 | 28 | 6 | 2 | 2 | **2** |
| 2026-12-05 | 32 | 6 | 0 | 0 | **6** |
| 2026-12-20 | 33 | 6 | 0 | 0 | **6** |
| 2027-01-19 | 13 | 6 | 0 | 0 | **6** |

On 10 November the shelf reads:

> Last day · Como Park Zoo & Conservatory – Daily General Admission
> Last day · SEA LIFE Minnesota Aquarium – General Admission
> Through Nov 13 · Olalekan Jeyifous: Hydricosmic Litanies
> Through Nov 17 · Como Park Zoo & Conservatory – Daily General Admission
> Through Nov 17 · Minnesota Zoo – Daily General Admission (Fall Season)
> Through Nov 22 · Twelve Kinds of Ice

Four of six are **daily-admission rows that are not events**, one venue appears twice because
two duplicate rows are live, and only two are real. From early December the admission rows have
expired and the shelf is clean.

**Recommendation: archive the admission rows before this goes live.** They have been a known
open item since 3 November; this change puts them on 365 day pages, ordered ending-soonest, at
the top of the shelf. The shelf is what makes them expensive.

---

## Verification

### Mutation — every new test was checked by breaking the code

| mutation | tests that failed |
|---|---|
| cap off-by-one (`<= EXPAND_MAX_DAYS` not `- 1`) | 2, incl. the complementarity sweep |
| start day inclusive (`<=` not `<`) — overlaps the main list | 2, incl. complementarity |
| ordering reversed (ending latest first) | 1 |
| cap ignored (no slice) | 1 |

### Observed on the running site

- `/day/2027-01-19` — was "Nothing on the calendar here yet", now `13 also running` with six
  cards: *And Then There Were None*, *Annie*, *Mia's Dante Tapestry Restored*, *Breaking
  Tradition*, *Art Shanty Projects*, *Walker Design Triennial*, and `See all 13 ongoing runs →`
- `/day/2026-11-10` — `6 events · 29 also running`; 6 main cards then 6 shelf cards with
  "Last day" / "Through Nov 13" badges; no console errors
- **Homepage day panel, same day** — 12 cards, the same six shelf titles **in the same order**,
  the same `See all 29 ongoing runs →`. The two surfaces agree.
- Calendar cell still reads "10: 6 events" — the grid is untouched

### A trap worth recording

The first three attempts to smoke the panel showed no shelf. It was not the code: the project
registers a **service worker** (`citypulse-static-v1`) whose cache survived `rm -rf .next`, two
dev-server restarts, and a `cache: 'reload'` refetch of every chunk. Unregistering it and
deleting the cache fixed it instantly. Anyone smoking a client-side change locally has to clear
it, or they will review their previous build.

---

## Quality gate

| | |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` | **3,121 passed in 151 files** (3,107 + 14 new) |
| `npm run build` | clean, 611 pages |
| `npm audit` | **0 vulnerabilities** |
| smoke | above, both surfaces, with the service worker cleared |

`npm run lint` is **not** part of this gate: the script exists but ESLint has never been
configured here, so it drops into an interactive setup prompt.

---

## Deploy

Code only. No migration, no data apply.

```bash
git add lib/ongoing.ts lib/events.ts "app/day/[date]/page.tsx" components/DayPanel.tsx components/EventsExplorer.tsx app/globals.css lib/__tests__/ongoing.test.ts lib/__tests__/events-read.test.ts lib/__tests__/upsert-queries.test.ts docs/deploy-history/DEPLOY-DAY-ALSO-RUNNING-SHELF.md
git commit -m "fix — a day page said nothing was on while three exhibitions were open"
git push
```

Vercel auto-deploys from `main`. `/day/[date]` is a dynamic route (`ƒ`), so there is no
build-time prerender and no connection-pool exposure (rule 2). A new deployment starts cold, so
the first request to each day is already correct.

**Cost:** one extra DB round trip per uncached day page, returning ~30 rows, cached per day key
at `EVENTS_TTL_SECONDS` alongside the existing day read.

### Verify after deploy

1. `https://citypulsemn.com/day/2027-01-19` — must NOT say "Nothing on the calendar here yet";
   expect `13 also running` and six cards
2. `https://citypulsemn.com/day/2026-11-10` — `6 events · 29 also running`, shelf below the
   main list, `See all 29 ongoing runs →`
3. Homepage → Calendar → click 10 — the panel's shelf must match item for item
4. The calendar cell for 10 must still read 6, not 35
5. View source on a day page: the ItemList JSON-LD must contain only the main-list events

## Rollback

`git revert` the commit. Additive: a new planner, a new query, a new section. Nothing persists
it, nothing migrated, and `readEventsForDay` was never touched — so a revert returns the day
page exactly to its previous behaviour.

---

## Left open

- **The admission rows.** See above. The strongest reason yet to archive them.
- **Duplicate rows still live** — 3× *Twelve Kinds of Ice*, 2× *Kunene and the King*, 3
  *Jeyifous* rows, 2 Como admission rows. The shelf shows duplicates as duplicates.
- **"Already running" vs "Also running"** sit on the same page a few inches apart, and the
  only difference between them is a 14-day threshold no reader knows about. Taren chose "Also
  running" and editorial copy is Taren's call, so it ships as asked — but it is worth a second
  look.
- **`eventsInWindow` is still not span-aware** (`lib/dates.ts:93-105`), so the explorer's list
  and map views still drop any multi-day run whose start falls outside the viewed window,
  including short ones. Untouched here; probably the largest remaining reach defect.
- **The shelf cap is 6 with no "show more" in place** — it links to `/ongoing`, which is itself
  capped at 12 and currently holds 8 duplicate rows.
