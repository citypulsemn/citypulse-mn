# Deploy: places pages line up on one centered column

**Date:** 9 November 2026 · **Schema:** none · **Order:** push only

## What shipped

On a wide screen, four blocks on the places pages hugged the left edge while
everything around them was centered:

- **The intro paragraph on every kind page** (`/places/park`, `/places/beach`, all 18).
- **The badges row** ("✓ Restrooms" and the like) on place detail pages.
- **The tag chips** under it on detail pages.
- **The "More Twin Cities guides" and "More … nearby" chips** at the bottom of kind
  and detail pages.

All four are now centered. The badges, tags and chips share the 720px column the
list, the Before-you-go box and the official-page link already used; the intro keeps
its narrower 640px measure, centered under the heading. On a phone nothing moves,
because every block is already full width there.

## Why it broke

The first two were already meant to be centered. `.places-intro` and
`.place-details-lg` both set `margin: 0 auto`, but a plainer rule further down
`globals.css` (`.page-intro`, `.place-details`) sets its own margin. When two rules
are equally specific, the later one wins, so the later rule's `margin: … 0` pinned
both blocks left. The tags and the related-guides chips never had a column at all;
they spanned the full 1200px and started at the far left.

## Design decisions

- **Two-class selectors, not reordering the file.** `.page-intro.places-intro` wins
  wherever it sits in the file, so a later edit can't silently break it again.
  Moving the rule would only have worked until someone moved it back.
- **The intro text stays left-aligned inside its centered box.** Three lines of
  centered text are harder to read than three lines with a straight left edge. If
  you'd rather it match the centered header, it's one line:
  `text-align: center` on that same rule.
- **Places pages get a `related-guides-lg` class** for their 720px column.
  *Correction, same day:* this note first said collection pages were fine because
  "their whole page is full width". That was wrong: their lists are a centered 620px
  column, and their chips had the same fault. Fixed in `DEPLOY-VENUE-ALIGNMENT.md`.

## Files

- `app/globals.css` — the three rules above
- `app/places/[kind]/page.tsx`, `app/places/[kind]/[slug]/page.tsx` — the two new
  `-lg` classes

## Deploy

Push to `main`. Vercel deploys it. Nothing to run.

## Verify (on a laptop or wider; a phone can't show the bug)

1. `https://www.citypulsemn.com/places/park` — the intro paragraph is centered under
   the "Parks" heading, not flush with the page's left edge. The "More Twin Cities
   guides" chips at the bottom start at the list's left edge.
2. Open any place, e.g. `/places/playground/becker-park-playground` — the badges and
   tags line up with the left edge of the Before-you-go box.
3. If it looks unchanged, hard-refresh: the site's service worker can serve the old
   CSS for one load.

## Rollback

`git revert <sha>` and push. CSS and class names only; no data involved.
