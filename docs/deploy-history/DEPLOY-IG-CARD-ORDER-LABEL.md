# Deploy — the Instagram cards were ordered and dated by the wrong day

**Date:** 6 November 2026 · **Follows:** [DEPLOY-S4-COLLECTIONS-SPAN-AWARE.md](DEPLOY-S4-COLLECTIONS-SPAN-AWARE.md)
**Files:** `lib/instagram.ts`, `lib/list-view.ts`, `lib/content/templates.ts`, and their tests
**Schema:** none. **Data:** none. Code only.

Two defects on the same surface, both about what a card does with a **run** — an event
spanning days rather than happening on one.

---

## What was wrong

`buildCards` picked the week's events correctly and then made two decisions from the wrong
date:

```ts
.sort((a, b) => a.start.localeCompare(b.start));   // line 88 — start ascending
…
const d = new Date(`${daysSpanned(e)[0]}T12:00:00Z`);  // line 136 — dayTag, the START day
```

A run that opened months before the window therefore **sorted first** and **printed a date
outside the window**.

### Both pre-date yesterday's fix. I said otherwise and was wrong.

`git show ca4deee -- lib/instagram.ts` changes **one filter line and the imports**, nothing
else. `git log -- lib/instagram.ts` has exactly two commits: `d21c0c4` (6.4.0) and `ca4deee`.
So the sort and `dayTag` are **original code** and have been wrong for as long as any run
could reach a card.

What `ca4deee` did was **widen** them. The old filter was
`daysSpanned(e).some((d) => daySet.has(d))`, and `daysSpanned` expands a run up to
`EXPAND_MAX_DAYS = 14` days — so runs of 14 days or less already reached cards and already
mis-sorted and mis-dated. Only runs **longer** than 14 days were excluded. Fixing the filter
let those in too, and their starts can be months back.

My previous report said these came "from the same one-line filter change in `ca4deee`". That
is wrong, and the comment I left on line 2 — `// dayTag asks a START question, legitimately` —
was wrong too. Both are corrected here.

### Measured on live data, 6 November 2026 (574 published rows)

| 7-day window, Nov 6–12 | old filter | new filter |
|---|---|---|
| pool size | 95 | 114 |
| **events whose `dayTag` falls OUTSIDE the window** | **3** | **22** |

And on the cards themselves — **7 of the 11 rows actually rendered** carried a date outside
the window:

| card | before |
|---|---|
| **Regular** 5/5 | led with `2026-05-23` **twice** (Beach Monster Exhibit, Monsters on Vacation) |
| **Family** 5/5 | **4 of 5 wrong** — `2026-10-23`, `2026-11-02` ×3 |
| **Weird** 1/5 | its only row tagged `2026-09-24` |

A card captioned "Your Twin Cities week, sorted" was two-fifths museum exhibits dated in May.

**Reach is one admin page.** `buildCards`/`formatCard` are consumed only by
`app/admin/instagram/page.tsx`. The reels auto-posting pipeline builds from `lib/reels/*` and
never touches this module — checked, not assumed.

---

## What shipped

### 1. One ordering rule, in one place

This is the **second** surface in two days to need "what's on soon, not what started longest
ago" — the collection share card was the first, fixed this morning with the rule inlined. A
third copy is how this project's span bugs have propagated all session, so the rule moved down
to `lib/list-view.ts`, beside `planListView`:

```ts
export function soonestFirstThenRuns(events, windowStartKey) {
  const plan = planListView(events, windowStartKey, windowStartKey, events.length);
  return [...plan.days.flatMap((g) => g.events), ...plan.ongoing];
}
```

What **starts** inside the window comes first, soonest first; runs already underway come after,
**ending-soonest first**. `collectionCardRows` now delegates to it, so both callers share one
rule. `buildCards` calls it with `windowDays[0]`.

**Runs are not excluded.** They top a card up when the lane is thin — which is what keeps the
Weird card alive at 1 of 5 rather than emptying it. Rule 6.

### 2. A run's card line states its real span

```ts
if (isMultiDay(e)) return multiDayLabel(e).toUpperCase();   // "SEP 24 – NOV 7"
```

A single-day event keeps the locked `FRI 7/17` tag. This is the same answer `EventDayCard` and
the collection share card give, so a card line and the site now agree. It also removes the
`daysSpanned` import from `lib/instagram.ts` **entirely** — the capped expansion is gone from
this file, which is what rule 5 actually asks for.

`formatCard`'s signature is unchanged, so `app/admin/instagram/page.tsx` needed no edit.

### 3. The dead `daySet`

`const daySet = new Set(windowDays)` survived `ca4deee` referenced only from a comment. Deleted.

---

## Verification

### The same live window, after

```
REGULAR (5/5)   FRI 11/6 ×5  — Steel Toe food truck, Static Dress, Gophers volleyball,
                               Levi Bloom, Initials Game Live Trivia        → 5 dated, 0 runs
FAMILY  (5/5)   FRI 11/6 ×3, SAT 11/7, SUN 11/8                             → 5 dated, 0 runs
WEIRD   (1/5)   SEP 24 – NOV 7 · Travail Haunted Basement Bar               → 0 dated, 1 run
```

**Every tag is now either inside the window or an honest span.** The Weird lane keeps its run
rather than going empty, and that run finally says it closes on the 7th.

### Mutation

| mutation | tests that failed |
|---|---|
| the sort back to start-ascending | 1 |
| `dayTag` back to the start day | 2 |
| `soonestFirstThenRuns` returns its input unchanged | **7 — on both sides**, 4 Instagram and 3 collections |

That last one is the proof the rule is genuinely shared rather than copied a third time — the
same check that proved `spansWindow` shared in S4.

---

## Quality gate

| | |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` | 3,193 passed in 152 files |
| `npm run build` | clean, 611 pages |
| `npm audit` | **0 vulnerabilities** |

**Read that test number carefully.** This checkout also holds *in-flight local-verify work that
is not part of this change* (`lib/verify.ts`, `lib/upsert.ts`, `scripts/verify-events.ts`, the
verify workflow YAML, four docs, and two test files). Those contribute **12** of the tests
above. This change adds **10**: the four files it touches go 78 → 88. Nothing from that other
work is in this commit.

---

## Deploy

```bash
git add lib/instagram.ts lib/list-view.ts lib/content/templates.ts lib/__tests__/instagram.test.ts lib/__tests__/list-view.test.ts docs/deploy-history/DEPLOY-IG-CARD-ORDER-LABEL.md
git commit -m "fix — a card for this week was dated May and sorted by what opened first"
git push
```

Verify on the admin page (sign-in required, not public):

1. `/admin/instagram` — **no row shows a date before today**; runs show a span like
   `SEP 24 – NOV 7`
2. Regular and Family lead with dated events, not exhibits
3. `/admin/instagram?window=weekend` — same, over the shorter window
4. A thin lane still shows its run and is still marked `only N of 5`

## Rollback

`git revert`. `soonestFirstThenRuns` is additive; `collectionCardRows` delegating to it is
behaviour-identical to the inlined copy it replaces. The two behaviour changes are the card
ordering and the run label, both reverting cleanly. No schema, no data.

---

## Left open — owner calls, not defects

- **The Regular card is now five Friday events.** Soonest-first means a busy Friday can fill a
  card captioned "your week". The old card hid this behind exhibits; it did not solve it.
  Spreading picks across the week's days is a real option and a bigger change — Taren's call,
  not mine to take quietly.
- **`timeLabel` on a run** prints the start time, or "All day". Honest for the Travail bar;
  worth a look if a run with a meaningful nightly time ever lands on a card.
- **The cousin shape is still unswept** — unchanged from S4. `lib/related.ts:29` is on every
  event page and disagrees with the venue page it links to; `lib/verify-flags.ts:62` can hide a
  reader report about a currently-running show. Neither is touched here.
