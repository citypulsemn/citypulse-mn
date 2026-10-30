# Scope — should the businesses sending us clicks get their own pages?

**29 Oct 2026.** Scoping only. Nothing built, nothing decided.

The question came out of C1: nine of the ten businesses sending us the most
ticket clicks have no `/venues/` page at all. The registry (`lib/venues.ts`, 47
entries) is pipeline config — the rooms the weekly sweep visits — so our pages
track **supply**, and the clicks are **demand**.

**Short answer: don't generate pages from click data. Run the GSC report first.**
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

## 3. The premise has never been tested

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
