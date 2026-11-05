# Roadmap — spans and the weekly sweep

*5 November 2026. This does **not** supersede [ROADMAP-v6.md](ROADMAP-v6.md), which is still
the canonical plan and still has open Tier 1 and Tier 2 items. This is a focused repair
roadmap in the v5 mould — one bug class and one hygiene class, both surfaced by a day of work
on multi-day runs and by two adversarial reviews of that work. Every number below was measured
against the live database on 5 Nov 2026, after the day's corrections landed (579 published
rows). Gate at time of writing: tsc clean · 3,135 tests in 152 files · build clean · npm audit 0.*

**Strategic context, in four sentences.** The site has one convention for "is this running on
day X" — true span intersection via `spanEnd`, never the calendar-capped `daysSpanned` — and it
is standing rule 5. Today's work found and fixed the third violation of it (`isUpcoming`), gave
long runs a home on day pages, and cleared 24 rows of accumulated duplication. The reviews then
found a **fourth** violation that is bigger than the one just fixed, because it hits the
explorer's default view and is not limited to over-cap runs. Separately, two of today's three
data passes were mops: the sweep that produced those rows will produce more next Monday, and
nothing in the code stops it.

**Standing gate per item** (unchanged): pure logic in `lib/` with golden tests including the
boundary and honest-emptiness cases · additive idempotent schema · `npx tsc --noEmit` clean ·
`npm test` green · `npm run build` clean · `npm audit` 0 · smoke the actual surface · deploy
guide. Mutation-check every new test. Verify production on **www** with `curl -L`.

---

## Sprint S — span correctness (finish rule 5)

*Updated 5 Nov 2026 after S1 shipped: the review of S1 found a **fifth** break (S4 below). Each
of the five was found while chasing the previous one, which is the argument for the deliberate
sweep rather than waiting for the next symptom.*

### S1 `eventsInWindow` is not span-aware at all — the list and map drop most of what is on ⭐
**Where:** `lib/dates.ts:93-105`. Consumed at `components/EventsExplorer.tsx:247-249`
(`windowedEvents`), which feeds `ListView` (:623), `MapView` (:627), `MapEventList` (:632) and
the "N matches" count (:338). `DEFAULT_VIEW = "list"` (`EventsExplorer.tsx:64`), so this is the
first thing a visitor sees.

**Bug:** it filters on the **start instant only** — `const d = evDate(ev); return d >= win.start
&& d <= win.end`. No `spanEnd`, no `daysSpanned`, no span awareness of any kind. An event that
began before the window and runs through it is simply absent. This is not the over-cap bug:
it drops **short runs too**.

**Measured, 5 Nov 2026** (published rows, all categories, true-span intersection as the oracle):

| range | list shows | genuinely on | hidden | |
|---|---|---|---|---|
| **Today** | **10** | **33** | **23** | **70%** |
| Weekend | 58 | 82 | 24 | 29% |
| Week (the default) | 89 | 112 | 23 | 21% |
| Month | 313 | 341 | 28 | 8% |

**4 of the 23 hidden from Today are runs of 14 days or less** — inside `EXPAND_MAX_DAYS`, so the
calendar grid expands them onto today's cell while the list view, looking at the same day,
says they are not on. Hidden today include *Monsters on Vacation*, the *Fall Flower Show*'s
neighbours, *Martine Syms*, *Jeyifous* and the *Virtual Reality Transporter*.

**Failure scenario:** someone opens the site on a Tuesday, leaves it on the default list, and
sees 10 of the 33 things open in the metro that day. They switch to the calendar and the cell
for the same day shows more. The two views of one dataset disagree, and the one that
under-reports is the default.

**Fix — and this needs a design decision, not a one-liner.** Making membership span-aware is
three lines. But Today then goes 10 → 33, and 20 of those are months-long exhibitions, which is
the flood the 14-day cap exists to prevent, arriving by another door. The options, in the shape
the day page already proved:
  1. **Span-aware membership, long runs in their own group** — reuse `alsoRunningPlan`'s split:
     things starting in the window, then a capped "Also running" group. Consistent with
     `/day/<date>` and `/this-weekend`, which both already do exactly this.
  2. Span-aware membership, flat — simplest, floods Today.
  3. Span-aware membership with the long runs behind a toggle — more UI than the problem needs.
Recommend (1). The match count must then say what it counts; "33 matches" with 20 of them
standing exhibitions is the dishonest version of the same fix.

**Tests (~10):** a 3-day run spanning the window edge, hidden today, visible after · a 233-day
run · an event starting inside the window (unchanged) · one ending the day before the window
(excluded) · the window's first and last day as boundaries · DST weeks · the match count agrees
with what renders · the grid cell and the list agree for the same day — the caller-level test,
since that disagreement is the symptom.

**Verify:** `/` on the default list, Today range — the count and the rendered rows both reach
33 for 5 Nov's data shape; the calendar cell for the same day no longer exceeds the list.

**Size: M.** **Depends:** nothing. This is the next item.

### S4 `selectCollection` decides membership from the start day alone — THE FIFTH BREAK ⭐
**Where:** `lib/collections.ts:148-152`. Reaches `app/collections/page.tsx` (every index card
count), `app/collections/[slug]/page.tsx` (all eight pages), `app/content/collection/[slug]/route.tsx`
(the OG card) and `app/admin/content/page.tsx`.

**Bug:** `if (e.start < w.fromWall) return false;` then `const day = e.start.slice(0, 10);
return w.days ? w.days.has(day) : day <= w.endKey;`. No `spanEnd`, no `daysSpanned` — the same
shape as the `eventsInWindow` break fixed in S1. A run that opened before the window and is
open right now is absent from its own collection.

**The decisive evidence is the divergence from the SAME spec.** `lib/feeds.ts:93-97` answers
the identical question for the identical `CollectionSpec` by true-span intersection
(`first <= endKey && last >= startKey`), and `lib/feeds.ts:113` uses `spansDay` for the
weekend branch — and `feeds.ts:87` builds those feeds from `COLLECTIONS.map((c) => c.slug)`.
So `/feeds/<slug>` and `/collections/<slug>` disagree, with the under-reporting one as the
indexed HTML page. That is the R1.5 page-versus-ICS shape `/this-weekend` already paid for.

**Measured, 5 Nov 2026 — THIRD time, and the first two were both wrong.** The only measurement
worth quoting runs the OLD predicate and the new one side by side over the real published set:

| collection | before | after | gained |
|---|---|---|---|
| `date-night` | 41 | 58 | **17** |
| `arts-and-culture` | 58 | 74 | **16** |
| `free-this-week` | 15 | 22 | 7 |
| `family-fun` | 15 | 19 | 4 |
| `only-in-minnesota` | 2 | 3 | 1 |
| `live-music`, `festivals-and-markets`, `food-truck-festivals` | — | — | 0 |

**45 rows gained, 0 lost.** Both earlier figures quoted here were wrong and are left on the
record deliberately: the first said **686**, from an oracle that applied only the category
filter and ignored each spec's own price and query rules; the second said **22**, from an
oracle that cloned each event onto the first covered day but kept its original time-of-day, so
the old predicate's `e.start < w.fromWall` still rejected the clones. Simulating a predicate is
how you get a wrong number twice. Run the old code against the new code.

**Rule 6 rode on top of rule 5 here:** before this shipped, `app/collections/[slug]/page.tsx`
rendered its own `groupByDay` and nothing else, so its "No events match this collection yet"
copy could print while a qualifying run was open. That private grouping is now deleted.

**Fix — SHIPPED 5 Nov 2026.** Not by importing from `feeds`: `feeds.ts` imports `COLLECTIONS`,
so that dependency only runs one way and the import would have cycled. The rule moved DOWN to
`lib/multiday.ts` as `spansWindow`, beside `spansDay`, where both callers already import from;
`feeds` deleted its local copy. The collection page uses `planListView` for an "Already
running" group and lost its own third copy of day-grouping.

**Tests:** added, including the parity test that would have caught this — the page and the
ICS feed, built from one spec, asserted equal over five shapes. Mutating `spansWindow` to
ignore the span fails tests on BOTH sides, which is the proof the predicate is really shared.

**One axis still differs, deliberately.** R1.2's floor is kept: a SINGLE-DAY event that already
started today is past, so this morning's concert leaves the collection in the afternoon while
the ICS keeps it. A RUN that began this morning stays in both. A test pins it.
**Size: S–M.** **Shipped.**

### S2 `readEventsForDay` prefers a `multi_day_end` that is not later than the start
**Where:** `lib/events.ts:241` and `:246-247`.

**Bug:** a bare `coalesce(multi_day_end, end_at)`. `spanEndISO` (`lib/dates.ts:208-213`) takes
`multiDayEnd` only when it is **strictly later** than the start day and otherwise falls through
to `end`. So a row with `multi_day_end` pinned to its start day and a long `end_at` is read as
a span by the planner and as a non-span by the day query. The sibling shelf query was guarded
on 5 Nov; this one was deliberately left, because changing the main day list deserves its own
verification pass.

**Measured:** **0 published rows have that shape today.** `lib/corrections.ts` rejects a
`multi_day_end` *before* the start day, so it permits one *equal* to it — the shape is
reachable through a correction, not just through the pipeline.

**Fix:** lift the guarded expression already written at `lib/events.ts:300-312` into the sibling,
or factor both into one SQL fragment. Keep `::date <= 13`; `lib/__tests__/upsert-queries.test.ts`
pins it.

**Tests:** extend the complementarity sweep in `lib/__tests__/ongoing.test.ts`, which already
carries the `multiDayEnd == start day` fixture, to assert the day-query mirror too.
**Verify:** a day page's card count is unchanged for a week of dates before and after.
**Size: S.** **Depends:** nothing.

### S3 `· daily from 9 AM` on runs that are closed that day
**Where:** `components/EventDetailBody.tsx:77`.

**Bug:** a multi-day run prints `runs N days · daily from <start time>`. *Monsters on Vacation*
renders "runs 233 days · daily from 9 AM" while `mcm.org/museumevents` prints "Monday: closed"
for the school year — roughly 33 false days. `all_day` suppresses the line but is not a
`Correction` field, so no data fix reaches it.

**Fix:** delete `· daily from {fmtTime(event.start)}` from the multi-day branch. The span badge
and the day-page "Through Jan 10" already carry the useful part, and venue hours now live on the
venue page (`lib/venue-hours.ts`). **This is a copy change, so it is Taren's call** — the
alternative is keeping it and accepting it is wrong on any run with a closed day.

**Tests:** one render assertion that a multi-day event's detail body contains no "daily from".
**Verify:** the *Monsters on Vacation* event page. **Size: XS.** **Depends:** an owner yes.

---

## Sprint T — the treadmills (stop producing the rows, not just archiving them)

Both of these were mopped on 5 Nov. Neither is fixed.

### T1 Opening hours keep arriving as month-long events
**Where:** the weekly sweep; symptom in `events` rows titled `… – Daily General Admission`,
`… – Daily Open Admission`, `… – Daily Zoo Visit`, `… – Daily Indoor Theme Park`.

**Measured:** 32 rows of this shape exist. **24 had already been archived by earlier passes**
and 8 were live again on 5 Nov — so this recurs roughly monthly and has done for months. They
are not false (the zoo is open daily); they are a standing fact in an event's shape, and they
sort to the top of the new day-page shelf by "Last day".

**Fix:** a pipeline-side reject or a reclassifier rule — a listing whose title matches
`(general|open|daily) admission`-shaped patterns, whose "run" is a rolling window, and which
has no distinct start, is a venue fact. Candidate homes: the classifier, or an upsert-time
guard beside `archivePastEvents`. Prefer rejecting at write time over archiving at read time.

**Tests:** golden fixtures from the 32 real titles — all 32 rejected, and a set of genuine
long-run exhibitions all accepted (the false-positive side is the risk).
**Verify:** the first Monday run after shipping produces zero new rows of the shape, and the
ops digest reports the rejects. **Size: M.** **Depends:** nothing.

### T2 Long runs are re-found and re-clipped every week
**Where:** the sweep plus `lib/multiday.ts` fold.

**Measured:** 7 productions had overlapping live rows on 5 Nov, 14 excess rows. The signature is
starts one week apart with an **identical close** — each pass clipping the run to its own sweep
window. The 4 Nov fold catches re-finds it can match; these carried a start it did not expect,
and for *Twelve Kinds of Ice* the correct row had been **archived** while four clipped ones
stayed live.

**Fix:** when an incoming row matches a live run by `runKey` and its span is a **subset** of the
live row's, update the live row rather than inserting. The harder half is the inverse — an
incoming row whose span is a *superset*, which should widen the keeper.

**Tests:** golden planner cases for subset, superset, overlap and disjoint; plus the
archived-row collision case, since that is what made the correct row unreachable.
**Verify:** a dry-run of the next sweep lists zero new overlapping pairs. **Size: M.**
**Depends:** nothing, but S1 and T1 are both higher value.

---

## Sprint H — hygiene

### H1 SEA LIFE Minnesota Aquarium is not in the venue registry
Its two admission rows were archived on 5 Nov with nowhere for the hours to go — the only one
of the four venues that lost information. `matchVenueSlug("SEA LIFE Minnesota Aquarium")`
returns null. Adding it also adds it to the pipeline's weekly sweep, so it is not a pure
display change. Note its own site prints only "Opening times today", so there may be no
standing schedule to record. **Size: S.**

### H2 Fifteen correction files sit unapplied in the repo root
Including `corrections-ehnes-dedupe.json`, which was **re-measured on 5 Nov and is now stale**:
it archives 3 of 5 Ehnes rows, but only 2 remain and they are on different days, so applying it
blind would archive a genuine second performance. Triage all fifteen: apply, rewrite or delete.
**Size: S, but it is reading not coding.** **Depends:** nothing.

### H3 Three corrected keepers went back unstamped
*Monsters on Vacation*, the *Fall Flower Show* and *Martine Syms* all had verify-relevant fields
changed with no clock time on the evidence page, so `verified_at` was cleared by design. The
next scheduled verify pass will re-read them; no work unless it does not.
**Size: none, a watch item.**

---

## Owner calls (no code until Taren decides)

- **O1 — "Already running" vs "Also running".** Both now appear on `/day/<date>`, a few inches
  apart, and the only difference is a 14-day threshold no reader can perceive. `/ongoing` uses
  "Also running" for a third meaning. Three labels, one concept.
- **O2 — the shelf cap.** `ALSO_RUNNING_CAP = 6` with a link on. Six was a guess.
- **O3 — S3 above**, the "daily from" line.

---

## Sequencing

1. ~~**S1**~~ — **SHIPPED 5 Nov 2026**, with the Travail duplicate cluster it exposed cleared in the same pass. See docs/deploy-history/DEPLOY-S1-LIST-SPAN-AWARE.md.
2. ~~**S4**~~ — **SHIPPED 5 Nov 2026.** 45 rows gained, 0 lost; page and feed now agree.
3. **T1** — stops the most visible treadmill before the next Monday run.
4. **S2** — small. It does NOT "close rule 5 for good", which an earlier draft of this line
   claimed: six literal breaks have been fixed and the start-only cousin shape
   (`lib/related.ts:29` above all) has never been swept.
5. **H2** — cheap, and one of those files is now actively dangerous.
6. **T2** — the harder treadmill.
7. **H1**, then the owner calls as they land.
