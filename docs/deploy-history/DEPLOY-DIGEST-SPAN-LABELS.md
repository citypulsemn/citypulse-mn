# Deploy — the weekly email could print a run's May start date under "happening this week"

**Date:** 6 November 2026 · **Found by:** the review of [DEPLOY-IG-CARD-ORDER-LABEL.md](DEPLOY-IG-CARD-ORDER-LABEL.md)
**Files:** `lib/digest.ts`, `lib/digest-personal.ts`, `lib/digest-send.ts`,
`app/admin/digest/page.tsx`, and their tests
**Schema:** none. **Data:** none. Code only.

The third surface this week with the same defect, and the first one that reaches readers by
email rather than a page they chose to open.

---

## Read this first: it was NOT firing

Measured on live data before anything changed, 6 November 2026:

| | |
|---|---|
| subscribers | **48** |
| distinct `saver_token`s | **3** |
| of those, whose email shows the saved block today | **0** |
| saved rows those 3 tokens hold | 7, of which **0 are still published** |
| `getMostSavedCounts(7)` rows | **1**, against a floor of 3 — the block renders nothing |

`npm run digest -- --dry-run` agrees: *"48 emails, 0 personalized"*.

**So no subscriber has received a wrong date from this.** What follows fixes a live mechanism
with zero current occurrences — which is the honest framing, and the one the review's own
refutation insisted on ("a live mechanism with a reachable branch, not a measured occurrence
in a sent email").

It is still worth fixing, because the shape that admits it is ordinary reader behaviour:

- **22 of 571 published rows are runs underway right now.** Saving any one of them is enough.
- **5 of the 7 saves on record are runs.** Readers save exactly the rows that trigger this.

That is the lesson this project already wrote down as *measure the inputs whose shape admits
it, not today's collisions*. Today's collisions are 0.

---

## What was wrong

### 1. `whenLabel` read the row's own start, always

```ts
const d = evDate(e);
return `${DOW[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()} · ${timeLabel(e)}`;
```

`whenLabel` has five call sites, and they do **not** map one-to-one onto the email's blocks.
The first draft of this paragraph said "three of five are safe by construction"; that is
backwards, and the shared one is the one that matters most:

| call site | serves | safe by construction? |
|---|---|---|
| `eventRowHtml` | **all four HTML blocks** — picks, saved, later, most-saved | **no** — it is shared, so the reader-facing HTML always went through it |
| `mostSavedText` | "Most saved this week", plain text | **no** |
| the saved text block | "You saved these — happening this week" | **no** |
| the picks text block | "Also worth your time" | yes |
| the later text block | "This weekend" / "Next week" | yes |

Only the two plain-text picks blocks are safe, because the general picks come from
`weeklyPicks`, which filters `start >= nowWall` — those rows always start inside the window.
Everything else can carry a row that began earlier, because two blocks deliberately admit one:

- **"You saved these — happening this week"** — `selectSavedUpcoming` keeps a run still in
  progress, on purpose: the reader can still go.
- **"Most saved this week"** — no date filter at all (below).

For those, a saved run that opened in May rendered as **"Saturday, May 23 · 10 AM"** under a
heading that says *happening this week*. Both halves are wrong, and the clock half is the exact
lie `lib/day-order.ts` `dayTimeLabel` was written to stop on day pages.

### 2. The saved block was ordered by start, then capped at 5

Every row admitted by the run branch started before the window **by construction**, so a run
always sorted ahead of everything happening in the week. It led the block, and at the cap of 5
it could evict a concert the reader could still catch. The test suite **pinned this**:
`expect(...).toEqual(["run", "today1pm"])` — the run that opened 1 July ahead of the 1 PM
event happening today.

### 3. `selectMostSaved` dropped archived events but never past ones

Its docstring claimed *"a saved-then-archived or past event is silently dropped, never featured
stale"*. Only the first half was true:

- **archived** — `byId` is built from the published set, so the row is absent and falls out.
- **past** — nothing dropped it. `getMostSavedCounts` windows on the **save day**, not the
  event date, and `byId` carries every published row with no date predicate. A run that
  finished last month could be featured under "Most saved this week".

---

## What shipped

```ts
// 1. a row that BEGAN BEFORE TODAY states its span; one starting today or
//    later keeps its weekday and start time
if (isMultiDay(e) && e.start.slice(0, 10) < todayKey) return multiDayLabel(e);

// 2. the same helper the two card surfaces adopted this week
return soonestFirstThenRuns(rows, fromWall.slice(0, 10)).slice(0, PERSONAL_MAX_SAVED);

// 3. the docstring's promise, finally kept
.filter((e) => !isEnded(e, now))
```

### The first cut of this got the label wrong, and a review caught it

The span branch was originally **unconditional**. Because `eventRowHtml` is the one row
renderer for all four HTML blocks, that applied it to the general picks too — so a festival
opening this Friday would have lost `"Friday, November 7 · 7 PM"` and read `"Nov 7 – 9"` on the
main body of the email, which was never the defect. It contradicted the project's own rule,
stated in `lib/day-order.ts`:

> *"starts today → its actual start time, **EVEN IF it runs on for days**. A play opening
> tonight at 8 PM should say 8 PM."*

The review also found the trigger is wider than curated runs: `isMultiDay` delegates to
`spanEndISO`, which reads an `end_at` landing on a **later day** as a span — so an ordinary
single-night show with a sloppy `end_at` (a 9 PM show stamped 7 AM) would have lost its doors
time too. Against this project's known *"end_at stuffed with the run end"* shape, that is not a
rare row.

Gating the branch on `e.start.slice(0, 10) < todayKey` fixes exactly the defect and nothing
else. Two tests pin it; mutating the gate away fails both.

### Both new parameters are required, not defaulted

`now` on `selectMostSaved` and `now` on `DigestOptions` are **required**. A caller that forgets
`now` on `selectMostSaved` is exactly how the past-event drop went missing; a caller that
forgets it on `DigestOptions` would render every date label against the real clock, which makes
tests drift as time passes. `tsc` enumerated all of them — including
`app/admin/digest/page.tsx`, a second production caller the first pass had not noticed.

**Runs are not excluded anywhere.** They follow dated events and still lead when nothing is
dated — rule 6, same as the card surfaces.

---

## Verification

### Rendered against live data (no send)

```
YOU SAVED THESE — HAPPENING THIS WEEK

Character Appearance: Kai-Lan
  Friday, November 6 · 4 PM
Insider Science Tours: Paleontology
  Friday, November 6 · 4 PM
Beach Monster Exhibit
  May 23 – Jan 10          <- was "Saturday, May 23 · 10 AM", and led the block
```

### Mutation

| mutation | tests that failed |
|---|---|
| `whenLabel` back to the start day | 1 |
| the saved block back to start-ascending | **3**, including the one that used to pin the bug |
| the span branch back to unconditional | **2** — the regression the review caught |
| `selectMostSaved` without the ended filter | 1 |

### Quality gate

| | |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` | 3,249 passed in 154 files |
| `npm run build` | clean, 611 pages |
| `npm audit` | **0 vulnerabilities** |
| `npm run digest -- --dry-run` | 48 emails, 0 personalized, **0 sent** |

That test total again includes in-flight work from another session sharing this checkout
(`lib/cli-flags.ts`, `lib/research-queue.ts`, pipeline and workflow changes). **None of it is in
this commit** — this one touches five files.

---

## Deploy

```bash
git add lib/digest.ts lib/digest-personal.ts lib/digest-send.ts "app/admin/digest/page.tsx" lib/__tests__/digest.test.ts lib/__tests__/digest-personal.test.ts lib/__tests__/digest-split.test.ts docs/deploy-history/DEPLOY-DIGEST-SPAN-LABELS.md
git commit -m "fix — the weekly email could date a run by the day it opened"
git push
```

Nothing is observable on the website. The next verification is **the Thursday send**: a
`--dry-run` beforehand should report the same recipient count, and any saved block should show
dated events first with runs stating a span.

## Rollback

`git revert`. All three changes are local to the digest modules; `soonestFirstThenRuns` was
already shipped and is untouched here. No schema, no data, no send-path behaviour beyond the
label, the order and the extra drop.

---

## Left open

- **The span label is yearless.** `"May 23 – Jan 10"` is ambiguous about which January on a
  weekly email, exactly as it is on the two share cards. Same shared helper, same five
  surfaces, same owner call recorded in the Instagram guide — it is all five or none.
- **An all-day row with NO end would be dropped from the saved block on the day it happens.**
  It is stored at midnight, so it fails `start >= fromWall` from 00:01, and the run branch
  cannot rescue it because it has no end to test. This is the same all-day shape the R1.2
  collections floor needed an arm for this morning. **Deliberately not fixed here:** measured
  at **0 of 571** — all 16 live all-day rows carry an end, and the run branch already rescues
  those. The filter it would touch is load-bearing for the R1.4 send-morning boundary, so it
  is not worth disturbing inside a live-email change for zero exposure.
- **Two confirmed findings from the same review are still untouched:**
  `lib/content/templates.ts:141` (`collectionCaptionFor` prints out-of-window start dates — the
  caption beside the share card) and `components/MapEventList.tsx:24` (the map list opens on
  months-old runs). Both reader-facing, neither in this commit.
