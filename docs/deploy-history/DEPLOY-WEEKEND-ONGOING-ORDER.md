# Deploy — "Happening all weekend" ranked runs by age, not by what closes first

**Date:** 8 November 2026 · **Found by:** the review of [DEPLOY-IG-CARD-ORDER-LABEL.md](DEPLOY-IG-CARD-ORDER-LABEL.md)
**Files:** `lib/weekend.ts`, `lib/list-view.ts`, `lib/__tests__/weekend.test.ts`
**Schema:** none. **Data:** none. Code only.

The fifth and last **ordering** finding from that review, and the one the previous guide
wrongly called closed. Reader-facing on `/this-weekend`.

> **Still not "the last confirmed finding" — I checked before writing it this time.** That
> review confirmed **twelve**. Six were ordering or labelling defects and all six are now
> fixed. Four were informational notes. **Two remain open and are not touched here:**
> `lib/instagram.ts:191` (minor) hardcodes the caption's bio link to `/this-weekend` for
> both windows, so the default 7-day card sends a reader who tapped a Tuesday row to a page
> listing Fri–Sun; and `app/admin/instagram/page.tsx:25` (note) steps the window by a fixed
> 86,400,000 ms, which collapses two day keys in the Chicago midnight hour of a DST
> fall-back. Both are admin-side.

---

## What was wrong

```ts
const byStart = (a, b) => a.start.localeCompare(b.start);
ongoing.sort(byStart);
```

Every member of `ongoing` started **before the weekend by construction**: the `else` branch that
fills it is reached only when `startDay` is not a weekend day, and the overlap check above has
already dropped anything starting after the weekend. So sorting by start ranked the section by
**age** — longest-open first — which is exactly backwards for a list whose only urgent fact is
how much longer you have.

`lib/ongoing.ts` already says so in words, for the same question on the day page:

> *"ORDER: ending soonest first. 'Last day' is the only urgent thing about a run that has been
> open for two months."*

### Measured on the live set, 8 November 2026

For the weekend of **13 November**, "Happening all weekend" held 23 rows:

| position | event | opened | closes |
|---|---|---|---|
| **1** | Beach Monster Exhibit | 23 May | 10 Jan |
| **23** | Dr. Seuss's *Grinch* | 12 Nov | **13 Nov** |

**The performance whose last day was the Friday of that weekend came last.** Today's weekend
(a Sunday, so a one-day window) had the same shape: `Michael Longfellow`, closing today, was
20th of 20.

The reach is wider than the visible cards. `app/this-weekend/page.tsx` builds its schema.org
`ItemList` from `sections.flatMap(...)`, so the stalest row also took **position 1 in the page's
structured data**.

---

## What shipped

```ts
const endDayOf = (e: EventRecord) => dayOf(spanEnd(e) ?? e.start);
ongoing.sort(
  (a, b) =>
    endDayOf(a).localeCompare(endDayOf(b)) ||
    a.start.localeCompare(b.start) ||
    a.title.localeCompare(b.title),
);
```

Ending soonest first, tie-broken on start then title — **the same three keys, in the same
order, as `lib/ongoing.ts`'s day-page shelf**.

Not *byte*-identical, and an earlier draft of this line said it was: `lib/ongoing.ts` sorts
`{ event, endDay }` wrappers rather than `EventRecord`s, and its **other** sort — the one
feeding `/ongoing` — omits the title tiebreak entirely. So that file is already two
comparators, not one. What matches is the rule, which is the part that mattered.

**The per-day sections still sort by start, and that is correct**: every row in a day bucket
starts that day, so `byStart` is the clock there, not an age ranking. A test now pins that too,
because it would be an easy thing to "fix" by mistake.

### A false claim in a file I wrote this week

`planListView`'s docstring said its ending-soonest group was *"the same shape `/day/<date>` and
`/this-weekend` already use"*. **It was wrong about both.** `/this-weekend` sorted by start until
this commit, and `/day` is still two answers on one page: its "Also running" shelf is
ending-soonest via `lib/ongoing.ts`, while the in-cap group from `lib/day-order.ts` sorts **by
title**. The docstring now says that instead of asserting a consistency that did not exist.

---

## Verification

### The rendered page (dev server, live data)

```
Happening all weekend
  Oct 10 – Nov 8    Kunene and the King
  Nov 2 – 8         Ikebana Flower Show
  Nov 5 – 8         Michael Longfellow
  Oct 13 – Nov 22   Twelve Kinds of Ice
  Oct 19 – Nov 23   Thin Veils and Fluid Borders
  Oct 23 – Nov 29   Fall Flower Show
  Nov 2 – 30        SEA LIFE Military Appreciation
  Aug 17 – Dec 31   Virtual Reality Transporter

ItemList position 1: Kunene and the King
```

Three runs closing **today** lead; the rest ascend by end date. The structured data leads with
the same row. Re-measured over the pure function for the 13 Nov weekend: 23 rows in, 23 out,
`already ending-soonest? true`.

### Mutation

| mutation | tests that failed |
|---|---|
| `ongoing.sort` back to `byStart` | **2** |

### Quality gate

| | |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` | **3,303 passed in 155 files** — see below |
| `npm run build` | clean, 642 pages |
| `npm audit` | **0 vulnerabilities** |

**The raw `npm test` run reports 2 failures**, both in `lib/__tests__/playground-facts.test.ts`.
That file and `lib/playground-facts.ts` are **untracked** — another session's in-flight work in
this shared checkout, mid-edit. The test references nothing this change touches (0 matches for
`weekend`, `list-view` or `soonestFirstThenRuns`). The figure above is the suite with that one
untracked file excluded; this commit contains none of that work.

---

## Deploy

```bash
git add lib/weekend.ts lib/list-view.ts lib/__tests__/weekend.test.ts docs/deploy-history/DEPLOY-WEEKEND-ONGOING-ORDER.md
git commit -m "fix — 'Happening all weekend' put the thing closing today last"
git push
```

Verify on **www** with `curl -L` (the apex 308s) — `/this-weekend` is server-rendered, so this
one *can* be checked with curl, unlike the map list:

1. `https://www.citypulsemn.com/this-weekend` — the "Happening all weekend" section leads with
   the smallest end date, not the oldest start
2. the first `ListItem` in the page's JSON-LD is that same row
3. the per-day sections below still read in clock order

## Rollback

`git revert`. One sort comparator and a docstring. No schema, no data, no signature changes.

---

## Left open

- **`lib/day-order.ts:47` sorts the day page's in-cap ongoing group by TITLE**, while the
  "Also running" shelf on the same page sorts ending-soonest. Two answers to one question on
  one screen. Not touched here — it is a fifth surface and nobody has asked for it — but it
  is the only ORDERING left that disagrees with `lib/ongoing.ts`'s stated rule.
- **`lib/ongoing.ts` disagrees with itself**, noticed while matching it: the `/ongoing`
  sort has no title tiebreak, the day-page shelf sort does. Two rows sharing an end day and
  a start can therefore come out in different orders on the two surfaces. Cosmetic, unmeasured,
  and not touched.
- **Two confirmed items from the originating review are still open**, both admin-side:
  `lib/instagram.ts:191` (the caption's hardcoded `/this-weekend` bio link) and the DST
  day-stepping note at `app/admin/instagram/page.tsx:25`.
- **The yearless span label** is unchanged, across the same set of surfaces. Still one owner
  call, recorded in the Instagram guide.
