# Deploy: the venue address line reads cleanly on phones

**Date:** 16 November 2026 · **Schema:** none · **Order:** push only

## What shipped

The line under a venue's name ("199 W Kellogg Blvd, St Paul, MN · Downtown St. Paul &
Lowertown · Directions ↗ · Parking ↗") had two faults on phones. Measured on the live
site at 375px, all 47 venue pages:

- **A stray "·" at a line end or start: 21 of 47 pages** (26 at 320px, 15 at 414px,
  and Ordway at 600px). The Xcel page, for one, read "… · Directions ↗ ·" with
  "Parking ↗" alone on the next line.
- **The neighborhood chip's line sat 4px right of center: 15 of 47 pages.**

On screens under 700px wide the line is now three centered lines: the address, the
neighborhood chip, then "Directions ↗ · Parking ↗". At 700px and up (tablets, laptops)
it stays one line, as before. Nothing dangled or sat off-center there to begin with.

## Why it broke

- **The 4px.** `.nbhd-chip` had `margin-left: 8px`. When the line wrapped and the chip
  started the new line, that margin still counted as part of the centered line, so it
  shifted the line by half of it. Whitespace is the only spacing that vanishes at a
  line break, so the gap is now a space in the markup and the margin is gone.
- **The stray dot.** " · " separators sat between every item, and a line can break on
  either side of one. "Directions ↗ · Parking ↗" now wraps as one unit
  (`.hdr-links`), and under 700px it takes its own line and drops its leading dot
  (`.hdr-sep`).

## Side effects, checked

The chip style is shared with place pages and event pages, so both now carry the same
leading space:

- **Gap before the chip:** 8px → about 4px everywhere (one space).
- **Event pages:** where the chip wraps to its own line it used to be indented 8px;
  now it lines up with the venue name above. At 375px that was 12 of the 21 event
  pages with a chip in This Weekend's list.
- **Place pages:** only Como and Minnehaha show a chip; their lines are identical
  before and after.

## How it was checked

The new markup and CSS were applied to live pages in the browser. All 47 venue pages
were checked at 320, 375, 414, 600, 650, 700, 701 and 1440px: no stray dot, no line
more than 1.5px off center, and no sideways scroll. The same check without the change
finds the 21 and 15 above.

## Not changed (found while checking)

Place page headers have their own faults on the same line: the city is printed twice
("4300 Webber Pkwy, Minneapolis, MN 55412, Minneapolis, MN"), and the "Free" pill and
"Been there" button push their lines about 5px off center. Left for a separate change.

## Files

- `app/globals.css`: `.nbhd-chip` loses its margin; new `.hdr-links` and `.hdr-sep`
- `app/venues/[slug]/page.tsx`: space before the chip; links grouped
- `app/places/[kind]/[slug]/page.tsx`, `components/EventDetailBody.tsx`: space before the chip

## Deploy

Push to `main`. Vercel deploys it. Nothing to run.

## Verify (on your phone)

1. `https://www.citypulsemn.com/venues/xcel-energy-center`: three centered lines under
   "Grand Casino Arena", with no "·" at the end of any line.
2. Any event page at a venue with a neighborhood: the chip sits one space after the
   venue name.
3. If it looks unchanged, close the tab and reopen it: the service worker can serve
   the old page once.

## Rollback

`git revert <sha>` and push. Markup and CSS only; no data involved.
