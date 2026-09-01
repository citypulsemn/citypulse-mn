# Deploy — the page could be panned sideways on a phone (28 Aug 2026)

## The report

From a phone: you could scroll right, and the whole site slid over into empty
navy.

## Two causes, both in the footer, both the same shape

An element wider than its container with `overflow-x: visible` — the excess
becomes **page** scroll rather than being contained.

### 1. The footer link row — the one you were hitting

`.site-footer-links` holds eleven links and ten `·` separators and had no
`flex-wrap`, so it defaulted to `nowrap`. It needs about **740px on one line**.

Measured at a 518px viewport: the row's `scrollWidth` was 646 against a
`clientWidth` of 486, and `.site-footer` reported a `scrollWidth` of 662 —
exactly the document's width. That row alone was the page's horizontal extent.

**This was not only a phone bug.** At a 700px viewport it still overflowed (737
needed, 668 available). It fails at any width below roughly 800px.

Fixed with `flex-wrap: wrap` — unscoped, because the bug isn't scoped either. On
phones the `·` separators are also hidden: once the links wrap onto four lines a
separator lands at the start of a line as often as between two links, and the row
gap does that job better.

### 2. The subscribe block, at 320px

A second, independent overflow, 38px wide. **A flex item stretches to its
container's width but never below its own min-content** — `.sf-pitch` and
`.subscribe-form` both computed to 335px inside a 288px column.

`min-width: 0` on the footer's flex children is the release valve. `.sf-sub`'s
42ch measure (~358px) and the form's 420px cap also needed a `max-width: 100%`
ceiling, since both exceed a small phone's content column.

## Why the earlier passes said this was clean

Every mobile check in this workstream ended with:

```js
horizontalScroll: document.documentElement.scrollWidth > innerWidth
```

Under the browser pane's viewport emulation, **`innerWidth` reports the scaled
width, which equals the scroll width** — at a 700px emulated viewport it read
753, and `scrollWidth` was also 753. The comparison was 753 > 753 and came back
false every time, on a page that genuinely scrolled sideways.

`document.documentElement.clientWidth` is the correct reference. With it, the
same page reports 753 > 700 immediately.

The sweep also now ignores anything inside a container that owns its overflow,
so intentional scrollers don't drown out real leaks.

## The distinction this rests on

`.section-nav` (743px), `.collstrip-row` (1129px), `.presets` and `.chips` are
all deliberately wider than a phone — and all carry `overflow-x: auto`, so they
scroll inside themselves. That is correct and stays. A test asserts each keeps
its `overflow-x`, because losing it turns any of them into this same bug.

## One thing I broke and caught

The first fix gave the subscribe button `flex: 1 1 auto` so it would fill a
wrapped line. It grew instead: **the email input came out 97px wide next to a
170px button.** Replaced with a `min-width: 150px` floor on the input, so the
button wraps to its own line when there is genuinely no room. The thing you type
in should be the wide one. Now 166px input, 100px button, same line at 320px.

## Verified

No horizontal scroll and zero uncontained leaks at **320, 390, 700, 1440**, on
`/`, `/this-week`, `/places/beach`, `/venues` and an event page, in **all three
view modes** (the map view's `.map-split` collapses to a single 362px column on a
phone). Footer links wrap to 5 lines at 320, 4 at 390, 2 at 700, and stay on one
line with separators at 1440. Desktop is unchanged: 3 columns, first card 312px.

## Rollback

`app/globals.css` only: `flex-wrap: wrap` on `.site-footer-links`, and the block
inside `@media (max-width: 560px)` covering `.site-footer-inner > *`, `.sf-sub`,
`.subscribe-form` and `.subscribe-row`. No markup changed.

## Quality gate

`npx tsc --noEmit` clean · **1841/1841** tests (+8 here) · `npm run build` exit 0
· `npm audit` 0 vulnerabilities.

*The suite includes the uncommitted **reels** workstream in the working tree;
those files are not part of this change and were not staged.*
