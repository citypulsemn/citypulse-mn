# Deploy — U6a: desktop multi-column list (use the wasted width)

*Roadmap UX2 U6 (Taren's list #2, desktop) — slice a. Aug 14, 2026. Size S.*

## What shipped

On wide screens the homepage **List** view now flows each day's events into a
responsive **multi-column grid** instead of a single ~640px column marooned in a
1240px shell — roughly half the width was empty navy. This matters more now that
U5 made List the default view on desktop too.

- ≥1000px: each day's cards flow into `repeat(auto-fill, minmax(330px, 1fr))` — 2
  columns around 1000px, **3 columns** at 1240px. Verified: 3 columns at 1280px,
  list widened from 640px to 1200px.
- <1000px: unchanged — the single ~620px reading column.

## Design decisions

- **Scoped to `.list-view`.** The rule is `.list-view .day-list { … grid … }`, so
  the **shared `.day-list`** used by the DayPanel, the `/day/[date]` page, and
  collection pages keeps its single-column reading width. Verified: the `/day` page
  `.day-list` stays `display: block`, 620px, at 1280px.
- **`auto-fill`, not `auto-fit`.** On a sparse day (1–2 events) auto-fill keeps the
  cards compact (~370px) in the first column(s) instead of stretching one card to
  full width. Busy days fill all 3 columns.
- **Day headers stay full-width.** `.list-day-h` is a sibling of `.day-list` (not
  inside it), so each day's header spans the full width above its card grid — the
  chronological day grouping stays clear.
- **The first `min-width` media query in the app.** Every other query is
  `max-width` (shrinking for phones); this is the first that optimizes *up* for
  large screens. CSS-only, no JS.

## Files

- `app/globals.css` — one `@media (min-width: 1000px)` block widening `.list-view`
  and gridding `.list-view .day-list`.

## Verification (observed)

- `npx tsc --noEmit` clean · `npm run build` clean · `npm audit` 0.
- **Live smoke:**
  - 1280px: `.list-view .day-list` → `display: grid`, 3 columns (371px each),
    `.list-view` width 1200px, 56 cards across 3 distinct column positions.
  - 860px: `display: block`, no grid, single column, 620px.
  - `/day/2026-08-15` at 1280px: `.day-list` `display: block`, `max-width: 620px`,
    `inListView: false` — shared list untouched.

## Deploy / rollback

Merge to `main` — Vercel auto-deploys. CSS-only, no schema/env. Rollback: remove the
one media-query block.

## Follow-up — U6b (not shipped here)

The bigger desktop slice is a **side-by-side map + list** ("browse the list while
seeing the pins") — the three views are currently mutually exclusive
(`EventsExplorer.tsx`). That's a real composition change (render + selection sync)
and its own item.
