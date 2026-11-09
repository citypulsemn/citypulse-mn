# Deploy — the map list opened on May, and a caption disagreed with its own card

**Date:** 8 November 2026 · **Found by:** the review of [DEPLOY-IG-CARD-ORDER-LABEL.md](DEPLOY-IG-CARD-ORDER-LABEL.md)
**Files:** `components/MapEventList.tsx`, `components/EventsExplorer.tsx`,
`lib/list-view.ts`, `lib/content/templates.ts`, `app/admin/content/page.tsx`, and their tests
**Schema:** none. **Data:** none. Code only.

The last two **major** findings from that review. Same shape as the three before them: a
surface went span-aware, and the **ordering** beside it did not.

> **Not the last confirmed findings.** That review confirmed **five**, and an earlier draft
> of this line — and of the commit message — called these "the last two confirmed". One
> **minor** is still open: `lib/weekend.ts:127` sorts the live "Happening all weekend"
> section longest-running first (`ongoing.sort(byStart)`, untouched since R1.5 / `9bb0f9d`).
> It is reader-facing on `/this-weekend` and is **not** fixed here. A review caught the
> closure claim; five commits ago this chain shipped one titled *"a closure claim that
> contradicted itself"*, so this is the same failure a second time.

---

## 1. The map list — live, reader-facing, and firing

`MapEventList` sorted the window's events by start:

```ts
const sorted = [...events].sort((a, b) => a.start.localeCompare(b.start));
```

`eventsInWindow` went span-aware on 5 Nov, so every run already underway sorted **ahead of
everything happening today**. The label beside it was fixed that same week; the order was not,
in a file whose own comment names the cause.

### Measured on the live set, 8 November 2026 (680 published rows)

| range | rows | began before the window |
|---|---|---|
| **Today** | 40 | **20** |
| Weekend | 40 | **20** |
| Week | 156 | 20 |
| Month | 390 | 16 |

Today is a **Sunday**, and `weekendDays` returns just today on a Sunday, so the Weekend row
above is the *same window* as Today rather than an independent second reading.

Every range opened with the same three rows:
`Beach Monster Exhibit (05-23)`, `Monsters on Vacation (05-23)`, `Collection in Focus (06-25)`.
**Half the Today view had begun before today, and the three at the top had begun months
before** — "months" is verified for those three; the other 17 are only known to predate the
window.

### The fix

The map list now builds its order from the **same plan `ListView` builds from the same array** —
`soonestFirstThenRuns(events, windowStartKey, todayKey)`. `EventsExplorer` already handed
`ListView` both keys; it now hands `MapEventList` the same two, and a test asserts that both
props appear exactly twice in that file, so the two halves of one screen cannot drift apart.

`soonestFirstThenRuns` gained an optional `todayKey`, defaulting to `windowStartKey`. That
default is right when the window opens today and keeps both existing callers byte-identical;
it matters for a window that opens on another day, where "was it underway when the window
opened" and "is it underway now" are different questions. `ListView` has always asked the
second. Now so does the map.

---

## 2. The caption disagreed with the card it ships beside

`collectionCaptionFor` built its bullets from `sample.slice(0, 4)` with `shortDate(e.start)`.
`sample` is `selectCollection`'s output — span-aware since 5 Nov and returned **start-ascending**
— so the caption listed the four rows that **opened longest ago** and printed each one's start
date, months before the post.

The card it pairs with, `/content/collection/<slug>`, was fixed on 6 Nov. **The caption beside
it was not**, so an operator copying both posted a card and a caption that named different
events with different dates.

### Measured, 8 November 2026

The collection actually wired into the admin page is `food-truck-festivals`, and it has **0 rows
today** — so **nothing is firing**. The function is still wrong for any collection:

| collection | rows | caption rows ≠ card rows | caption rows dated before today |
|---|---|---|---|
| `date-night` | 18 | **yes** | 4 |
| `arts-and-culture` | 90 | **yes** | 4 |
| `family-fun` | 18 | **yes** | 3 |
| `free-this-week` | 15 | **yes** | 4 |
| `live-music`, `festivals-and-markets`, `only-in-minnesota` | — | no | 0 |
| `food-truck-festivals` | **0** | no | 0 |

The caption now takes `collectionCardRows(sample, todayKey, CAPTION_ROWS)` — literally the
card's own rows — and labels a run with its span, exactly as the card route does.

---

## Verification

### Observed in the running app (map view, 1440×900, service worker unregistered first)

```
total rows                     156
dated events, chronological    0–135
trailing block of runs         136–155  (20 rows, exactly the began-before count)
runs ordered ending-soonest    May 23 – Jan 10 … Jun 25 – May 23
spans before the block         9, all starting Nov 11–14
```

Those nine are runs that **open inside** the window: they keep their chronological place and
still state their span, which is the intended behaviour and the reason the trailing block is
20 and not 29. The list opens on `All day · Teddy Thompson`, `10 AM`, `11 AM`, `11 AM`,
`12:30 PM`… — today, in time order.

**Not verified locally:** the map pane itself. `.env.local` has no `NEXT_PUBLIC_MAPBOX_TOKEN`,
so the canvas renders its "Map needs a Mapbox token" placeholder. That is pre-existing and
unrelated — the list is a sibling component and renders independently — but it means this
change was verified against the list only.

### Mutation

| mutation | tests that failed |
|---|---|
| `MapEventList` back to its own start sort | 1 |
| `collectionCaptionFor` back to `slice(0, 4)` + `shortDate` | 2 |
| `soonestFirstThenRuns` ignoring `todayKey` | 1 |

That third one needed a **rewritten test**. The first draft compared two calls that the
mutation would have changed identically, so it pinned nothing — the same shape this project
already recorded as *a test pinning the bad behaviour*. The replacement asserts the two calls
**differ**, and fails the moment the parameter is ignored.

### Quality gate

| | |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` | 3,299 passed in 155 files |
| `npm run build` | clean, 642 pages |
| `npm audit` | **0 vulnerabilities** |

---

## Deploy

```bash
git add components/MapEventList.tsx components/EventsExplorer.tsx lib/list-view.ts lib/content/templates.ts "app/admin/content/page.tsx" lib/__tests__/list-view.test.ts lib/__tests__/content.test.ts docs/deploy-history/DEPLOY-MAP-LIST-AND-CAPTION-ORDER.md
git commit -m "fix — the map list opened on exhibitions from May"
git push
```

Verify on **www** with `curl -L` (the apex 308s). The map list is client-rendered and only
shows at ≥1000px, so it cannot be checked with `curl`: open `/?view=map` on a desktop width
and confirm the list opens on today's times, with the long runs grouped at the bottom.

## Rollback

`git revert`. The `todayKey` parameter is additive and defaulted, so the **three** pre-existing
callers are unchanged by it: `lib/content/templates.ts:135`, `lib/digest-personal.ts:58` and
`lib/instagram.ts:93`, all of which pass two arguments. (An earlier draft said "both" and
counted two — the substance held, the count did not.) No schema, no data.

---

## Left open

- **The map list shows a span where it used to show a time**, for a run that opens inside the
  window — 9 rows on today's Week view. That was a deliberate 5 Nov change and neither review
  flagged it, but it is the same trade the weekly email resolved the other way two days ago
  (`lib/day-order.ts`: *"starts today → its actual start time, even if it runs on for days"*).
  The email keeps the time because its row also carries a date; the map row carries **only**
  this one label, so a span says more than a bare clock. Defensible, deliberate, and worth
  Taren's eye rather than my silent choice.
- **A month that does not contain today splits two equally-spanning runs to opposite ends.**
  The ongoing/starting test uses `todayKey`, so browsing December in November puts a run
  that is on *now* at the bottom and one starting 1 December at the top. A review proposed
  clamping `todayKey` to the window start. **Not taken**, for three reasons: it would
  contradict the test this commit deliberately pins and mutation-checks; it would make the
  map list answer differently from `ListView`, which is the divergence this whole chain has
  been removing; and the current behaviour is arguably the rule working — "new this month"
  above "already going" is the editorial intent. It is also **not a regression**: before
  this commit every pre-window run sat at the very top of a non-current month. Desktop-only,
  not the default range, and Taren's call rather than mine.
- **The yearless span label** is unchanged and now spans seven surfaces counting this caption.
  Still one owner call, recorded in the Instagram guide.
