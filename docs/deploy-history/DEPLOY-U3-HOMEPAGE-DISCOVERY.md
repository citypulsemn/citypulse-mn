# Deploy — U3: surface Places/Collections/sections on the homepage

*Roadmap UX2 U3 (Taren's list #3). Aug 14, 2026. Size S–M.*

## What shipped

The homepage now carries the same horizontally-scrollable **section-nav** every
other page already has — This Week · This Weekend · Ongoing · Collections · Places ·
Venues · Neighborhoods · Cities — in its header, at the top. Previously these eight
sections appeared on the homepage **only in the footer** (reached by scrolling past
the entire explorer + Trending + Ongoing + Subscribe + Collections strips), which was
Taren's "buried at the bottom" complaint.

## Design decisions

- **Reuse, don't reinvent.** Rather than a bespoke homepage widget, the homepage
  header now renders the identical `.section-nav` strip the shared `TopBar` uses —
  so the homepage matches every content page, and there's one nav to maintain.
- **Single source of truth.** The section list moved from inside `TopBar.tsx` to a
  shared **`lib/nav-sections.ts`** (`SECTIONS`), imported by both `TopBar` and the
  homepage header. Add/rename a section once, it updates everywhere (and the drift
  tests point at the one source).
- **Consciously revisits the UX6 decision.** UX6 deliberately left the homepage
  nav-free ("its presets/chips are its browse controls") and pinned that with a test.
  Taren's call reverses it: the presets are date *filters*, not a way to reach
  Places/Venues/Neighborhoods, so those destinations were genuinely unreachable from
  the top. The homepage still uses its **own** header (it needs the interactive
  List/Calendar/Map toggle) — it just gains the section strip; it does **not** adopt
  the `TopBar` component. The pinning test was updated to expect the new strip.
- **Zero new CSS.** Reuses the existing `.topbar.has-nav` + `.section-nav` styles
  (horizontally scrollable, 40px targets from UX7).

## Files

- `lib/nav-sections.ts` — new shared `SECTIONS` source of truth.
- `components/TopBar.tsx` — imports `SECTIONS` (local copy removed).
- `components/EventsExplorer.tsx` — header is now `topbar has-nav` and renders the
  `.section-nav` from `SECTIONS`.
- `lib/__tests__/topbar.test.ts` — the homepage test now asserts the section-nav +
  SavedLink (and still no `<TopBar` component); the section-list assertion reads the
  new `lib/nav-sections.ts`.
- `lib/__tests__/places.test.ts` — the "Places is in the shared nav" tripwire reads
  `lib/nav-sections.ts`.

## Verification (observed)

- `npx tsc --noEmit` clean · `npm run build` clean · `npm audit` 0.
- `npm test` — **1022 passed**; topbar + places tripwires green against the new source.
- **Live smoke** (homepage): the `.section-nav` is inside `header.topbar` with
  `has-nav`, **8 links** (This Week→Cities) with correct hrefs, positioned at the top
  (Y≈73px, above `<main>`) — not the footer. Clicked the **Collections** chip →
  navigated to `/collections` (h1 "Collections"). End-to-end.

## Deploy / rollback

Merge to `main` — Vercel auto-deploys. No schema/env change. Rollback: revert this
commit (the header strip, the shared source, and the test updates go together).

## Follow-ups (from the UX2 roadmap)

- U5 mobile touches the same header/explorer — sequence it next to avoid churn (e.g.
  the calendar→list SSR-flash fix). The section-nav is already horizontally
  scrollable on mobile (reused `.section-nav` overflow styles), so it degrades fine.
