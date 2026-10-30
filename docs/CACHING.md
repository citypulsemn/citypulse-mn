# Caching — why the event, venue, city, neighborhood and day pages are not cached

**30 Oct 2026.** A decision record, not a how-to. Measured, declined, and
written down so the question does not get re-opened from scratch.

## The short version

Five routes declare `export const revalidate` and **none of them is cached**.
That was found while fixing the soft 404s and it looked like a bug worth fixing.
It was measured instead, and the answer is **leave them uncached**. The real
defect was the comments claiming otherwise, and those are corrected.

## What is actually true

| route | build marker | declares | actually |
|---|---|---|---|
| `/event/[id]` | ƒ dynamic | `revalidate = 3600` | renders fresh every request |
| `/venues/[slug]` | ƒ dynamic | `revalidate = 3600` | renders fresh every request |
| `/day/[date]` | ƒ dynamic | `revalidate = 1800` | renders fresh every request |
| `/cities/[slug]` | ƒ dynamic | `revalidate = 3600` | renders fresh every request |
| `/neighborhoods/[slug]` | ƒ dynamic | `revalidate = 3600` | renders fresh every request |

Three consecutive production GETs of the real `/venues/first-avenue` each
returned `Cache-Control: private, no-cache, no-store` with `X-Vercel-Cache: MISS`
and `Age: 0`.

**Why.** A dynamic-param route with **no** `generateStaticParams` never enters
Next's prerender manifest, so it builds as `ƒ` and the `revalidate` export has no
runtime effect. `/collections/[slug]` is the control sitting in this repo: it
carries `generateStaticParams() { return []; }`, builds `●`, and is the one
DB-backed page of the set that does cache.

## Why we are not turning it on

**1. At the declared TTLs it would change almost nothing.** The intuition that
caching must be cheaper is wrong here, and so was the first version of this
analysis. A crawl that finds a stale page pays one render; a crawl of an
uncached page pays one render. Same number. The only delta is the ISR write —
and Vercel does not bill a write when the regenerated output is unchanged. The
honest ceiling on that delta is well under a dollar a month.

**2. The traffic cannot support a cache.** `event_stats` is written by a
client-side beacon, so it counts people, not crawlers. Over 30 days:

| human views in 30 days | pages |
|---|---:|
| 1–4 | 1,043 |
| 5–29 | 181 |
| 30–239 (≥1/day) | 21 |
| ≥720 (≥1/hour) | **1** |

6,205 views across 1,246 pages. A cache pays for itself when a page is read more
than once before it expires. **One page out of 1,246 clears that bar at a
one-hour TTL** — the Restaurant Week listing, at 1,050 views. For everything
else the cached copy expires before a second person ever sees it.

**3. A TTL long enough to actually save renders is dishonest here.** The saving
only arrives at a TTL longer than the crawl interval — days, not hours. But
`/event/[id]` decides **on the server, from the clock**, whether to show the
"Buy tickets" and "Add to calendar" buttons (`components/EventDetailBody.tsx`
→ `isDeadEvent`), and nothing retires a finished event between Mondays:
`archivePastEvents()` has exactly one caller, `scripts/run-pipeline.ts`. Freeze
that render for days and the site offers tickets to a show that already
happened — on a Friday night, which is when it matters. That page is 763 of the
975 URLs, so it is where the money is and it is the one page that cannot be
frozen.

**4. The remaining four families are 212 URLs.** Too small a prize to justify a
new staleness surface in front of the takedown lever, on a site that has had two
reader-caught fabrication incidents. `scripts/hold-unverified-source.ts` and
`scripts/restore-drafted.ts` both change a listing's visible status with **no
cache bust at all** — harmless while nothing is cached, which is one more reason
not to start.

### The August rule does not apply, and that matters

`app/places/[kind]/[slug]/page.tsx` records the incident that produced the
house rule: *a TTL shorter than the crawl interval buys no freshness and costs a
full render every visit.* True — but places went from ISR to **fully static**,
where the baseline is **zero** renders. These five would go from **dynamic** to
ISR, where the baseline is **one render per request**. The rule's cost clause
only bites when a no-render alternative exists. It does not here. The first
draft of this analysis imported that verdict against the wrong baseline and
concluded ISR would be "strictly worse than today". It would not be; it would be
roughly the same, for a page nobody reads twice.

## What doing nothing costs

Stated plainly, because "no change" is still a decision with a bill:

- **CPU.** Every request to these 975 URLs, human or crawler, pays a render.
  The honest range is **~1.9 to ~8.4 Active CPU-hours a month** depending on how
  often crawlers walk the list — against a 4-hour allowance that was blown once
  in August. **Nobody has measured which end we are at.**
- **Latency.** Readers wait for a render on every view, and since 30 Oct there
  is no loading skeleton (see `DEPLOY-SOFT-404.md`). Felt on the 21 pages with
  daily traffic and the one with 1,050 views.

## The one thing that would reopen this

**Vercel dashboard → the `citypulse-mn` project → Observability → Routes, last
30 days.** Read requests-per-path for the five routes, and Usage → Active CPU
for the share they represent. Every cost number above rests on a modelled crawl
rate with a 4.4× spread, and on a per-render CPU figure derived as a ceiling
rather than measured.

If those five turn out to be a large slice of Active CPU, the answer is **not**
to cache the 212-URL tail. It is to move the two clock reads off the server on
`/event/[id]` — the "Happening now" banner and the button gating, both derived
from `start`/`end`/`multiDayEnd`, all three already in the HTML — and cache the
763 URLs with no honesty cost. One caveat for whoever does it: the
`MoreAtVenue` strip **cannot** simply move client-side, because `lib/related.ts`
filters the full event set by venue and only four siblings reach the page.

## What was fixed instead

Recon for this question turned up two live reader-facing bugs, both shipped
separately: the evening cutoff on `isUpcoming` and the false 404 on a database
blip. See [DEPLOY-CLOCK-AND-BLIP.md](deploy-history/DEPLOY-CLOCK-AND-BLIP.md).
