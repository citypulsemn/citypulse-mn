# Deploy UX6 — persistent section nav (shared TopBar)

*August 2026. UX roadmap item 6. The browse audit's #1 finding: all eight
sections lived ONLY in the footer, so a visitor arriving from Google onto a
venue/neighborhood page couldn't reach "This Weekend" or "Collections" without
scrolling past every event on the page.*

## What shipped

- **[components/TopBar.tsx](../../components/TopBar.tsx)** — one shared header:
  Logo (home) + the UX3 "♥ N" saved link + a compact, horizontally-scrollable
  **section nav** (This Weekend · Ongoing · Collections · Venues · Neighborhoods
  · Cities). At the top of every content page now, so the site's breadth is
  reachable on arrival, not buried in the footer.
- **16 content pages** swapped their hand-rolled `<header className="topbar">`
  (Logo + a bespoke, inconsistently-labelled back-link) for `<TopBar />`:
  event, day, venues (+slug), neighborhoods (+slug), collections (+slug,
  +trending), cities (+slug), this-weekend, ongoing, saved, submit, for-venues.
  This also fixes the audit's header-inconsistency finding — one header, not
  fourteen variants. The back-links are gone: the Logo is home, the section nav
  is everything else.
- **The ♥ saved link now appears on every page**, not just the homepage — the
  other half of the UX3 retention loop (it still renders nothing at zero saves).

## Design decisions

- **The homepage keeps its own topbar.** Its date presets and category chips ARE
  its browse controls, and a redundant section strip would clutter it — so
  EventsExplorer is untouched (a test asserts it does NOT use TopBar).
- **The three terminal pages (not-found / error / offline) keep a minimal
  Logo-only header** — they already carry their own escape links, and I didn't
  want the section nav's client SavedLink fetch firing inside an error boundary.
  A test pins that these are the ONLY remaining bespoke topbars.

## Verification (observed, not intended)

Dev server, real data:
- /venues and /event both render the 6-link section nav + Logo, no old back-link,
  page content intact (42 venue links; event title + UX5 directions link
  preserved). Section nav hrefs correct, `overflow-x: auto`.
- Homepage keeps its List/Calendar/Map toggle and shows **no** section nav
  (correct — its presets are the nav).
- Tests +6 (832/832): TopBar carries all six sections + Logo + SavedLink + the
  nav landmark; all 13 sampled content pages render `<TopBar />` and dropped
  `className="topbar"` / `page-back`; a directory sweep asserts ONLY
  error/not-found/offline keep a bespoke topbar; EventsExplorer keeps its own.
- Gate: tsc clean · 832/832 · build clean · audit 0.

## Deploy steps

Push to `main`. Code-only, no schema.

## Verify checklist

- [ ] On a venue/neighborhood/collection page (esp. from a Google result), the
      section nav is right at the top — This Weekend / Collections / etc. reachable
      without scrolling.
- [ ] The nav scrolls horizontally on a narrow phone; the Logo goes home.
- [ ] With events saved, the "♥ N" link shows in the header on every page.
- [ ] The homepage still has its List/Calendar/Map controls (unchanged).

## Rollback

`git revert`. The old per-page headers come back; `.page-back` / `.topnav` CSS
was left in place, so nothing else needs restoring.
