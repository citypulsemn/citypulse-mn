# Deploy — mobile: 490px of blank navy, and no events on first screen (26 Aug 2026)

Two problems reported from a phone. One was a bug with a precise cause; the other
was a layout choice that had quietly gone wrong as controls were added.

## 1. The subscribe footer was 622px tall for 132px of content

Measured on a 375px viewport: `.sf-pitch` rendered **280px** for two lines of
text, and `.subscribe-form` **320px** for one input and a button. The gap
*between* them was a correct 22px — all the emptiness was inside the blocks.

**Cause.** The desktop rules size those blocks by width:

```css
.sf-pitch       { flex: 1 1 280px; }
.subscribe-form { flex: 1 1 320px; }
```

`flex-basis` applies to the **main axis**. The mobile query flips
`.site-footer-inner` to `flex-direction: column`, and from that moment the main
axis is *height* — so 280px and 320px stopped being widths and became minimum
heights, with `flex-grow: 1` stretching them further.

**Fix.** Two declarations inside the existing query:

```css
.site-footer-inner .sf-pitch,
.site-footer-inner .subscribe-form { flex: 0 0 auto; }
```

**622px → 139px.** Desktop is untouched — verified the row direction and the
`1 1 280px` basis still apply at 1280px.

## 2. The first event card sat at 731px — below the fold on every phone

Nothing was broken; the controls had simply accumulated. Measured stack above the
first card:

| | |
|---|---|
| date presets + month nav | 177px |
| category chips (8, wrapping to 3 rows) | 171px |
| "Make this my default" | 32px |
| search · filters · location | 131px |

**Wrapping was the problem.** Eight chips became three rows, four date presets
became two.

### One row, scrolled — not wrapped, and nothing hidden

```css
.presets, .chips { flex-wrap: nowrap; overflow-x: auto; ... }
```

Considered and rejected: folding the category chips into the existing **Filters**
disclosure. It saves the same space, but categories are the primary way anyone
browses this site, and putting the main affordance one tap further away to win
vertical pixels is a bad trade. Scrolling keeps every option visible and
reachable.

### "Make this my default" now waits until it means something

On a first visit the view and range *are* the shipped defaults, so the button
offered to pin a preference the visitor hadn't formed — a row of chrome on the
screen where events matter most. It now renders only when
`isDefault || view !== DEFAULT_VIEW || range !== DEFAULT_RANGE`.

Verified live: hidden on load, appears the moment "This Month" is picked, hides
again on returning to the default, and a returning visitor with a saved default
still sees "✓ Your default view".

## Result

| | Before | After |
|---|---|---|
| First event card | 731px | **474px** |
| Event cards above a 660px fold | **0** | **2** |
| Footer height (mobile) | 622px | **139px** |

No horizontal page scroll, no vertical clipping of either scroll row, desktop
layout unchanged.

## Verify

Load `/` on a phone. The first card should be visible without scrolling, the
category row should scroll sideways, and the footer should be a heading, a form
and the links with nothing between them.

## Rollback

All of §1 and most of §2 live inside the existing `@media (max-width: 560px)`
block in `app/globals.css`; reverting that block restores the old behaviour. The
default-view conditional is one expression in `components/EventsExplorer.tsx`.

## Quality gate

`npx tsc --noEmit` clean · **1436/1436** tests · `npm run build` exit 0 ·
`npm audit` 0 vulnerabilities · measured at 375px and 1280px in a real browser
before and after.

## Not done

**The remaining 474px is still mostly controls** — search, date presets, month
nav, categories, Filters, location. Getting events genuinely to the top would
mean a compact sticky bar (search + one Filters button) with the rest behind it,
which is a real redesign and a product call rather than a CSS fix. Worth doing if
the first-screen bounce rate says so; the analytics to answer that already exist.
