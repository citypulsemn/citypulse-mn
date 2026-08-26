# Deploy — the compact sticky bar, and the sticky header that never stuck (26 Aug 2026)

## What shipped

On a phone, the homepage now opens to **events**. One sticky row — search plus a
Filters button — carries the whole control surface; the date presets, category
chips, price/area filters and location live in a drawer behind it.

| | Original | After the CSS pass | **Now** |
|---|---|---|---|
| First event card | 731px | 474px | **219px** |
| Cards above a 660px fold | 0 | 2 | **4** |
| Sticky chrome (mobile) | 117px of header | 117px | **61px** |

Desktop is untouched: every control stays on the page, the toggle is hidden.

## The bug underneath

`.topbar` has said `position: sticky; top: 0; z-index: 40` for as long as it has
existed. **It has never stuck.**

`html, body { height: 100% }` caps `<body>` at one viewport, and a sticky element
can only stick inside its parent's box — so on a 24,000px page the header
travelled 812px and then left with the rest of the document. Found by measuring:
after scrolling, the topbar's `bottom` was `-388`.

`min-height: 100%` fixes it. The 100% is there so short pages still paint a full
background; `min-height` keeps that and lets the body grow. **The sticky header
now works on every page** — verified at 1280px, `top: 0` after a 2000px scroll.

## The mobile sticky budget

With the header genuinely sticky, mobile would have carried **178px** of sticky
chrome — 27% of a 660px screen spent permanently on things that aren't events.

So on a phone `.topbar` goes `position: static` and the compact bar takes the
top. While you scroll a 24,000px list, search and filters earn that 61px; the
wordmark does not, and it is one flick away.

## What's behind the button, and what the button admits

The drawer holds the date presets and month nav, the category chips, the
price/area panel and the location picker — everything that was stacked down the
page before.

The count on the button is the part that matters. It counts **categories switched
off** as well as prices, areas, a chosen location and a non-default date range,
because those are exactly what you forget you set:

```
categoriesOff + prices + areas + (location ? 1 : 0) + (range !== default ? 1 : 0)
```

A bar that said "Filters" with no number while three categories were hidden would
quietly lie about why the list looks short.

## Accessibility

- `aria-expanded` / `aria-controls` on the toggle, wired to the drawer's id.
- **Escape closes it.** A panel that covers the page and can only be dismissed by
  finding its button again is a trap.
- The closed drawer is `display: none`, not zero-height — its 16 focusable
  controls are genuinely gone rather than invisible-but-tabbable.
- The button is 44px tall; the badge keeps its count while the drawer is shut.

## Things worth knowing

**`--topbar-h` is measured, not hardcoded** — a `ResizeObserver` on `.topbar`
writes it to the root. It ended up unused on mobile once the topbar went static,
but it stays because it is what makes the bar's offset correct if the topbar is
ever sticky again on a narrow screen. The height moves with the section-nav
wrapping and the safe-area inset, so a constant would have been wrong.

**I argued against this two messages ago** — hiding the category chips behind a
tap, when categories are the main way people browse. That was the right concern
and it is why the badge counts hidden categories: the cost of the trade is
visible rather than silent. Whether it was worth it is answerable from the
analytics already in place.

## Verify

Load `/` on a phone: four cards without scrolling. Scroll — the search/Filters
row stays at the top and nothing is stranded above it. Tap Filters: dates,
categories, price/area, location. Turn a category off, close the drawer, and the
button shows a count.

## Rollback

`components/EventsExplorer.tsx` (the `controlsOpen` state, the toggle, the drawer
wrapper) and the `.compactbar` / `.controls-toggle` / `.controls-drawer` rules in
`app/globals.css`. The `min-height: 100%` change is independent and worth keeping
either way — it is a straight bug fix.

## Quality gate

`npx tsc --noEmit` clean · **1436/1436** tests · `npm run build` exit 0 ·
`npm audit` 0 vulnerabilities · measured at 375px and 1280px in a real browser,
scrolled, with the drawer opened and closed; `/report`, `/cities` and
`/this-week` checked for the body-height change.
