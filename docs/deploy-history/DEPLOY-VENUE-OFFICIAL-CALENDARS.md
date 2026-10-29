# Deploy — one third of C2, and why the other two thirds are your call

**29 Oct 2026.** The first slice of C2 from
[ROADMAP-MONETIZATION.md](../ROADMAP-MONETIZATION.md). Two files changed, seven
tests. No schema change, no data change, no new secret, no new dependency.
Deploy is a push.

**This is not C2.** C2 is "logo, photos, links". This ships **links** and
nothing else, because links needed no decision from you and the other two do.
The decisions are at the bottom of this guide.

## What shipped

A line on a venue page pointing at the room's own schedule.

> Schedule straight from the venue: **Official calendar ↗**

and where a page covers more than one room:

> Each room posts its own schedule: **7th St Entry ↗** · **First Avenue ↗**

It sits between the map and the event count, so it never pushes the schedule
down. On the 33 pages with no curated calendar it renders **nothing at all** —
no empty box, no "coming soon" (ENGINEERING rule 6).

| File | Change |
|---|---|
| [lib/venue-sources.ts](../../lib/venue-sources.ts) | `officialCalendars()` and the `OfficialCalendar` type |
| [app/venues/[slug]/page.tsx](../../app/venues/[slug]/page.tsx) | renders the row, truthy-guarded |
| `lib/__tests__/venue-sources.test.ts` | +7 tests |

## Why this was the piece worth building first

`VENUE_CALENDARS` in `lib/venue-sources.ts` already existed, and it is the most
carefully made table in the repo. Its own header says **"EVERY URL HERE WAS
OPENED"** — by a person, with the test being whether the page lists that room's
events, not whether it returned a 200. Seven existing tests hold each entry to
not being a reseller, an aggregator or a social page, to being absolute https,
and to each First Avenue room getting its own calendar rather than the
all-rooms page.

And it had **exactly one consumer**: `buildVerifyPrompt`, which hands the verify
agent the room's own calendar instead of making it search. A reader searching
"turf club schedule" got nothing from it — they got our page and, if they wanted
the room's own listings, an AXS resale result. This hands the reader the same
curated answer the agent already gets. Zero new storage, zero new CSS, zero DB
reads, and it inherits every guarantee the table's tests already enforce.

## Coverage, measured rather than estimated

| | Pages |
|---|---|
| Show a calendar row | **14** (one of them multi-room) |
| Have events but no curated calendar — row hidden | 19 |
| No upcoming events at all | 14 |
| **Total venue pages** | **47** |

14 of 47 is thin, and the thinness is the honest part. But it is weighted to the
pages that matter: the three busiest venue pages all have it — First Avenue
(84 upcoming), Turf Club (41), Fine Line (24) — and the 14 pages carry 214
upcoming listings between them.

## The one principle, with an instrument

C2's entire normative content is **"presentation only, never placement."** A
principle with no test is a sentence in a deploy guide, which is the
overclaiming failure CLAUDE.md names as unforgivable. So:

The venue page hands `officialCalendars` **the very array it is about to
render**, already sorted by start time. A `.sort()` inside that function would
silently reshuffle a venue's public schedule — presentation becoming placement
in the most literal way this codebase allows. The parameter is `readonly` so the
attempt is a compile error, and a test freezes the input array and asserts the
order is untouched afterwards.

Two placement traps found in recon and **deliberately not walked into**:

- **Never write a venue image into `EventRecord.image`.** `scoreEvent` awards +1
  for `e.image.startsWith("http")` (`lib/content/weekly-picks.ts:27`), and that
  score is the sort key for the Thursday email, `/this-week` and the Instagram
  picks. A photo backfill that looked purely cosmetic would reorder the
  newsletter.
- **The calendar link is not tracked, on purpose.** The beacon only accepts an
  event UUID (`parseBeacon`, `lib/stats.ts`), so the only way to count a profile
  link would be to fire it as `ticket_click` — which inflates the exact number
  C1 quotes to venues and also moves `/trending`, where `ticket_click` is
  weighted 5. Untracked is the correct answer, not a limitation.

## Quality gate

- `npx tsc --noEmit` — clean
- `npm test` — **148 files, 2,907 tests** (2,900 → 2,907)
- `npm run build` — clean, `/api/events` still `○`
- `npm audit` — **0 vulnerabilities**
- Smoked against the real database: `/venues/turf-club` (one calendar),
  `/venues/first-avenue` (two rooms, busier room first), `/venues/cabooze` and
  `/venues/icehouse` (row correctly absent). Screenshots taken of the first two.
  The only console error also appears on the untouched homepage — pre-existing.

**Not observed:** the row's position *relative to the map*. The Mapbox map did
not render locally (no public token in this environment), so the row was smoked
sitting directly under the intro. In production the map renders above it. Worth
one glance.

`npm run lint` still does not run — `next lint` is deprecated. Pre-existing.

## Deploy

1. Push to `main`. Vercel auto-deploys.
2. Nothing else.

## Verify

1. `/venues/first-avenue` — "Each room posts its own schedule: 7th St Entry ↗ ·
   First Avenue ↗", sitting **below the map** and above "84 upcoming events".
2. `/venues/turf-club` — "Schedule straight from the venue: Official calendar ↗".
3. `/venues/icehouse` — no such line anywhere. This is the honest-emptiness case
   and it is 33 of the 47 pages.
4. Click one through and confirm it lands on that room's own schedule.

## Rollback

`git revert` and push. The line disappears from 14 pages; nothing else changes.
`officialCalendars` has no other caller.

---

## The two decisions this leaves you

Recon measured these; I am not able to decide them.

### 1. Photos — I recommend dropping them from C2 entirely

Not "later" — dropped, with reasons:

- **The photos a venue actually emails are artist press shots and crowd
  photos.** Those are licensed to the venue for its own promotion. Our own
  shipped terms and the `FOR_PARTNERS` copy say we cannot redistribute organiser
  images. Crowd photos are identifiable people with no consent chain.
- **A venue-controlled URL is reviewed once and mutable forever.** Today a
  wordmark; next month a sale banner or a tracking pixel, with nothing
  re-checking it.
- **`app/privacy/page.tsx` says "We don't accept file uploads, so we're not
  holding any."** A test pins that sentence as *present*, not as *true*, so an
  upload form would ship a lying privacy page with a green suite.

### 2. Logo — buildable, and it needs one answer from you

The only safe version is: the venue emails its mark, you look at it, and it gets
**committed to `public/venues/`** so what you reviewed is what ships. No
hotlinking, no uploads. That needs you to be willing to commit image files to
the repo, and it needs one sentence somewhere in `/for-venues` recording that a
venue supplying a logo is authorising us to show it — no such permission exists
anywhere today.

### 3. And the bigger question C1 raised, which may be the real C2

C1 measured that **nine of the top ten businesses by ticket clicks have no
`/venues/` page at all** — Ferguson's Orchard (47 clicks), Trail of Terror (41),
Bar Meteor (39), Scream Town (27), Pryes Brewing (29). The registry is
deliberately pipeline config, not a page list.

So "enhanced venue profile" may be the wrong shape. The venues with pages are
the ones with listings; the businesses with demand mostly have neither a page
nor a logo slot to fill. **Giving the earners a page at all** is probably worth
more than a logo on Target Center's, and it is a supply decision rather than a
presentation one.
