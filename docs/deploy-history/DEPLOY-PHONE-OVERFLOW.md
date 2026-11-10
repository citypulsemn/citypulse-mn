# Deploy: day pages and the places filters stop scrolling sideways on phones

**Date:** 9 November 2026 · **Schema:** none · **Order:** push only

## What shipped

Two things were wider than a phone screen, so the whole page could be dragged
sideways:

- **Every day page.** The "← Tuesday, November 24, 2026 · Thursday, November 26, 2026 →"
  links under the date. Each link was forced onto one line, and the two together don't
  fit. Measured on the live site: 9-55px too wide at 375-414px phones, up to 110px at
  320px. Day pages earn the most Google clicks per page of any section (1.24, in the
  October Search Console read).
- **The places features filter** ("Indoor · Fenced · Toddler area · Café · Socks
  required · Restrooms"). That chip group never wrapped. /places/discover was 75px too
  wide at 375px; Ski Hills and Trampoline & Climbing were too wide on the smallest
  (320px) phones.

Now each date link wraps onto a second line in place: the left one left-aligned, the
right one right-aligned, in the same 44px-tall tap row. The features chips wrap onto
a second row inside the filter box. Nothing changes on a laptop.

## Why it broke

- `.day-nav-link` sets `white-space: nowrap`, and `.day-nav` is a row that doesn't
  wrap. Full dates ("Wednesday, September 23, 2026") are long, so on a phone the
  second link was pushed off the right edge.
- `.pf-group` is a non-wrapping row of chips. Fine for Cost (three chips); the
  features group can hold six or more.

## Design decisions

- **Wrap the text, keep the words.** No shorter date format: the full date is the
  link text Google reads for "events in Minneapolis [date]", and day pages are the
  pages that rank. On phones the year drops to a second line instead.
- **Scoped to `.day-nav`.** The same link style is used in the "See this week's best →"
  strip on day and event pages; that row already wraps, so it keeps `nowrap`.
- **Only the features group wraps.** The Cost pill (All · Free · Paid) stays one piece.

## How it was checked

Live pages with these rules injected, at 320, 375, 390 and 414px: 51 pages (every
public page type, all 18 places kinds, five day pages chosen for long dates, three
venues). Page overflow went from 8 pages scrolling sideways at 320px to 0, and at
375px from 6 to 0. Desktop (1440px) day pages: the two links are unchanged.

## Files

- `app/globals.css`: `.day-nav .day-nav-link` (two new rules) and `.pf-details`

## Deploy

Push to `main`. Vercel deploys it. Nothing to run.

## Verify (on your phone)

1. Open any day page, e.g. `https://www.citypulsemn.com/day/2026-11-25`. Try to drag
   the page sideways: it shouldn't move. The two date links each sit on two lines,
   one at each edge.
2. Open `/places/discover`. The feature chips wrap onto a second row, and the page
   doesn't move sideways.
3. If the page still drags sideways, close the tab and reopen it: the site's service
   worker can serve the old CSS for one load.

## Rollback

`git revert <sha>` and push. CSS only; no data involved.
