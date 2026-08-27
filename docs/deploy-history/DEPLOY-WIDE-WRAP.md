# Deploy — wide screens get the width (27 Aug 2026)

## What shipped

`.wrap` goes from **1240px to 1600px at viewports ≥1500px**. Below that, nothing
changes.

| at 1920×1080 | before | after |
|---|---|---|
| content width | 1240px | **1600px** |
| empty margin each side | 340px | 160px |
| event grid columns | 3 | **4** |
| cards above the fold | 12 | **19** |

At 1440×900 the wrap is still 1240 and the layout is byte-for-byte what it was —
laptops were deliberately left alone.

## Why the cap existed, and why it could move

The 1240px cap is a **reading** constraint: prose should not run to 200
characters a line. But it was applied to every page at every size, and the
homepage, the day pages and the places lists are card grids — there the cap was
not protecting readability, it was costing a column.

The grid is `repeat(auto-fill, minmax(330px, 1fr))` with a 26px gap, so 1560px
of content runs four columns where 1200px ran three.

## The rule this is built on

**Widening the page must not widen a sentence.**

Most prose already had its own measure, which is why this was safe:

| | max-width | chars/line at 1600 |
|---|---|---|
| `.page-intro` (for-venues, place detail) | 640px | 46–93 |
| `.place-intro` (kind pages) | 643px | 87–93 |
| `.marquee` (the whole event detail card) | 560px | unaffected |

**One was not.** The subscribe band's subtitle is inside `flex: 1 1 260px`, so it
grew with the row: **1167px wide, 115 characters a line** on `/this-week`. Fixed
with `max-width: 68ch` — now 579px and 58 characters.

A test asserts each of these keeps its own measure, because a future width bump
would repeat exactly this failure.

## Verified in a browser

Swept `/`, `/this-week`, `/cities`, `/venues`, `/collections`, `/places/beach`,
`/places/beach/<slug>`, `/for-venues` and an event page at 1920×1080, looking for
any text block over 80 characters a line. After the fix: none.

Boundaries: **1499px** → wrap 1240, 3 columns, unchanged. **1500px** → wrap 1485,
4 columns. **375px** → wrap 375, sticky bar, drawer closed, first card 219px —
mobile untouched. No horizontal scroll at any width tested.

### Two measuring traps worth recording

The browser pane was hidden for this session, which caused two false readings
that nearly went into this document as facts:

- **A cached page** reported the subscribe band still at 1167px *after* the fix
  had built correctly. The rule was in the CSS bundle; the tab was not. A forced
  reload showed 579px.
- **Next kept the previous route's DOM** in a `display: none` container during
  client-side navigation, so `document.querySelector('.detail-desc')` returned
  the *stale* copy and every measurement on the event page came back `width: 0`.
  The event page's real constraint (`.marquee`, 560px) was confirmed from the
  stylesheet instead, which is definitive.

`requestAnimationFrame` also never fires while the pane is hidden — a measuring
script that waits on it times out rather than returning.

## Rollback

Two blocks in `app/globals.css`: the `@media (min-width: 1500px)` rule raising
`.wrap`, and the `max-width: 68ch` on `.subscribe-band-sub`. Removing the first
restores the old width everywhere; the second is worth keeping either way, since
a 115-character line was never intentional.

## Quality gate

`npx tsc --noEmit` clean · **1823/1823** tests (+7 here) · `npm run build` exit 0
· `npm audit` 0 vulnerabilities · measured at 1920, 1500, 1499, 1440 and mobile
across nine routes.

*The suite includes the uncommitted **reels** workstream that appeared in the
working tree mid-session; those files are not part of this change and were not
staged.*

## What this unlocks

The **left filter rail** was rejected last change because `.wrap` was capped at
1240px, so a rail cost one of three columns at every width. At 1600 that maths
changes: a 260px rail leaves ~1300px, still three columns, and the event list
would start at the top of the page instead of below the controls.

Not built here — this change stands on its own, and the rail is a structural
decision worth taking separately now that the width exists to make it free.
