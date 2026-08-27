# Deploy — desktop: four control rows become two (27 Aug 2026)

## The report

Same complaint as the phone, from a desktop browser: the page opens to filters
and controls with no events.

## What was measured

The control stack was **322px tall at every width** — a fixed column of four
rows — so the first event card sat at **523px** regardless of monitor size.

| viewport | cards fully visible |
|---|---|
| 1152×648 (the reported case, ~150% zoom) | **1** |
| 1366×768 | 3 |
| 1440×900 | 6 |

## It was never a shortage of space

| row | height | content width | unused |
|---|---|---|---|
| dates + month nav | 80px | 719 of 1200 | 40% |
| category chips | 73px | 821 of 1200 | 32% |
| **Filters** | 44px | **81 of 1200** | **93%** |
| **Location** | 44px | **202 of 1200** | **83%** |

The Filters disclosure had an entire row to itself to show an 81-pixel button.
Those two rows spent **88 vertical pixels** on controls that fit in a corner,
stacked in a column while 400–1100px sat idle beside them.

This is the opposite of the phone's problem, and it needed the opposite fix.

## What shipped

Two rows, grouped by meaning:

- **Row 1 — when:** search · date presets · month nav
- **Row 2 — what & where:** category chips · Filters · location

| | before | after |
|---|---|---|
| control block | 322px | **133px** |
| first event card | 523px | **312px** |
| cards above a 900px fold | 6 | **9** |
| grid columns | 3 | 3 (unchanged) |

**Nothing is hidden.** The phone collapses controls behind a button because it
genuinely has no room. Desktop has the room, and putting the category chips —
the main way anyone browses this site — behind a click here would be a
regression dressed as a tidy-up. A test asserts no desktop rule ever sets
`display: none` on a control.

## Two breakpoints, because forcing two rows narrower is worse than three

The first build applied two rows from 1000px up. At 1152×648 that was wrong:

```
forced two rows @1152:  controls 122px (wrapped), chips 97px (wrapped) → 246px
three rows      @1152:  controls  44px,           chips 44px           → 187px
```

The chips row needs 1152px of content width to stay on one line, and it can
never get more than `content − 81 − 202 − gaps` no matter how the columns are
split. Below that, **both** rows wrap to two lines. A row that wraps costs more
height than the row it saved.

So: **≥1240px** two rows, **1000–1239px** three rows (search + Filters +
location / dates / chips), **<1000px** the original stacked layout, **<560px**
the phone's drawer. 1240 is where `.wrap` hits its max-width and content settles
at 1200px, comfortably over the 1152 the chips row needs.

## How it works

`.controls-shell` wraps the search row and the drawer. On desktop the drawer
becomes `display: contents`, lifting its children into the shell's grid so the
search box and the date controls can share a row despite being in different
parents. Placement is explicit (`grid-row` / `grid-column`) rather than by DOM
order, because the conditional "make this my default" row sits between two
controls in the markup and must not shift anything sideways.

The chips row used to carry the block's bottom divider; in a grid it no longer
spans the full width, so the divider moved to the shell. Spacing moved there
too — a grid item's own margin fights `align-items: center` and left the search
box and the date presets a few pixels off each other's centre line.

## Verified in a browser

At 1440×900: both rows share exact centre lines (162/162 and 216/216/216), chips
and controls on one line each, no overlaps, nothing clipped, nothing outside the
wrap, no horizontal scroll, still 3 columns.

Boundaries checked: **1239px** (three rows, nothing wrapped, first card 366px),
**999px** (original stacked layout restored, first card 519px, chips border back),
**mobile** (sticky bar, drawer `none → block → none`, 0 → 16 → 0 reachable
focusables, first card still 219px — the compact-bar work is untouched).

## Rollback

The two `@media` blocks in `app/globals.css` labelled "Desktop: two control
rows", and the `.controls-shell` wrapper div in `components/EventsExplorer.tsx`.
Removing both restores the previous layout exactly. No data, no schema.

## Quality gate

`npx tsc --noEmit` clean · **1816/1816** tests (+8 here) · `npm run build` exit 0
· `npm audit` 0 vulnerabilities · measured at 1920, 1440, 1280, 1239, 1152, 1024,
999 and mobile in a real browser.

*The suite grew from 1468 to 1816 mid-session because the uncommitted **reels**
workstream appeared in the working tree. Those files are not part of this change
and were not staged.*

## Not done

The **left filter rail** — the standard listings pattern — was considered and
rejected. `.wrap` is capped at 1240px even on a 1920 screen and the list is a
3-column grid of 371px cards, so a rail costs a whole column at every width; at
1440×900 the card count comes out a wash. It becomes the right answer only if
the wrap cap is raised on wide screens, where there is currently 340px of empty
margin on each side. That is a decision about how wide the site should read, not
a CSS detail.
