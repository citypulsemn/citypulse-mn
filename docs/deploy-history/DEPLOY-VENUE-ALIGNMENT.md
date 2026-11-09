# Deploy: venue, collection and weekend pages line up on the list's column

**Date:** 9 November 2026 · **Schema:** none · **Order:** push only

The follow-on to the places fix (`DEPLOY-PLACES-ALIGNMENT.md`). That fix covered
places only; a sweep of every public page type at 1440px found the same fault on
five more page types.

## What shipped

Every one of these pages puts its events in a centered 620px list. On a wide screen,
the rows around the list started at the page's far left instead:

- **Venue pages (all 47):** the Hours box, "Schedule straight from the venue",
  "76 upcoming events", "📅 Subscribe to this calendar", and "Is this your venue?"
- **Collection pages:** each day heading ("Monday, November 9, 2026") and the
  "Where to go" chips at the bottom.
- **This Weekend and This Week:** each day heading ("Friday, November 13").
- **This Week:** the intro paragraph (same fault as the places intro), and the
  venue report page's opening paragraph.

All of them now share the list's column, so their left edge lines up with the list.

Two header rows were also off-center under a centered title:

- **"📅 Subscribe to this calendar · Copy link"** on This Weekend, collections and
  neighborhoods sat flush left inside the header. Now centered.
- **The tagline under the title** on collections, Submit, Report, For Venues, For
  Partners, Terms and Privacy sat about 26px left of center. Now centered.

## Why it broke

The list (`.day-list`) and the header (`.dayhdr`) each set a max width and
`margin: auto`. The rows around them set a max width without auto margins, or no
width at all, so they started at the left. The subscribe row has a second problem:
it is a flexbox, and `text-align: center` on the header doesn't move flex items.

## Design decisions

- **Fix the base rules, not overrides.** `.venue-count`, `.venue-hours`,
  `.feed-subscribe`, `.wknd-day`, `.page-intro`, `.coll-tagline` and
  `.related-guides` now carry their own auto margins, so every page that uses them
  gets the column without a per-page patch.
- **One exception, scoped.** `.coll-dayhead` is also the section heading on For
  Venues, For Partners and the venue report, where it already lines up with the
  paragraphs under it. Only the collection-page use (`.coll-daygroup .coll-dayhead`)
  changes.
- **620px for the Hours box (was 640px)** so its edges line up with the list's.
  Playground pages reuse that box as "Before you go"; their own 720px rule still wins.
- **Left-aligned inside the column.** These rows label or follow the list, so they
  share its left edge. Only the two header rows are centered.
- **Not changed, on purpose:** the index pages (/venues, /cities, /neighborhoods,
  /collections, /places) are full-width card grids, and their section headings
  already sit on the grid's edge. Places pages keep their wider 720px column.

## How it was checked

Live pages with the new rules injected, at 1440px and 390px: all 47 venue pages and
28 page types (home, This Week, This Weekend, Ongoing, a day page, an event page,
cities, neighborhoods, collections, venues, places, Submit, Report, Saved, For
Venues, For Partners, Privacy, Terms, venue report). The same check run on the live
site *without* the new rules flags every row listed above, so it does catch the bug.

## Files

- `app/globals.css`
- `docs/deploy-history/DEPLOY-PLACES-ALIGNMENT.md`: corrects its line saying
  collections were fine

## Deploy

Push to `main`. Vercel deploys it. Nothing to run.

## Verify (on a laptop or wider; a phone can't show the bug)

1. `https://www.citypulsemn.com/venues/first-avenue`: "Each room posts its own
   schedule", "76 upcoming events", "Subscribe to this calendar" and "Is this your
   venue?" all start at the left edge of the schedule box.
2. `/venues/minnesota-zoo`: the Hours box is centered over the list.
3. `/this-weekend`: "Friday, November 13" starts at the list's edge, and the
   subscribe row is centered under the title.
4. `/collections/family-fun`: the day headings and "Where to go" line up with the
   lists.
5. If it looks unchanged, hard-refresh: the site's service worker can serve the old
   CSS for one load.

## Rollback

`git revert <sha>` and push. CSS only; no data involved.
