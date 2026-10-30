# Deploy — we were advertising empty venue pages, and telling Google cities were over at 3 PM

**30 Oct 2026.** One new pure function, two call sites, twelve golden tests. No
schema change, no data change, no new secret, no new dependency. Deploy is a push.

Two things ship together because they are the same defect in the same file: the
sitemap was describing supply it did not have.

## 1. All 47 venue slugs went into the sitemap unconditionally

`app/sitemap.ts` listed every registry venue at **priority 0.7** — a *higher*
priority than the city pages twenty lines above, which have had a supply test
since 6.2 under the comment *"empty pages are spam, not SEO."* The venue block
simply never got one.

This was found by the first GSC read of the `/venues` bucket
([SCOPE-VENUE-PAGES-FOR-EARNERS.md §10](../SCOPE-VENUE-PAGES-FOR-EARNERS.md)),
which showed 13 venue URLs earning zero impressions while being advertised daily
at the site's highest page priority.

**Measured effect, against the live database today: 47 → 33 URLs, 14 dropped.**

```
fillmore-minneapolis   uptown-theater      icehouse        berlin
331-club               crooners-supper-club cabooze        mystic-lake-amphitheater
surly-brewing-festival-field                lake-harriet-bandshell
hopkins-center-for-the-arts                 paisley-park
bauhaus-brew-labs      sever-s
```

**Read that list carefully — it is not the GSC zero-impression list, and the
difference is the point.** This is a *supply* test ("is there anything on this
page right now"), not a *performance* test ("does anyone find it"). So:

- `bell-museum` earned **zero** GSC impressions but has **28** upcoming events,
  so it stays.
- `berlin` earned **53** impressions but has nothing upcoming, so it goes — for
  now.
- Several of the 14 are seasonal and outdoor — Lake Harriet Bandshell, Surly
  Festival Field, Bauhaus, Sever's. It is 30 October. **They come back in May by
  themselves**, because the filter recomputes hourly with the rest of the file.

**Nothing is orphaned.** The pages still render, still resolve, and are still
linked from `/venues` under "Also tracked" (`app/venues/page.tsx:68-80`, real
`<a href>` links). We stop *advertising* an empty page; we do not hide it. That
is ENGINEERING rule 6 applied to what we tell a crawler.

## 2. The city block was dropping cities five hours early — and from the start time

Fixing one meant reading the other, and the city predicate turned out to be worse
than the missing one. It read:

```ts
const start = new Date(e.start).getTime();
const end = e.multiDayEnd ? new Date(e.multiDayEnd).getTime() : start;
return !Number.isNaN(start) && Math.max(start, end) >= Date.now();
```

Two defects in three lines.

**(1) ENGINEERING rule 10.** `e.start` is a naive Chicago wall string. `new Date`
parses it in the *server's* zone, which on Vercel is UTC, and compares it to a
real instant. This is the identical bug fixed in `lib/dates.ts` `isUpcoming`
earlier the same day (`9258f0a`), where it was hiding tonight's shows from
`/venues` and `/cities` from 7 PM.

**(2) It compared the START, not the end of the run.** With no `multiDayEnd`,
`end` collapses to `start`, so a single-day event stopped counting the moment its
(already zone-shifted) start passed.

Together, measured under `TZ=UTC` against an 8 PM Chicago show:

```
server TZ: UTC
event: an 8 PM show in Chicago on Thu 6 Aug 2026

  Chicago wall       UTC instant              OLD city rule   isUpcoming
  Thu 17:00          2026-08-06T22:00:00Z     false           true
  Thu 19:30          2026-08-07T00:30:00Z     false           true
  Thu 21:00          2026-08-07T02:00:00Z     false           true
  Thu 23:30          2026-08-07T04:30:00Z     false           true
  Fri 00:30          2026-08-07T05:30:00Z     false           false
```

The old rule flipped false at **3 PM Chicago** — five hours before doors. So a
city whose only remaining event was that evening dropped out of the sitemap every
afternoon, and came back the next morning. It also read only `multiDayEnd`, so a
city whose one live event sat on the **closing day of an `end`-carried span** fell
out too — which is word for word the divergence `isUpcoming`'s own docstring was
written about.

Both are fixed by deleting the copy and calling the shared predicate.

## The shape of the fix

The logic already existed. `app/venues/page.tsx` has always computed exactly this
to decide which rooms are `active` and which are `quiet`. Rather than write a
second copy for the sitemap — which is how the index and the detail page drifted
apart in the first place — it moved to `lib/`:

```ts
export function upcomingCountsByVenue(events: EventRecord[], now: Date): Map<string, number>
export function venuePagesWithUpcoming(events: EventRecord[], now: Date): VenuePage[]
```

Both call sites now share one definition, so **the index cannot call a room quiet
while the sitemap advertises it.**

One subtlety worth recording: the sitemap passes a **real instant**, deliberately
not its `today`. `today` is the Chicago day key re-parsed — midnight UTC, which
reads as 7 PM Chicago the *previous* day and would have kept yesterday's events
alive. The day-granular value is for `lastModified` only.

## What shipped

| file | change |
|---|---|
| [lib/venue-pages.ts](../../lib/venue-pages.ts) | `upcomingCountsByVenue` + `venuePagesWithUpcoming`, the one definition |
| [app/sitemap.ts](../../app/sitemap.ts) | venue block gets the supply test; city block calls `isUpcoming` instead of its own copy; a real `now` |
| [app/venues/page.tsx](../../app/venues/page.tsx) | uses the shared counter; its inline copy deleted |
| `lib/__tests__/venue-pages.test.ts` | +12 golden tests |

## Quality gate

- `npx tsc --noEmit` — clean
- `npm test` — **149 files, 2,940 tests** (2,928 → 2,940), green under the local
  zone **and** under `TZ=UTC`
- `npm run build` — clean
- `npm audit` — **0 vulnerabilities**
- Effect measured against the live database before shipping: 47 → 33, with the
  dropped list read and sanity-checked room by room
- The old city predicate was executed side by side with the new one under
  `TZ=UTC` to produce the table above, rather than reasoned about

The golden tests cover the boundary on purpose, stated in explicit UTC instants
so the block means the same thing on any machine: a show still counts an hour
*after* doors; the day rolls over at midnight **Chicago**, not midnight UTC; a run
counts on its closing day from either `multiDayEnd` or `end`; a draft, archived or
cancelled event never counts; an unparseable start is dropped. Plus the
honest-emptiness case that this whole change exists for — **no events at all must
yield no venue URLs, never a fallback to the whole registry.**

## Deploy

1. Push to `main`. Vercel auto-deploys.
2. Nothing else. The sitemap recomputes hourly (`revalidate = 3600`).

## Verify

After the deploy, the sitemap should carry roughly 33 venue URLs rather than 47,
and the ones with events should all still be there:

```bash
curl -s https://www.citypulsemn.com/sitemap.xml | grep -c "/venues/"
```

Spot-check that a busy room is listed and a quiet one is not, and that the quiet
one still serves 200 and is still linked from the index:

```bash
curl -s https://www.citypulsemn.com/sitemap.xml | grep -E "/venues/(first-avenue|paisley-park)<"
```

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://www.citypulsemn.com/venues/paisley-park
```

That last one must be **200**, not 404 — the page is unadvertised, not withdrawn.

## Rollback

`git revert` and push. The sitemap goes back to listing all 47 venue slugs at
priority 0.7, and the city block goes back to dropping cities at 3 PM. The pure
functions are additive; nothing else calls them.

## Left open

- **`NEIGHBORHOODS` (17) and `COLLECTIONS` (9) are still listed
  unconditionally.** Neighborhoods is the same shape as the venue block was, and
  the same GSC run measured it at 62 impressions and **0 clicks** across 13
  ranking pages. Collections earns 425 impressions and 6 clicks, and is editorial
  rather than event-derived, so the supply test may not even be the right question
  there. Not touched — neither was asked for, and collections in particular needs
  a decision before a filter.
- **No before/after crawl data yet.** The claim that advertising empty pages costs
  anything is a thin-content argument, not a measured one. What *is* measured is
  that we were doing it at the site's highest page priority while the cities block
  twenty lines up refused to.
