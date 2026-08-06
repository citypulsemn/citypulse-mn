# Deploy UX9 — wayfinding & search polish

*August 2026. UX roadmap item 9. Two genuine correctness bugs at its heart — a
silent search dead-end and a vanishing index slice — plus a couple of small
"don't strand the visitor" cross-links. Scoped honestly: the two bugs are the
tested core; two feed/back-link sub-items are deferred with reasons (below).*

## What shipped

**1 — Cross-month search (no more silent dead-ends)**
([lib/dates.ts](../../lib/dates.ts) `matchesAfterWindow`,
[EventsExplorer.tsx](../../components/EventsExplorer.tsx))

Searching for an event that isn't in the *currently-viewed* window (you're on
August, the show is in September) used to render a flat **"No matches"** — even
though the event exists. Now, when the window is empty but the query/filters
match events further out, the count line offers a jump:

> No matches for "trampled by turtles" · **1 match in September →**

Clicking it moves the calendar to that month with the search still applied, so
the match is what you land on. `matchesAfterWindow` is pure (counts matches
whose start is after `win.end`, points at the earliest); the label adds the year
only when it differs from now.

**2 — Index counts now agree with detail pages (the vanishing-slice bug)**
([lib/dates.ts](../../lib/dates.ts) `isUpcoming`, applied to the six place
pages)

The neighborhood/city/venue **index** pages counted "upcoming" events with
`e.multiDayEnd ? … : start` — **`multiDayEnd`-only**. Their **detail** pages used
`daysSpanned()`, which derives a span from *both* `multiDayEnd` **and** a
genuinely-later `end` (rule 5). So a festival carrying its span in `end_at` (no
collapse `multiDayEnd`), still running on its **closing day**, counted **0** on
the index — the whole slice vanished — while the detail page still listed it.

Fix: one span-aware predicate, `isUpcoming(event, now)`, built on `daysSpanned`,
now used by **both** the three index counts and the three detail lists. They
agree by construction; the duplicated inline date math is gone.

**3 — Day pages step to their neighbours**
([lib/event-view.ts](../../lib/event-view.ts) `adjacentDayKeys`,
[day/[date]/page.tsx](../../app/day/[date]/page.tsx))

A `/day/…` page reached from search or a share was a dead-end. It now has
prev/next day links (`rel="prev"`/`"next"`, noon-UTC-anchored so DST never
shifts the date, crossing month/year/leap-day correctly).

**4 — Venue → city cross-link**
([venues/[slug]/page.tsx](../../app/venues/[slug]/page.tsx))

The venue header already linked its neighborhood; the city name is now a link to
its city page too (when one exists), via `matchCitySlug`.

## Deferred (with reasons, not silently dropped)

- **FeedSubscribe on `/ongoing` + city pages** — the feed namespace
  ([lib/feeds.ts](../../lib/feeds.ts)) is weekend/category/collection/venue/
  neighborhood only. There is **no city feed and no ongoing feed**, so adding
  the button would mean building a new **city feed kind** (spec, slug namespace,
  drift-guard updates, selection logic) — a feature in its own right, not
  wayfinding polish. Left for a dedicated item.
- **Event back-link "calendar context"** (event-detail #10) — in the explorer,
  events open as a **modal** (no navigation; context is inherently preserved).
  The standalone `/event/[id]` page is a share/Google landing with no prior
  calendar state to restore; it already offers TopBar nav + "See the full day".
  No change needed.
- **Neighborhood → venue sibling links** — the venue→neighborhood and (new)
  venue→city links cover the high-value direction; a "venues in this
  neighborhood" section is a larger listing feature, deferred.

## Verification (observed, not intended)

- **Tests +13 (867/867):** `matchesAfterWindow` (null when nothing ahead; counts
  + earliest-after; category-respecting); `isUpcoming` (the end-carried span
  counting on its closing day — the exact vanishing-slice case; multiDayEnd
  span; yesterday not upcoming; later-today upcoming; future; invalid start);
  `adjacentDayKeys` (±1, month/year/leap boundaries).
- **Browser (dev):** `/day/2026-08-15` renders prev = *Fri Aug 14* (`rel=prev`)
  and next = *Sun Aug 16* (`rel=next`), correct hrefs. First Avenue venue page
  renders the city link **Minneapolis → /cities/minneapolis** beside the
  neighborhood link. Homepage search empty-state renders cleanly ("No matches …
  · clear all"); an in-window query shows "2 events match". No console errors.
- **Gate:** `tsc` clean · 867/867 · `npm run build` clean · `npm audit` 0.

## Deploy steps

Push to `main`. Logic in `lib/` + six thin page edits + a little CSS. No schema,
no env, no new deps.

## Verify checklist

- [ ] Search a venue/act that only plays a later month → the count line offers
      "N match(es) in <Month> →"; clicking lands on that month with the search
      applied.
- [ ] A neighborhood/city/venue whose only live event is a multi-day festival on
      its closing day still appears on the index (count ≥ 1) and its detail page
      lists it — the two agree.
- [ ] A `/day/…` page shows working ← previous / next → day links.
- [ ] A venue page's city name links to the city page.

## Rollback

`git revert`. `isUpcoming`/`matchesAfterWindow`/`adjacentDayKeys` are additive
pure helpers; the page edits swap one predicate for the shared one and add links.
Nothing else depends on them.
