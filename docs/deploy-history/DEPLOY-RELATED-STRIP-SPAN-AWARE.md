# Deploy — "More at this venue" disagreed with the venue page it links to

**Date:** 9 November 2026 · **The last start-only predicate that made two surfaces disagree**
**Files:** `lib/related.ts`, `lib/multiday.ts`, `lib/digest.ts`,
`components/MoreAtVenue.tsx`, `app/globals.css`, and their tests
**Schema:** none. **Data:** none. Code only.

Named and left untouched since 5 November, through five other fixes. It is on **every event
page** — the page type that carries 89% of the site's search impressions.

> **Not "the last start-only predicate on a reader-facing page".** An earlier draft of this
> line said that, and a grep before pushing showed it is false:
> `lib/content/weekly-picks.ts:58` filters `e.start >= nowWall && e.start <= endWall`, and
> it feeds `/this-week` (via `digestEvents`) and the weekly email's picks. That one is
> **deliberate** — picks are things *starting* in the window, which is precisely what keeps
> those rows' own start labels honest, as the digest review confirmed on 6 Nov. It is a
> definition, not a disagreement. What this commit closes is the last start-only predicate
> that made two surfaces answer the same question differently.

---

## What was wrong

```ts
const upcoming = (e) =>
  e.status === "published" && e.id !== current.id && e.start >= nowWall;
```

A **start** question. A run already on at that very venue was absent from the strip, while
`/venues/<slug>` — the page the strip's own "See all" links to — listed it, because that page
has used the span-aware `isUpcoming` since 5 November.

**Observed on the real pages.** `/event/<Beach Monster Exhibit>` fell back to the
neighbourhood, while `/venues/minnesota-children-s-museum` showed two cards,
`Beach Monster Exhibit` and `Monsters on Vacation`, both badged `May 23 – Jan 10`.

> **That pair is a known duplicate, and an earlier draft used it as the headline evidence
> without saying so.** [DEPLOY-VERIFY-YEAR-GATE.md](DEPLOY-VERIFY-YEAR-GATE.md) already
> records both rows as one exhibit under two names — the museum runs *Monsters on Vacation*,
> and `Beach Monster Exhibit` is judged "a roundup writer's paraphrase ... promoted to a
> title", with an end date "attested nowhere I could find". It was left alone on purpose,
> because every move is a product call on a live listing. So on that one page the "other
> thing at this venue" is probably the same thing the reader is already looking at — and
> this change makes the duplicate **more** visible, which is an argument for resolving it,
> not against the fix. The clean case is the Arboretum one below.

Note also that a fallen-back strip's "See all" points at `/neighborhoods/<key>`, not the
venue — so the disagreement was between the strip's CONTENT and the venue page, not between
the strip and the link it was rendering at that moment.

---

## The obvious fix was wrong, twice

### 1. Swapping the predicate for `isUpcoming` would have changed far more than runs

`isUpcoming` is **day-granular**. Adopting it wholesale brought back *this morning's finished
concert* until midnight — and R1.3 excludes that deliberately ("the morning show is honestly
past"), with two tests pinning it. The first cut did exactly this and **failed both**.

So the run clause is **added to** the wall-clock floor rather than replacing it:

```ts
const stillRunning = (e) => {
  const end = spanEnd(e);
  return Boolean(end && dayOf(end) >= todayKey);
};
const upcoming = (e) =>
  e.status === "published" && e.id !== current.id &&
  (e.start >= nowWall || stillRunning(e));
```

R1.3 is untouched. The strip still differs from the venue page about a single-day event that
has already finished today — **deliberately**, and that is not changed here.

### 2. Admitting runs on a start sort would have wrecked 129 pages

Measured before writing the fix: with the predicate widened but the old
`sort((a,b) => a.start.localeCompare(b.start))` left in place, **129 of 679 event pages** would
have led their strip with a months-old exhibition. Only **5 venues and 4 neighbourhoods** carry
an underway run, but they feed that many pages. The strip now uses `soonestFirstThenRuns`, whose real callers are the map list
(`MapEventList.tsx:38`), the collection share card (`templates.ts:135`) and the Instagram
cards (`instagram.ts:93`) — plus the weekly email's *per-subscriber* "you saved these"
block only (`digest-personal.ts:58`). An earlier draft named four adopting surfaces
including `/this-weekend`; that page sorts its own "Happening all weekend" section
ending-soonest in `lib/weekend.ts`, and that file's own comment says it is **not** identical
code. The email's main picks never see a run at all, because `weeklyPicks`' window is
start-only. Two and a half adopters and one shared principle, not four.

### 3. The row also printed a stale clock

`MoreAtVenue` rendered `e.start`'s date and `timeLabel(e)` unconditionally, so a run read
**`Sat, May 23 · 10 AM`** — a date months past and the first day's clock, which
`lib/day-order.ts` refuses to print ("never a clock we cannot stand behind"). A row that began
before today now shows its span and **no time**; a row starting today or later keeps both.

`.more-at-date` was `width: 92px`, which a span overflows — at 12px tabular-nums the widest
of them measures about **95.3px**, so it wrapped to two lines. A first pass used
`min-width: 92px`, which fixed the wrap but **did not keep the column aligned**: `flex: none`
sizes to content above a floor, so the one row with a span got a wider date column than its
neighbours and its title started a few pixels further right — on exactly the row the change
was made for. It is now a fixed `width: 96px`, which clears the widest label and keeps every
row on one left edge.

---

## Measured, 9 November 2026 (737 published rows, 17 runs underway)

| | |
|---|---|
| event pages whose strip changes | **6** |
| empty → populated | 0 |
| net related rows | **−2** |
| strips now led by a run | 2 — both where the only other thing at that venue *is* the other run |

The −2 is the venue branch winning. Those two pages fell back to four neighbourhood rows
because nothing *future-starting* was at that venue; they now show the other row at that
venue, which is what the heading promises. **Both of those two pages are the duplicate pair
above**, so on them "the other row" is the same exhibit under its other name — the
behaviour is right and that particular pair is a data problem, not a win to claim. The other four gain the run as a fourth row, after
the dated ones.

**Six pages, not 374.** The naive predicate swap changed 374 — and most of that was the
day-granularity regression, not the defect.

---

## Verification

### Observed in the running app

`/event/7e68c8da…` — *Rootstock Seasonal Tea*, Minnesota Landscape Arboretum:

```
More at Minnesota Landscape Arboretum
  Thu, Nov 19      Give to the Max Day at the A    All day
  Fri, Nov 20      Northern Lights                 4:30 PM
  Fri, Dec 4       Auxiliary Holiday Sale          9 AM
  Oct 19 – Nov 23  Thin Veils and Fluid Borders    (no time)
```

`/event/66d2385a…` — *Beach Monster Exhibit*: heading is now **"More at Minnesota Children's
Museum"**, one row `May 23 – Jan 10 · Monsters on Vacation`, "See all" →
`/venues/minnesota-children-s-museum`. That page shows the same two cards with the same badge.
The strip and its own link now agree.

### Mutation

| mutation | tests that failed |
|---|---|
| the predicate back to start-only | 2 |
| the order back to a start sort | 1 |
| `beganBeforeToday` drops its day check | **4 — across two files**, multiday and digest |

The label gate was originally pinned by three `toContain` assertions against the component's
source text, one of them carrying exact JSX indentation. A review was right that this is a
string match and not behavioural coverage — it would pass whatever the rule did — and that
the embedded newline would fail on any CRLF checkout, which every `.claude` worktree is.
The rule now lives in `lib/multiday.ts` as `beganBeforeToday`, is tested there by behaviour,
and the component keeps two normalised single-line wiring assertions.

### Quality gate

| | |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` | **3,380 passed in 156 files** |
| `npm run build` | clean, 637 pages |
| `npm audit` | **0 vulnerabilities** |

No exclusions this time — the other session's work is committed and its tests pass.

---

## Deploy

```bash
git add lib/related.ts lib/multiday.ts lib/digest.ts components/MoreAtVenue.tsx app/globals.css lib/__tests__/related.test.ts lib/__tests__/multiday.test.ts docs/deploy-history/DEPLOY-RELATED-STRIP-SPAN-AWARE.md
git commit -m "fix — an event page said nothing else was on while its own link disagreed"
git push
```

Verify on **www** with `curl -L` (the apex 308s) — the strip is server-rendered:

1. `/event/66d2385a-93ff-4903-9f96-2068ab8e3344` — heading reads "More at Minnesota Children's
   Museum", one row badged `May 23 – Jan 10`, no clock
2. that row's "See all" link lands on a venue page listing the same event
3. a normal event page is unchanged: dated rows still show weekday, date and time

## Rollback

`git revert`. The predicate, the ordering and the label are independent; the CSS change is
`width` → `min-width` and affects nothing whose content is under 92px. No schema, no data.

---

## Left open

- **`lib/verify-flags.ts:62`** (`e.start_at >= now()`) is the last start-only predicate named
  in this chain that is arguably a defect. It is the reader-report path, not a reader-facing
  page, and it can hide a report about a currently-running show.
- **Start-only predicates that are NOT defects**, listed so the next sweep does not re-raise
  them: `lib/content/weekly-picks.ts:58` (picks are things starting in the window — and that
  is what makes the email's start labels honest), `lib/collections.ts:177` (the R1.2 floor,
  with its all-day arm), `lib/digest-personal.ts:43` (its run branch sits directly below),
  and the ops/admin/pipeline queries in `lib/admin.ts`, `lib/ops-inputs.ts`,
  `lib/source-sweep.ts` and `lib/verify.ts`, none of which a reader sees.
- **The strip still differs from the venue page** about a single-day event that already
  finished today — R1.3's deliberate floor, left exactly as it was. If Taren wants the two
  fully aligned, that is a one-line change and two tests to rewrite.
- **The Minnesota Children's Museum duplicate pair is still live and now links to itself.**
  `Beach Monster Exhibit` and `Monsters on Vacation` are one exhibit under two names, each
  now appearing as the other's "More at this venue". Resolving it is the product call
  DEPLOY-VERIFY-YEAR-GATE.md deliberately left to Taren; this change only makes it easier
  to see.
- **The yearless span label** is unchanged, now across eight surfaces counting this strip.
