# Scope — should the businesses sending us clicks get their own pages?

**29 Oct 2026.** Scoping only. Nothing built, nothing decided.

> **ANSWERED 30 Oct 2026 — see [§10](#10-the-measurement-30-oct-2026). Step A was
> run. The 286-page build is closed. Step B is NOT supported either, for a reason
> the scoping did not anticipate: the demand it was meant to capture is already
> being captured, at 8.3% CTR, by pages that exist. Sections 1–9 are left as
> written; §10 says which of their numbers survived.**

The question came out of C1: nine of the ten businesses sending us the most
ticket clicks have no `/venues/` page at all. The registry (`lib/venues.ts`, 47
entries) is pipeline config — the rooms the weekly sweep visits — so our pages
track **supply**, and the clicks are **demand**.

**Short answer: don't generate pages from click data. Run the GSC report first.**
*(Run 30 Oct — see §10. The answer closed the build AND Step B.)*
It costs ten minutes and can kill the premise outright, because we have never
measured whether the 47 venue pages we already have earn any search traffic.

---

## 1. What the measurement says

Live, 30 days, 29 Oct. 328 businesses earned a view or click; 42 are registry
venues with a page, **286 have none**.

| clicks | views | published | upcoming | business |
|---:|---:|---:|---:|---|
| 565 | 1,046 | 1 | 0 | Metro-wide (multiple restaurants) — *not a venue* |
| 49 | 90 | 0 | 0 | Battle Creek Recreation Center |
| 47 | 208 | 3 | 0 | Ferguson's Orchard |
| 41 | 82 | 1 | 0 | Bar Meteor |
| 41 | 63 | 1 | 0 | Trail of Terror Grounds |
| 29 | 114 | 0 | 0 | Pryes Brewing Company |
| 28 | 137 | 5 | **5** | Chanhassen Dinner Theatres |
| 27 | 106 | 2 | 0 | Scream Town |
| 12 | 90 | 12 | **8** | Walker Art Center |

**Clicks measure the past; a venue page needs a future.** Six of those
businesses have *zero published events* — the events that earned the clicks have
since been archived. Build pages for the top earners today and you ship blank
pages with a name on them.

| Threshold | Candidates | …with zero upcoming |
|---|---:|---:|
| ≥ 30 clicks/30d | 5 | **5** |
| ≥ 20 clicks/30d | 12 | 11 |
| ≥ 10 clicks/30d | 18 | 15 |
| ≥ 5 **upcoming listings** | 19 | — |

The click leaders and the businesses with content are **different sets**. The
intersection is two: Walker Art Center and Chanhassen Dinner Theatres.

This is the same shape for the third time this month. Affiliate picked hosts over
demand; B1 picked listings over clicks; C1 picked the registry over businesses.
Each time the obvious axis was wrong, and here the obvious axis — clicks —
selects for seasons that have just ended.

## 2. Archived events do not rescue the seasonal case

The hope was that a page could honestly say what *ran* at Ferguson's Orchard, so
a seasonal page has content year-round. Three reasons it fails, in order.

**Four fabricated listings were in `status = 'archived'`, and all four were
serving live public pages.** The Toddler Music Lab rows from the 28 Oct
incident. The four future-dated ones were correctly set to `draft`; the four
already-past ones had been archived by the pipeline first and were never
re-statused:

```
archived  2026-10-07  Toddler Music Lab: Echo & Explore          /event/f26c87b2 → HTTP 200
archived  2026-10-14  Toddler Music Lab: Funky Soundscapes       /event/48ce7d6a → HTTP 200
archived  2026-10-17  Toddler Music Lab: Funky Soundscapes (ME…) /event/d2218ecc → HTTP 200
archived  2026-10-21  Toddler Music Lab: Splish Splash Water P…  /event/40b08145 → HTTP 200
```

**Taken down 30 Oct** — all four are `draft` now, and the pages render
"We couldn't find that". See the postscript in
[DEPLOY-VERIFY-YEAR-GATE.md](deploy-history/DEPLOY-VERIFY-YEAR-GATE.md). It does
not change the argument below: the archive held four fabrications for two days
with nothing flagging them, which is the point.

The archive carries **no trust flag**, and the verify stamp cannot serve as one —
six of those eight rows were stamped verified. A "what ran here" list would
assert on day one that four events happened, at the venue a reader already caught
us fabricating.

**`archived` does not mean "it happened."** It has at least five writers:
`archivePastEvents`, the dedupe and multi-day collapse appliers (the *losing*
copy), admin actions, and the corrections applier. So the archive mixes "this
ran" with "this was a duplicate we folded away".

**It doesn't fill the pages it was meant to fill.** Archive depth is real for
Walker (123) and Chanhassen (37) — the two businesses that already have published
events and need no rescuing. Bar Meteor and Trail of Terror have **one event each
in all of history**.

**The project already ruled on this**, 21 lines above the venue block in the same
file — `app/sitemap.ts:66-68`: *"upcoming (or still running) only — a city of
past events is an empty page, and empty pages don't belong in a sitemap."*
Overriding that is a doctrine change, not a feature side effect.

## 3. The premise has never been tested  — *tested 30 Oct, see §10*

`scripts/gsc-report.ts:29` already buckets every `/venues` path into its own
section. **No archived output anywhere in `docs/` reports that bucket's
impressions, clicks, CTR or position.** So "venue pages work, let's build more"
has never been checked, and the instrument is one workflow click.

The comparable bet went badly: `/places` was built specifically to rank and
ranks for close to nothing. If 47 hand-curated pages with real schedules and
editorial intros earn little, 286 thin ones cannot help.

## 4. What it would cost

**Supabase: approximately nothing.** `getEvents` is an `unstable_cache` shared
globally at a 1-hour TTL, so the database is read once an hour regardless of how
many pages render. That axis is closed, and Supabase is on Pro.

**Vercel is the entire bill, and it is the meter that has already broken.** The
26 Aug incident was Fluid Active CPU 4h16m against a 4h allowance: 2,198 sitemap
URLs at 30–60 minute TTLs, crawled about daily — 80,539 ISR writes and 38
function invocations per human page view, 61% of them regenerations.

The fix that saved 519 places pages — `revalidate = false` + `dynamicParams =
false` + build prerender — **is not available here.** It was explicitly scoped to
pages with "no database, no clock." Venue pages have both, and ENGINEERING rule 2
forbids prerendering DB-backed pages at build.

Stated as what it is — **URL-count inference, not measurement** (the incident doc
records "per-path data was never obtained"):

- +286 page URLs at a 1-hour TTL ≈ **+286 regenerations/day**, roughly +11% on
  the 2,685/day that caused the overage, re-adding over half of what freezing
  places saved.
- **+286 OG image routes.** `app/venues/[slug]/opengraph-image.tsx` rasterizes a
  1200×630 PNG per slug and sets **no cache window** — these were the first
  suspect during the CPU incident for exactly that reason.
- **+286 `.ics` feed URLs**, which crawlers and calendar pollers hammer.

**Not measured, and it changes the answer: the current Vercel plan.** The last
record is free/Hobby. On free tier the failure mode is a **project pause**, not a
bill.

## 5. If we do it, the selection rule

Clicks should decide **the order you look in**, never whether a page exists.
Three gates, all on fields that exist:

1. **Supply floor** — ≥ 8 distinct events over all time. Kills six of the nine
   named earners, correctly: a page for a business with one event in history is
   one row.
2. **Future test** — at least one published event with
   `coalesce(multi_day_end, end_at, start_at) >= now()`. This is the city rule at
   `app/sitemap.ts:68-70`, already running for ~110 city pages.
3. **Is it a building?** — a human reads the name. The existing gate cannot do
   this: verified by execution, `venueIsUnknown("Metro-wide (multiple
   restaurants)")` returns **false** and its slug is `metro-wide`. The 565-click
   top earner would become `/venues/metro-wide` with schema.org `Place` markup
   claiming a region is a venue.

## 6. Recommendation

**Step A — DONE 30 Oct, see §10. Kept as written; the verdict is in §10.**
**Step A — Monday, ten minutes, zero code.** GitHub → Actions → GSC Report → Run
workflow. Paste back the `/venues` bucket. If those 47 pages earn nothing, this
item is closed and we saved two sessions.

**Step B — only if A is positive. One short session, ~30 lines.** Promote the two
businesses that pass the rule into `lib/venues.ts`:

```ts
{ name: "Walker Art Center", city: "Minneapolis", category: "arts" },
{ name: "Chanhassen Dinner Theatres", city: "Chanhassen", category: "arts" },
```

Neither is in the registry today. Walker has 18 published and 123 archived across
its spellings; Chanhassen 11 and 37. They are the only click earners with
year-round supply.

Why it's nearly free: `VENUE_ANCHORED = ["music", "family", "weird"]`, so an
`arts` entry is **never swept** — no pipeline cost, and their events already
arrive via the category agents. They get a curated name, a hand-stable slug, the
alias table, an OG card, a feed, a sitemap entry and `MoreAtVenue` cross-linking
with no resolver change.

It pays one designed tripwire: `lib/__tests__/for-partners.test.ts` pins
`VENUE_PAGES.length` at 47 and the copy spelling "forty-seven venues". The test's
own comment says *"Update the sentence, not the expectation."*

Then measure those two keys for 30 days in the stats C1 already collects. That is
the whole hypothesis tested at 2 rows instead of 286, reversible by deleting two
lines.

## 7. What I would not do

- **Make `slugifyVenue` output a public URL.** `lib/upsert.ts:183` rewrites the
  venue string on every weekly re-find, there is no redirects table, and
  `SLUG_OVERRIDES` records that this project won't move a venue URL even for a
  real legal rename without shipping a redirect first. Worse: the 90-day signed
  venue-report links are HMACed over that same derived key, so a spelling drift
  silently serves an **empty report under a valid signature** to a venue holding
  the link. Every stable public URL in this repo — all 566 places, all 47 venues
  — is committed data, not derived row text.
- **Bulk-add to `lib/venues.ts`.** 286 free-text names trip the duplicate-name
  test, and a registry that holds everything has stopped being a registry.
- **Raise the TTL as the cost fix.** Next clamps a page's effective revalidate to
  the minimum of the page window and any `unstable_cache` TTL used while
  rendering, so moving the page constant alone changes nothing.

## 8. Separate from this item — done 30 Oct

The four fabricated archived rows are down. The takedown lever is **`draft`, not
`archived`** — archived keeps the event page rendering. Applied with
`npm run correct -- --from=corrections-toddler-archived.json --apply`, backed up
first, verified after.

It surfaced one thing worth its own item: **`/event/[id]` answers 200 for an
event that does not exist**, as do `/venues/[slug]`, `/collections/[slug]` and
`/day/<malformed>`. Fixed 30 Oct —
[DEPLOY-SOFT-404.md](deploy-history/DEPLOY-SOFT-404.md). The cause was a
`loading.tsx` in scope, not ISR as first written here.

## 9. Known-stale facts corrected while scoping

- `docs/VENUE-PAGES.md` said "the 42 slug pages… cached 5 minutes". It is **47
  pages at 3600s**. The cost arithmetic above would have been 12× wrong in the
  cheap direction read off that sentence.
- `lib/venue-report.ts` and the monetization roadmap said the registry holds
  "~48 rooms". It holds **47**.

---

## 10. The measurement (30 Oct 2026)

Step A was run — three times, because the first two runs were wrong in ways worth
recording. Final data: GSC run `41126148718`, 28 days to 30 Oct 2026,
`sc-domain:citypulsemn.com`.

### The headline

`/venues` earned **2,701 impressions and 5 clicks** in 28 days — 3.6% of site
impressions, 0.42% of site clicks, **0.185% CTR**. For scale, the site totals were
75,951 impressions and 1,196 clicks (1.57% CTR).

**But the sum was hiding the answer.** Per page:

| page | impr | clicks | pos |
|---|---:|---:|---:|
| `/venues/armory` | 2,156 | 4 | 8.1 |
| `/venues/minnesota-landscape-arboretum` | 185 | 0 | 8.9 |
| `/venues/can-can-wonderland` | 53 | **1** | 7.1 |
| `/venues/berlin` | 53 | 0 | 8.6 |
| 30 more ranking rows, all 29 impressions or fewer | | 0 | 7–11 |
| `/venues` (the index itself) | 5 | 0 | **45.8** |

- **One page is 79.8% of the bucket.** Every per-page average computed from the
  section total describes a page that does not exist.
- **Exactly 2 of the 35 ranking URLs earned a click in 28 days** — armory (4) and
  can-can-wonderland (1). The other 33 earned zero.
- **13 current slugs earned zero impressions:** icehouse, cedar-cultural-center,
  crooners-supper-club, parkway-theater, cabooze, lake-harriet-bandshell,
  orchestra-hall, hopkins-center-for-the-arts, paisley-park,
  minnesota-children-s-museum, bell-museum, hennepin-county-library,
  saint-paul-public-library.
- **First Avenue, the flagship room, got 2 impressions and 0 clicks** at position
  8.0. Indexed and crawled (last crawl 19 Jul), just invisible.
- Positions cluster at 7–11: page-one-bottom to page two.

### Section 3's premise, now tested — and Step B with it

The branded-query block measures whether a named room has search demand we are
not serving. **This is where the scoping was wrong.**

| room | impr | clicks | CTR | has a page? |
|---|---:|---:|---:|---|
| The Armory | 1,437 | 4 | **0.3%** | yes |
| **Chanhassen Dinner Theatres** | **569** | **47** | **8.3%** | **no** |
| Walker Art Center | **1** | 1 | — | no |

Those three rows answer Step B on their own:

1. **Walker is now measured, not bounded.** Section 6 proposed promoting it. It
   has **one** branded impression in 28 days. The earlier "does not appear" was an
   artefact of a print limit — 25 queries fetched, 20 printed. The fetch is 2,000
   now. Walker's half of Step B is dead.
2. **Chanhassen's demand is real and we already capture it.** 47 clicks at 8.3%,
   position 1.0, with **no venue page** — those clicks land on event pages. The
   surface that already exists is winning the query.
3. **The one venue page we own for a comparable branded room converts that same
   kind of demand at 0.3%, from position 8.1.** So a new
   `/venues/chanhassen-dinner-theatres` is at least as likely to **intercept** a
   position-1 event page as to add anything.

**Step B is therefore not supported by this data.** If it is still wanted it has
to be argued as a partner and supply decision — which is what
`ROADMAP-MONETIZATION.md` C2 already says it is — not as search upside. It also
costs more than the "two rows" section 6 claimed: four pinned values, not two.
`lib/__tests__/for-partners.test.ts:29` and `:31` (allFeedSlugs 79 goes to 81),
plus the spelled-out "forty-seven venues" and "Seventy-nine in all" in
`lib/editorial.ts:177`.

### Where the 47 pages DO earn — the axis nobody measured

Resolving "earn nothing" against Google alone was an error. Two first-party
instruments already bucket venue-page output and neither had ever been queried.
`app/venues/[slug]/page.tsx:194` passes `source="venue"` to `FeedSubscribe`, and
line 201 passes `source="venue-page"` to `SubscribeBand`:

- **Subscribers: 6 of 48 came from venue pages** — 5 `venue-page` plus 1
  `venue-lake-harriet-bandshell`. That is **12.5% of the entire list**, second
  only to event pages (22). Per URL: 0.125 across 48 venue URLs against 0.029
  across 763 event URLs — **4.3x better per page.**
- **Feed subscribes: `venue` is the single largest source** — 6 all-time, ahead of
  weekend (5), neighborhood (3) and collection (2). One in the last 30 days.

Subscriber conversion is what the roadmap calls the flagship; search clicks are
not. So **"the venue pages earn nothing" is false** — on the axis that matters
most they are the best-converting page type per URL on the site.

That does **not** rescue the 286-page build, and it matters to say why rather than
letting the number argue for itself. Conversion needs traffic, and these pages get
theirs overwhelmingly from *internal* navigation — `MoreAtVenue` on event pages —
not from search; the search figures above are the proof. The 286 candidates are
businesses that mostly **fail the section 5 supply floor** (6 of the 9 named
earners have fewer than 8 events all-time), so they would have no listings to be
cross-linked from and no search demand either. They get neither traffic source.
n=6 is also a very small sample, and source attribution here is single-touch.

### The subtraction question, which nobody asked

All 47 slugs go into the sitemap unconditionally at priority **0.7**
(`app/sitemap.ts:83-88`) — no supply test, no future-event test. The city block
twenty lines above *does* have one, and section 2 of this doc quotes that very
rule ("a page of past events is an empty page") as an argument against new venue
pages. The 13 zero-impression slugs are being advertised daily at the highest
priority in that block. **A supply/future filter there is a 3-line change and
points the opposite way from building more.** Not built; flagged as the cheapest
live item this measurement turned up.

### Verdict

1. **The 286-page build is closed** — on the measurement, not on a mechanism.
   Reopenable only by per-query data for venue pages, which this run does not have.
2. **Step B is not supported.** Walker measured at 1 impression; Chanhassen's
   demand is already converting at 8.3% through pages that exist.
3. **Venue pages are not worthless** — they are the site's best per-URL subscriber
   source. Protect the 34 that have traffic; do not clone them.
4. **Cheapest live follow-up:** the sitemap supply filter above.

### What is still unmeasured, and would change the above

- **Per-query data for any venue page.** `lib/search-console.ts:118` sends
  `dimensions: [dimension]`, one at a time, so no click can be attributed to a page
  *and* a query. Why armory accumulates 2,156 impressions at position 8 is
  unexplained, and any mechanism story about it is speculation.
- **Seasonality.** This window ends 30 Oct on an events site: Scream Town, Trail
  of Terror, Baker Boo and haunted trails dominate the query table. The robust
  figure is the **absolute 5 clicks**; the percentage shares are measured against a
  Halloween-inflated denominator, and one 28-day window cannot establish a
  structural result.
- **Floors, not totals, in two places.** The branded-query block ran **at the
  2,000-row cap**, so those sums are floors; and the heuristic matches only the
  first two words of a venue name, so **28 of 49 candidate names matched no query
  at all** — unmeasured, not zero.
- **Per-path Vercel request volume, and the current plan.** Never obtained, for
  August either. This is the only axis on which the answer could move *against*
  the 47 pages that already exist.

### Corrections to earlier sections

- **Section 3, "the premise has never been tested"** — tested now; see above.
- **Section 6, Step A** said "if those 47 pages earn nothing, this item is closed."
  Report it precisely: they did not earn *nothing* (2,701 impressions, 5 clicks,
  and one of them is the site's 4th-highest-impression page), so the rule does not
  fire on its literal wording. It fires on its substance: 1 click across the 33
  pages that are not armory.
- **Section 6, Step B** is withdrawn as a search play; see above.
- **Section 4's cost case is weaker than it reads.** +286 URLs takes the sitemap to
  1,864, still **334 below the 2,198** that caused the August overage, and section
  4 labels its own "+286 regenerations/day" as "URL-count inference, not
  measurement". The build is closed on the demand side, not this one.
- **"13 of 48 at zero" is now a list, not a subtraction.** The earlier arithmetic
  crossed two different sets — 1,801 ranking URLs against 1,578 in the sitemap,
  because GSC also reports retired URLs. The report now prints every row and flags
  any that is not a current slug. None was.

### Three instrument defects found while answering this

All three shipped today, because the answer could not be trusted without them.

| commit | what was wrong |
|---|---|
| `8a75413` | the section summary summed only the **top 50 pages**, so `/venues` had never been in the sample at all. The 10 Sep run has no venues row, and its "places earn 180 impressions a month (0.9% of the site)" is a floor from that same slice, not a total. Row limit is now 2,000, above the whole sitemap. |
| `0053533` | the **indexation check had been dead for 39 days**. `9ee3014` (21 Sep) put a 6s timeout on every Google call to stop `/admin/growth` returning 504; URL Inspection needs longer, and all 16 calls timed out. Inspection now gets 15s — it has one non-test caller and never runs inside a page render — and the job gets 10 minutes. Verified: 16/16 pass. |
| `ae5543b` | **a failed read printed zeros as findings.** The second run hit `TypeError: fetch failed`, and the report then stated "47 current venue slug(s) earned ZERO impressions" and "complete — not a top-N slice" on an empty set, and exited 0. An unread dimension is now reported as unread, and the run exits 1. |

The third is the one to remember: it came within a step of being recorded here as
the answer that closed the item.
