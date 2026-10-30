# Deploy — the search report was measuring a slice, and two of its halves were broken

**30 Oct 2026.** Four commits. No schema change, no data change, no new secret,
no new dependency, no runtime change to any reader-facing page. Deploy is a push
that has already happened; the only manual step is re-running a workflow.

The task was one line of work — *run the GSC report and record the `/venues`
figure* — because `SCOPE-VENUE-PAGES-FOR-EARNERS.md` had pre-committed a decision
to that number: *"if those 47 pages earn nothing, this item is closed."* The
report could not be trusted to produce it. Three separate defects had to be fixed
before the figure meant anything, and each one would have produced a confident
wrong answer.

The answer itself is recorded in
[SCOPE-VENUE-PAGES-FOR-EARNERS.md §10](../SCOPE-VENUE-PAGES-FOR-EARNERS.md), not
here. This is the instrument.

## 1. `8a75413` — the section totals were a top-50 slice, not a measurement

`getSearchAnalyticsByDimension("page", …, 50)`. The impressions-by-section
summary then summed those 50 rows. Any section whose pages all rank below the cut
summed to **zero and read as "no demand"**.

The 10 Sep run is the proof. Its summary has four buckets — event, day pages,
collections, places — and **no row at all** for venues, cities, neighborhoods, or
even the home page. Those sections were not measured as zero; they were never in
the sample. The 20th page that run already needed 222 impressions to appear.

This mattered immediately: 48 venue URLs could never clear a cut dominated by 763
event and 586 places URLs, so the pre-committed rule was about to fire on an
artefact of a row limit.

- page `rowLimit` 50 → **2,000**, above the sitemap's 1,578 URLs. The run returned
  1,801 rows, under the cap, so the sums are complete.
- the header now states `complete — not a top-N slice`, or warns that the cap was
  hit and every sum below is a floor.
- each section reports **how many of its URLs earned ≥1 impression**, so
  "0 impr / 0 pages" (invisible) is distinguishable from "0 impr / 12 pages".
  ENGINEERING rule 6 at the instrument level.

**It also invalidates a recorded figure.** `scripts/gsc-report.ts` carried a
comment treating *"places … earn 180 impressions a month between them (0.9% of
the site) … 0.3 impressions per page"* as a finding. That was a floor from the
top-50 slice. The first complete measurement puts places at **3,325 impressions
(4.4%)**. Different window, and places grew — but the old number was never a
total and should not be quoted as one.

## 2. `0053533` — the indexation check had been dead for 39 days

Every one of the 16 URL Inspection calls returned `TimeoutError`, including the
same 12 URLs that had all succeeded on 10 Sep. Not Google, not the service
account: the analytics half of the same run returned 1,801 rows.

`9ee3014` (21 Sep) wrapped **every** Google call in `AbortSignal.timeout(6s)` to
stop `/admin/growth` answering 504. Right for a page render, too tight for URL
Inspection, which is the slower endpoint — and it landed **eleven days after the
last run of this report**, so the first run on the new ceiling was today. The
check was dead the whole time and nothing could have flagged it: the never-break
contract turned each failure into an honest `ERROR` row, and the only consumer is
a workflow run by hand.

The 504 fix stands. `inspectUrls` has **exactly one non-test caller** —
`scripts/gsc-report.ts`, manual, from Actions — and is never awaited in a page
render. `/admin/growth` and the Monday ops email reach Google only through the
analytics readers, which keep the 6s cap *and* their own outer deadlines
(`answeredWithin`, `GSC_BUDGET_MS`).

- `gscFetch` takes an optional per-call ceiling; only the inspect call passes one
  (**15s**).
- the `gsc-report` job goes **5 → 10 minutes**, because `inspectUrls` is serial
  and 16 × 15s = 240s does not fit in five.
- the budget tripwire is the useful one: it multiplies `INDEX_PATHS.length` by the
  ceiling and asserts it fits `timeout-minutes`, so adding a dozen URLs fails the
  suite instead of the job.

## 3. `ae5543b` — a failed read printed zeros as findings

This is the one to remember.

The re-run hit `[gsc] page report failed: TypeError: fetch failed`. The readers
return `[]` on failure by design — correct for the page and the ops email, which
need a number or an honest blank. A report that draws **conclusions** cannot live
with that ambiguity, and this one did not. With `pages = []` it printed:

```
## IMPRESSIONS BY SECTION (0 page(s) with >=1 impression, 28d, complete — not a top-N slice)
## /VENUES — EVERY RANKING ROW (0 of 48 URLs: index + 47 slugs)
  47 current venue slug(s) earned ZERO impressions in 28d:
```

…in the same format as a real result, and **exited 0**. Forty minutes earlier the
same query had returned 1,801 rows with `/venues/armory` the 4th-highest-impression
page on the site.

- `unreadable()` prints a `NOT MEASURED THIS RUN` block naming the dimension and
  saying exactly what `[]` cannot distinguish; **every derived block is guarded by
  it**.
- the run **exits 1** when either dimension came back empty, so a failed read is
  loud rather than looking like a site with no search traffic.
- the two 2,000-row reads are **serial** now, not `Promise.all`. Concurrency is
  the one thing that differed between the run that returned 1,801 rows and the run
  that failed.
- the branded-query block reports how many candidate names matched no query, and
  flags the row cap, because "no match" is unmeasured and not zero.

## 4. `753cbcd` — the two blocks the decision actually needed

Both were already fetched and thrown away by a print limit, which is defect 1
twice over.

- **`/VENUES — EVERY RANKING ROW`** prints all of them, separates the index page
  from the slug pages, flags any URL that is not a current slug (GSC reports
  retired URLs: 1,801 ranking against 1,578 in the sitemap, and `SLUG_OVERRIDES`
  exists because venue slugs have drifted), and **names** the slugs that earned
  zero. "13 of 48 at zero" had been a subtraction across two sets that are not the
  same set; it is a list now.
- **`VENUE-BRANDED QUERY DEMAND`** asks the Step B question directly. The query
  fetch was 25 rows printed 20, so *"Walker Art Center has no demand"* only ever
  meant *"not in the printed 20"*. Now 2,000. The match is a heuristic — first two
  significant words of the venue name — and the output says so, because it will
  miss nicknames and over-match generic names.

## Quality gate

- `npx tsc --noEmit` — clean
- `npm test` — **149 files, 2,928 tests** (2,921 → 2,928), green
- `npm run build` — clean
- `npm audit` — **0 vulnerabilities**
- Tripwires confirmed to **fail** against the broken code, not merely pass:
  the budget one with `expected 240000 to be less than 210000`, and the guard one
  with the venues guard deleted. The first version of that guard test passed with
  the guard removed — it asserted "some `if (` appears earlier" and found the
  preceding block's guard. It pins adjacency now.
- Empty-read path exercised locally with no credentials: prints both
  `NOT MEASURED` blocks, asserts no zero findings, **exits 1**.

## Deploy

Already pushed to `main`. Nothing auto-deploys from this — no page, route or
runtime path changed. Vercel will rebuild, which is a no-op for readers.

## Verify

Confirmed on run `41126148718`:

- section summary header reads `1801 page(s) with >=1 impression, 28d, complete`
- `/VENUES — EVERY RANKING ROW` lists 35 rows plus the 13 named zero slugs
- `VENUE-BRANDED QUERY DEMAND` lists 21 rooms and states that 28 of 49 candidate
  names matched nothing
- **`INDEXATION CHECK` — 16/16 answered, zero timeouts.** Every `/venues` URL
  `PASS / Submitted and indexed`.

To re-run: GitHub → Actions → **GSC Report** → Run workflow. Read-only, no send,
no writes. If it ever exits non-zero, the report says which dimension was unread —
do not record a figure from that run.

## Rollback

`git revert` each commit. The report goes back to summing 50 pages, the
indexation check goes back to timing out, and a failed read goes back to printing
zeros as findings. Nothing else in the app changes — none of this code runs
outside the manual workflow except the inspection ceiling, which no page calls.

## Left open

- **No query × page join exists.** `lib/search-console.ts:118` sends
  `dimensions: [dimension]`, one at a time, so no click can be attributed to a page
  *and* a query. Why `/venues/armory` accumulates 2,156 impressions at position 8
  is unexplained, and any mechanism story about it is speculation. Adding a second
  dimension is the next real upgrade to this report.
- **The branded block ran at the 2,000-row cap**, so those sums are floors.
- `places/museum/american-swedish-institute` is still
  `Discovered - currently not indexed`, and `places/disc-golf/acorn-park-disc-golf`
  is now `URL is unknown to Google` — it was `Discovered` in September. Unrelated
  to this item, but the instrument can see it again.
