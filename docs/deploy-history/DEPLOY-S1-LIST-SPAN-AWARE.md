# Deploy — the homepage list showed 10 of the 33 things open that day

**Date:** 5 November 2026 · **Roadmap:** [ROADMAP-SPANS.md](../ROADMAP-SPANS.md) item **S1**
**Files:** `lib/dates.ts`, `lib/list-view.ts`, `components/ListView.tsx`,
`lib/__tests__/dates.test.ts`
**Schema:** none. **Data:** none. Code only.

The fourth and largest break of ENGINEERING rule 5, found by a review of the third.

---

## What was wrong

`eventsInWindow` (`lib/dates.ts`) decided membership like this:

```ts
const d = evDate(ev);
return d >= win.start && d <= win.end;
```

The **start instant only**. Not capped like `daysSpanned` — blind. Anything that began
before the window and ran through it was absent.

That function feeds the explorer's **list view, map view, map list and the "N events match"
count**, and `DEFAULT_VIEW` is the list. It was the first thing a visitor saw.

### Measured on live data, 5 November

| range | list showed | genuinely on | hidden | |
|---|---|---|---|---|
| **Today** | **10** | **33** | **23** | **70%** |
| Weekend | 58 | 82 | 24 | 29% |
| Week (the default) | 89 | 112 | 23 | 21% |
| Month | 313 | 341 | 28 | 8% |

**Unlike the `isUpcoming` break fixed earlier the same day, this was never limited to
over-cap runs.** Four of the 23 hidden from Today were runs of **14 days or less** — inside
`EXPAND_MAX_DAYS`, so the calendar grid painted them onto today's cell while the list, looking
at the same day, said they were not on. Two views of one dataset, disagreeing, with the
under-reporting one as the default.

---

## What shipped

### 1. `eventsInWindow` obeys rule 5

True span intersection on day keys. Day keys rather than instants because every window
`rangeWindow` builds is day-aligned, so the two agree and the comparison stays in one frame
(rule 10).

### 2. The list gets its own plan — and a branch that had never run

`lib/list-view.ts groupEventsByDay` has clamped mid-run events to the window's first day
**since UX4**, with a test covering it (`list-view.test.ts:48`). That branch had **never
executed in production**, because `eventsInWindow` removed every mid-run event before the list
saw it. A tested branch the caller could not reach — this project's "pure tests miss the
caller" shape, a third time.

**Correction, from the review of this very commit:** the first cut of this guide said fixing
the predicate "makes it live", and that was false. `planListView` routed every row that could
have reached the clamp into `ongoing` instead, so it stayed dead. It is live now, but only
because of the `todayKey` blocker fix below — a run that overlapped the window and has since
closed falls through to `starting` carrying a start before the window, which is precisely the
case the clamp was written for. But on the default Today range that would put 23 events,
most of them months-long exhibitions, at the top of a 33-item list ahead of the 10 things
actually starting — the calendar-flood incident arriving by another door. So `planListView`
splits them into a capped **"Already running"** group, ordered ending-soonest, the shape
`/day/<date>` and `/this-weekend` already use.

`groupEventsByDay` is **deliberately untouched**: `/this-week` shares it.

### What the numbers become

| range | before | after | made of |
|---|---|---|---|
| Today | 10 cards | **16** | 10 starting + 6 of 23 running |
| Week | 89 cards | **95** | 89 starting + 6 of 23 running |

The cap is why Today shows 16 rather than 33. `More ongoing runs →` appears when there are
more, and each card carries its own span badge ("Oct 26 – Nov 7"), so the dates explain
themselves.

---

## Verification

### Mutation

| mutation | tests that failed |
|---|---|
| `eventsInWindow` back to the start instant | **6**, incl. the grid-vs-list agreement test |
| `planListView` stops splitting | 3 |
| "Already running" ordered latest-ending first | 1 |
| the cap ignored | 1 |

The agreement test is the one worth having: for every row the grid paints on a given cell, the
list must contain it. That disagreement was the symptom.

### Observed on the running site

- Default list, **Week**: leads with "Already running", 6 cards, then 7 day groups — 95 cards
- **Today**: "Already running" + one day group, 16 cards (was 10)
- Ordering ending-soonest: Nov 7, Nov 7, Nov 7, Nov 7, Nov 8, Nov 8
- `More ongoing runs →` present; every card carries a span badge
- No console errors

---

## Quality gate

| | |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` | **3,149 passed in 152 files** (3,135 + 14) |
| `npm run build` | clean, 611 pages |
| `npm audit` | **0 vulnerabilities** |

---

## The data gate this opened — CLEARED before shipping

The same thing happened here as with the day shelf: fixing the surface made a data problem
prominent. **The first three cards on the homepage are now the same event three times.**

| | run | title | Jaccard vs row 1 |
|---|---|---|---|
| `68e4cc56` | 19 Oct – 7 Nov | "Travail Haunted Basement Bar" | — |
| `e28785d0` | 26 Oct – 7 Nov | "Haunted Basement Bar: Annual Harvest Supper at Travail" | **0.500** |
| `e506465f` | 4 Nov – 7 Nov | "Travail Haunted Basement Bar – Annual Harvest Supper" | **0.571** |

All three cite `travailkitchen.com/hauntedbasement`, all end 7 Nov, all priced $189.

**Why every existing defence missed them:**
- The 5 Nov `runKey` sweep groups by normalised **title**, and these three differ.
- The 4 Nov fold's title-drift rule gates at **Jaccard ≥ 0.75**. Rows 1~2 score 0.500 and
  1~3 score 0.571 — under the gate. Rows 2~3 score **0.875 and should have folded**, but both
  were already live, and the "live duplicate freeze" means each blocks the other's re-find.

A fourth Travail row, "Travail Holiday Bar 2026 – 'Past, Present & Future'" (20 Nov – 2 Dec,
a different source on exploretock), is **a genuinely different event** and must not be merged.

### Resolved, same day

`travailkitchen.com/hauntedbasement` settles it: **"Haunted Basement runs September 24–November 7
in Travail's Basement Bar, Wednesday through Saturday"**, one price ("Tickets start at
$189/person and included beverages"), one reservation link. **The Annual Harvest Supper is not a
separate ticket** — the page uses it as the premise, the family "preparing for their most
important night of the year", and the barn dinner is what the evening is. No dates, no ticket of
its own. All three rows were one experience.

**The real opening was in none of them.** Seven Travail rows exist across every status and the
earliest is 7 October; the attested 24 September was nowhere, so unlike *Twelve Kinds of Ice*
there was no archived row to promote and the date had to be written. Checked first: 24 September
does not collide. The keeper also stored `00:00`, a date-only artefact, against the page's
printed "Wednesday: 5:45 PM".

Applied — 3 of 3, 0 refused, backed up to `2026-11-05-travail-haunted-before.json`:

| row | action |
|---|---|
| `68e4cc56` "Travail Haunted Basement Bar" | **keeper**, start corrected 19 Oct 00:00 → **24 Sep 17:45** |
| `e28785d0` "Haunted Basement Bar: Annual Harvest Supper at Travail" | archived |
| `e506465f` "Travail Haunted Basement Bar – Annual Harvest Supper" | archived |

Not touched: **"Travail Holiday Bar 2026 – 'Past, Present & Future'"** (20 Nov – 2 Dec, its own
source on exploretock) is a genuinely different event, and the `$25–$33` "The Haunted Basement
(Immersive Adults-Only Horror)" row is a draft at a different price band — left alone rather
than assumed to be the same thing.

**Honest limit, recorded not hidden:** the run is Wednesday-to-Saturday and the schema has no
recurrence field, so the span still implies a continuous 45 days. Site-wide modelling limit,
not something this correction introduced. Not stamped either — `start` is verify-relevant and
the page prints no year beside the dates (the booking slug reads `haunted-bar-2026`).

**Observed after:** the homepage "Already running" group is six distinct productions —
Travail once at "Sep 24 – Nov 7", then Water Garden Wonders, Ikebana, Kunene, Twelve Kinds of
Ice, Thin Veils — ending-soonest first, no console errors. 579 → **577** published rows.

**A detector was tried and rejected.** Grouping by venue + overlap instead of by title finds 13
clusters, and most are legitimate — Mall of America genuinely runs Santa, the light shows,
Festival of Trees and the Candy Cane Institute at once. Venue+overlap over-flags exactly as
badly as title-only under-flags. This is roadmap **T2**, and it is not a one-afternoon rule.

---

## Deploy

```bash
git add lib/dates.ts lib/list-view.ts components/ListView.tsx lib/__tests__/dates.test.ts docs/ROADMAP-SPANS.md docs/deploy-history/DEPLOY-S1-LIST-SPAN-AWARE.md
git commit -m "fix — the homepage list showed a third of what was on"
git push
```

Verify on **www** with `curl -L` (the apex 308s):

1. `https://www.citypulsemn.com/` — default list leads with "Already running"
2. Tap **Today** — the section is still there; the count rises from 10 to 16
3. Each "Already running" card shows a span badge, and the group is ending-soonest first
4. The calendar cell for today and the list no longer disagree about what is on
5. `/this-week` is unchanged — it shares `groupEventsByDay`, which this did not touch

## Rollback

`git revert`. The predicate change and the new `planListView` are additive; `groupEventsByDay`
was not modified, so `/this-week` cannot be affected either way.

---

## Left open

- **T2 remains open.** The Travail rows were archived by hand. The general rule that would
  have caught them — a title-drift threshold that fires at 0.500 without merging the 24 real
  pairs a looser rule wrongly folded in October — is still unwritten.
- **T2, the general title-drift problem** — the Jaccard gate at 0.75 is demonstrably too high
  for this family, and lowering it is how the venue-alias pin-fold wrongly merged 24 real pairs
  to catch 6. Needs a measured threshold, not a guess.
- **`matchesAfterWindow`** still uses a start-only filter (`lib/dates.ts`). Defensible — it
  answers "does anything START later". **The first cut of this line also called it "the only
  start-only predicate left", which was flatly wrong**; the review named eight more:
  `lib/collections.ts:150`, `lib/content/weekly-picks.ts:57`, `lib/related.ts:29`,
  `lib/verify.ts:298`, `lib/digest-personal.ts:44`, `lib/admin.ts:241`,
  `lib/ops-inputs.ts:111`, `lib/source-sweep.ts:63`. Most are asking a start question and are
  fine; `collections.ts` is not, and is now roadmap **S4**.
- **The map.** The review found a real consequence the first cut missed: `MapEventList` sorts
  by raw start and rendered only `timeLabel`, so a 23 May exhibition became row 1 of a list for
  a November window showing a bare "9 AM". Fixed — a multi-day row now shows its span label,
  the same rule `EventDayCard` uses without a `dayKey`. **Still open:** `MapView`'s pin popup
  prints the start day and date (`Sat May 23 · 9 AM`) inside a window labelled Nov. And none of
  it was visually confirmed — Mapbox does not render in the local pane for want of a token.
- **`LIST_ONGOING_CAP = 6`** matches the day shelf. Six is still a guess.
