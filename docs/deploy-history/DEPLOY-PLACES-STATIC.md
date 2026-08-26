# Deploy — 519 pages stop rebuilding themselves hourly (26 Aug 2026)

## Why

Vercel warned that the free tier's **Fluid Active CPU** was at 100%. It was
actually past it: **4h 16m against a 4h allowance**, and projects that exceed the
free tier get paused.

Every other meter on the account was comfortable — invocations 13% of quota,
memory 8%, bandwidth 2%, builds 2h of 100h. CPU was the only thing over.

## What the usage report actually said

| 30 days (Jul 27 – Aug 26) | |
|---|---|
| Human page views (Web Analytics) | **3,464** |
| Function invocations | **131,218** |
| ...of which ISR writes (regenerations) | **80,539** |
| Edge requests | 182,266 |
| Fluid Active CPU | **4h 16m / 4h** |

**38 function invocations for every human page view. 61% of them were page
regenerations.**

The site was not being read to death; it was rebuilding pages nobody had asked
for. 2,198 URLs in the sitemap, TTLs of 30–60 minutes, crawlers walking the long
tail about once a day. **A 1-hour TTL guarantees that every daily crawl finds the
page stale and pays for a full re-render.** 2,685 regenerations a day against
~115 human views.

## The false start, recorded because it cost an hour

The first suspect was the eight `opengraph-image` routes — each rasterizes a
1200×630 PNG through satori and resvg, and not one set a cache window. The fix
was written, tested, and then measured against a real production server before
being claimed:

```
without the fix:  818ms, 335ms, 331ms   cache-control: immutable, max-age=31536000
with the fix:     836ms, 354ms, 331ms   cache-control: immutable, max-age=31536000
```

Identical. Next.js already marks those responses immutable for a year, so
Vercel's CDN was caching them all along. The change was deleted rather than
shipped as an inert fix with a test enshrining it.

**A TTL bump was the second false start** — raising 1h to 12h saves almost
nothing, because a page crawled twice a day still finds it expired both times.
To cut regenerations the TTL has to be much *longer* than the crawl interval.
Which points at the real answer: some of these pages should never expire at all.

## What shipped

`/places/[kind]/[slug]` — **519 pages** — and `/places/discover` now set
`revalidate = false`. The detail route also sets `dynamicParams = false`.

These render from `lib/places.ts` and nothing else. No database, no clock. Their
output cannot change until someone edits the registry, and editing the registry
requires a deploy, which rebuilds them anyway.

The detail page had carried `revalidate = 3600` with a comment claiming it kept
"the open/closed season note fresh". **There is no season note on that page** —
no `openNow`, no banner, no date in the body at all. The comment described
something that was never there, and 519 pages re-rendered hourly to produce
byte-identical HTML because of it. `discover` carried the same wrong comment.

`dynamicParams = false` means a slug outside the registry is a static 404 at the
CDN instead of a function invocation that renders `notFound()`. The registry is
complete at build time, so nothing legitimate is lost.

Route table before and after:

```
before:  ● /places/[kind]/[slug]   1h  1y      ○ /places/discover   1h  1y
after:   ● /places/[kind]/[slug]                ○ /places/discover
```

## Why this is safe — the part worth checking

Seasonal correctness never came from the server. The "open this season" filter
lives in `PlacesDiscover` and `PlacesBrowser`, both `"use client"`, both doing
`useState(() => new Date())` and passing that to `filterPlaces` → `openNow`.

It runs against **the reader's own clock**, which is more correct than a server
render frozen at revalidate time would have been.

Verified in a browser rather than argued from the source: toggling "Open this
season" took the page from 1,044 place links to 938 — winter kinds correctly
hidden in August — and restored on toggle off.

That is the whole safety argument, so there is a drift guard asserting those two
components stay client-side. If the filter ever moves to the server, these frozen
pages would tell a family a splash pad is open after it closed for the season.

## What was deliberately left alone

`/places` and `/places/[kind]` keep `revalidate = 3600`. They **are**
date-dependent: `kindsWithPlaces` sets an `open` flag per kind, and
`placesSeasonBanner` puts "Closed for the season" on a kind page. That is 19
URLs against 519 — about 4% of the block, and not worth trading honesty for.

## Verify

```bash
npm run build
```

`/places/[kind]/[slug]` and `/places/discover` show a blank Revalidate column;
`/places` and `/places/[kind]` still show `1h`.

Then load a place page, `/places/discover`, and a nonsense slug like
`/places/beach/no-such-thing` (must 404). Toggle "Open this season" on discover
and watch the count change.

After a week, the number to watch is **ISR writes** in Vercel usage. It should
fall by roughly the share these URLs represent — 519 of 2,198.

## Rollback

Two constants in `app/places/[kind]/[slug]/page.tsx` (`revalidate`,
`dynamicParams`) and one in `app/places/discover/page.tsx`. Setting them back to
`3600` restores the old behaviour exactly. No data, no schema, no secrets.

## Quality gate

`npx tsc --noEmit` clean · **1454/1454** tests (+6) · `npm run build` exit 0 ·
`npm audit` 0 vulnerabilities · all four places routes plus a 404 case loaded
from a real production server, and the season filter exercised in the browser.

## Not done — and this is the bigger half

**519 of 2,198 URLs.** The ~1,300 event pages are the larger block and they
cannot take this treatment: a cancellation lands there, and the verify pass
cancels events from a *script*, which cannot bust Next's cache. Raising their TTL
would trade directly against the trust work.

The right fix is an on-demand revalidation endpoint that the pipeline and verify
scripts call, so freshness comes from cache-busting rather than a short TTL —
then event pages can safely sit at days. That needs a new secret in both Vercel
and GitHub Actions, so it is its own session.

**Per-path data was never obtained.** Vercel moved top-paths into Observability
inside each project. The share attributed to places here is inferred from URL
counts, not measured. If the ISR write count does not move by roughly a quarter
next week, that inference was wrong and Observability is where to look.
