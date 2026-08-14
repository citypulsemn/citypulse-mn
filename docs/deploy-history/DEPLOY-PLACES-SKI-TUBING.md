# Deploy — Places: Ski & Tubing (rebrand + expand, 4 → 6)

*Roadmap v6 Tier 1.2 (compounding Places SEO — the winter kinds). Aug 14, 2026.*

## What shipped

Broadened the `ski-hill` kind from **"Ski Area" (4 downhill hills) to "Ski &
Tubing" (6)** by (a) rebranding the kind to include snow tubing and (b) adding the
two verified in-metro places the original "exhaustive four" set had missed:

- **Como Park Ski Center** (St. Paul) — a genuine *in-city* downhill hill (two rope
  tows, 150-ft vertical, cheap first-timer lessons) that the original set skipped.
  A real correction, not just an addition.
- **Green Acres Recreation** (Lake Elmo) — a dedicated snow-tubing hill (~$22, 42"
  to ride solo, reservation-based).

The URL **slug stays `ski-hill`** (canonical unchanged: no lost indexing) — only
the display label/plural/blurb/intro changed.

## Design decisions

- **Rebrand, don't re-slug.** The kind now reads "Ski & Tubing Hill(s)" everywhere
  the label renders (page heading, index card, OG image, sitemap-linked title), but
  `/places/ski-hill` and its canonical are untouched — the page keeps whatever
  index equity it's earned.
- **Metro scope held honest.** The research surfaced three day-trip options; each
  was ruled on against the codified metro box (`lat 44.5–45.4, lng −94.0 to −92.6`):
  - **Wild Mountain** (Taylors Falls) — `lat 45.49`, **over the north edge** → excluded.
  - **Trollhaugen** (Dresser) — **in Wisconsin** → excluded (this is a Twin Cities /
    MN directory).
  - **Welch Village** — geographically in-box (`44.556`) but the registry has
    historically treated it as a ~50-min "out of metro" day trip. That's a product
    call, so it was **not** silently added — held pending Taren's decision (see
    follow-up). Wild Mountain and Trollhaugen also each run a tubing park, so if the
    edge is ever relaxed they'd come as ski+tubing.
  - **Battle Creek** (Ramsey County) — has sledding/XC but **no tube-rental
    operation** → correctly excluded from a tubing directory.
- **Season.** Both new entries use `SKI_SEASON` (Dec–March) — Green Acres runs its
  tubing into March per its own page, so the Dec–March window is the honest month
  label. All six are paid.

## Files

- `lib/places.ts` — `KIND_META["ski-hill"]` label/plural/blurb rebranded; the
  section comment updated (records the scope + the three excluded/held day-trip
  options); two new entries (Como, Green Acres) after Elm Creek.
- `lib/editorial.ts` — `PLACES_KIND_INTRO["ski-hill"]` rewritten to name the hills
  and cover tubing (dropped the stale "four … within a half-hour" line).
- **No route/sitemap/test change** — the kind already existed in the
  `kindsWithPlaces` drift-guard list; no new URL (same slug).

## Verification (observed)

- `npx tsc --noEmit` — clean.
- `npm test` — **1010 passed**; no test hardcoded the old "Ski Area" label
  (grep-checked before relying on it).
- `npm run build` — clean, 40/40 static pages.
- `npm audit` — **0 vulnerabilities**.
- **Live smoke** (`/places/ski-hill`, fresh dev server): 200, **title "Ski &
  Tubing Hills in the Twin Cities, Mapped,"** h1 "Ski & Tubing Hills," "**6** across
  the Twin Cities metro," 6-item list, Como Park Ski Center + Green Acres both
  present, tubing copy live, **canonical unchanged** (`/places/ski-hill`).

## Deploy steps

1. Merge to `main` — Vercel auto-deploys. No schema/env change. No new sitemap URL
   (same slug), so no Index-line delta — the existing page just gets richer + a new
   title.
2. Confirm live: `https://www.citypulsemn.com/places/ski-hill` shows 6 entries and
   the "Ski & Tubing Hills" heading.

## Rollback

Additive data + a display rename. Revert this commit to restore "Ski Area" (4) —
the slug/canonical never changed, so nothing external breaks either way.

## Follow-up — one product call for Taren

**Welch Village** (welchvillage.com, Welch MN) is the marquee ski *resort* near the
Twin Cities — 60+ runs, night skiing, ~50 min SE. It's inside the metro bounding
box (`44.556`), but the registry has historically excluded it as "out of metro." If
you want it in (it's a top "ski near Minneapolis" search result), say the word and
it's a one-entry add. Wild Mountain and Trollhaugen stay out (over the box / in
Wisconsin) unless you also want to widen the geographic scope to day trips.
