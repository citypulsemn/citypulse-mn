# Deploy: tablet-width rows follow the list to full width

**Date:** 10 November 2026 · **Schema:** none · **Order:** push only

Follow-up to `DEPLOY-VENUE-ALIGNMENT.md` (9 Nov), found by checking tablet widths
(768, 820, 834 and 1024px) on the live site.

## What shipped

At 820px and under, the site's header and event list switch to full width. The rows
that the 9 Nov fix put in the list's 620px column didn't, so on a portrait tablet
(768-820px) they sat 52px inside the list's edges on both sides:

- Venue pages: "76 upcoming events", the Hours box, "Subscribe to this calendar",
  "Is this your venue?"
- This Weekend and This Week: the day headings
- Collection pages: the day headings and "Where to go"
- Day and event pages: the "See this week's best →" strip (this one predates 9 Nov)

They now go full width with the list at 820px and under, so their edges match again.

## Design decisions

- **One media query, after the rules it overrides.** The list's own breakpoint
  (`@media (max-width: 820px)` near `.day-list`) sits early in `globals.css`, before
  these rows' base rules, so adding them there would lose to the later rules. The new
  block sits after `.dayhdr .feed-subscribe`, the last of them.
- **The playground "Before you go" box keeps its 720px places column**
  (`.venue-hours:not(.before-go)`), as do the places pages' guide chips (their
  two-class rule outranks this one).
- **This Week's intro paragraph is left at its 640px reading width, centered,** the
  same call as the places intro. It is 10px wider than the list on each side at 821px
  and up, and narrower than the list below that.

## How it was checked

On the live site:

- **Before:** 49 page types at 768, 820, 834 and 1024px, plus all 47 venue pages at
  768 and 1024px. No page scrolled sideways at any tablet width. The only new fault
  was the 52px inset above, measured at 768px.
- **After, with the rule injected:** all 47 venue pages plus 10 other list pages
  showed 0 rows out of line with the list at 768 and 820px, and 0 of 69 pages
  scrolled sideways. 821px and 1024px are unchanged. Below about 650px the rows were
  already full width, so phones don't change.

## Files

- `app/globals.css`: one `@media (max-width: 820px)` block

## Deploy

Push to `main`. Vercel deploys it. Nothing to run.

## Verify (on a tablet in portrait, or a laptop window narrowed to about 800px)

1. `https://www.citypulsemn.com/venues/first-avenue`: "76 upcoming events" and the
   subscribe line start at the schedule box's left edge.
2. `/this-weekend`: "Friday, November 13" starts at the list's left edge.
3. If it looks unchanged, hard-refresh: the service worker can serve the old CSS once.

## Rollback

`git revert <sha>` and push. CSS only; no data involved.
