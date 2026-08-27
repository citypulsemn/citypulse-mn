# Deploy — the left filter rail (27 Aug 2026)

## What shipped

At **1800px and wider**, the controls move into a 240px left column and the
event list starts at the top of the page.

| at 1920×1080 | before | after |
|---|---|---|
| first event card | 312px | **167px** |
| grid columns | 4 | 4 (unchanged) |
| cards above the fold | 19 | 19 (unchanged) |
| filters while scrolling | scrolled away | **always on screen** |

The card count is deliberately a wash. **That is the whole point** — the rail was
only worth building if it did not cost a column, and the previous change (the
1600px wrap) is what made that possible.

## Why 1800 and not 1500

A rail is free only if the list keeps its four columns, and the arithmetic is
tighter than it looks:

```
4 columns of cards    4×330 + 3×26        = 1398px of GRID
.day-list padding     + 16px each side    = 1430px of COLUMN
rail + gutter         + 240 + 32          = 1702px of CONTENT
.wrap padding         + 20px each side    = 1742px of WRAP
```

The 1760px tier clears it with 18px to spare. At the 1600px tier the same rail
drops the list to **three** columns — a worse page than the two-row control block
it would replace. So the rail appears exactly where it costs nothing, and every
narrower screen keeps what it had.

**`.day-list`'s own 16px side padding is the part worth writing down.** Built with
a 264px rail first, the list came out *six pixels* short of a fourth column and
silently rendered three. The rail went to 240px rather than widening the wrap
again, which at 1920 would have left only 60px of page margin.

A test asserts this arithmetic, because getting it wrong is invisible — the grid
just renders one column fewer and nothing looks broken.

## Two CSS traps this hit

**Auto margins make a grid item shrink-to-fit.** `.list-view` carries
`margin: 8px auto 0` for its narrow-screen reading column. As a plain block that
still filled the width; as a *grid item* it collapsed to 887px inside a 1424px
column and the card grid fell from four columns to two. Fixed with
`margin-inline: 0` on the layout's children — applied to all of them, not just
`.list-view`, so a future view mode cannot hit the same thing.

**`align-items: center` leaked in from the two-row block.** Under it every rail
control sized to its own content and floated mid-column: `.chips` came out 126px
wide next to a 298px `.controls` in a 240px rail. The rail sets
`align-items: stretch`.

**The month label alone is wider than the rail.** `.monthnav .label` reserves
`min-width: clamp(150px, 16vw, 190px)`; at this viewport that is 190, and with
two 44px buttons and two 10px gaps the control has a 298px minimum. In the rail
the label takes what is left instead (`min-width: 0; flex: 1 1 auto`).

## How it works

`main` gains `explorer-layout`. At 1800px+ it becomes
`grid-template-columns: 240px minmax(0, 1fr)`; **every direct child goes to
column 2 by default** and only `.controls-shell` is pulled to column 1, so a new
view mode lands in the right place without another rule. `.sr-only` is absolutely
positioned and so is not a grid item at all.

Inside the rail the shell switches from the two-row grid to a vertical flex
stack; the drawer stays `display: contents`, so the controls stack in DOM order:
search, dates, categories, Filters, location. The eight category chips become one
per line, which reads as a filter list rather than a wrapped pill row.

The rail is sticky beneath the topbar using the **measured** `--topbar-h` (set by
a ResizeObserver in `EventsExplorer`, because the topbar's height moves with the
section-nav wrapping). `max-height` + `overflow-y: auto` is a safety valve: at
1920 the rail is 798px and never scrolls itself, but if it ever outgrew the
viewport it would scroll rather than strand its last control off-screen.

## Verified in a browser

**1920×1080** — rail 240px at left 92, list 1448px at left 364, gutter exactly
32, every rail control exactly 240px wide with nothing overflowing, four columns,
first card at 167px, no horizontal scroll. After scrolling 3,000px the rail is
still at y=136, directly beneath the topbar's 122px bottom edge.

**All three view modes** in the rail layout: list (4 columns), calendar
(`.cal-head` 1448px at left 364), map (`.map-split` 1448px, 1050px map + 380px
list). None overflow the wrap.

**Boundaries** — 1799px: no rail, wrap 1600, two-row control block, 4 columns,
first card 312px. 1440px: `main` is `display: block`, wrap 1240, 3 columns, first
card 312px — a laptop is byte-for-byte what it was. Mobile: sticky bar, drawer
`none → block → none`, 0 → 16 → 0 reachable focusables, first card 219px.

## Rollback

The `@media (min-width: 1800px)` block labelled "The left filter rail" in
`app/globals.css`, and the `explorer-layout` class on `main` in
`components/EventsExplorer.tsx`. Removing the media block alone is enough — the
class is inert without it. The 1760px wrap tier can stay either way.

## Quality gate

`npx tsc --noEmit` clean · **1833/1833** tests (+10 here) · `npm run build` exit 0
· `npm audit` 0 vulnerabilities · measured at 1920, 1799, 1440 and mobile, across
all three view modes, with a scroll test for the sticky behaviour.

*The suite includes the uncommitted **reels** workstream that appeared in the
working tree mid-session; those files are not part of this change and were not
staged.*

## Worth knowing

**Most people will not see this.** It needs a viewport of 1800px+, so a 1920
monitor with the browser maximised and no zoom. At 150% zoom on that same
monitor the effective viewport is 1280 and the two-row control block shows
instead. That is the correct trade — below 1800 the rail actively costs a column
— but it does mean the rail is a wide-monitor feature, not the default
experience.

If you would rather have it earlier and accept three columns between 1500 and
1800, that is a one-line change to the media query.
