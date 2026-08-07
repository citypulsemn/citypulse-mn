# Deploy — Places P2.3: venue bridge (cross-link)

*August 2026. Closes the Places Phase 2 code work. A one-card change — but it
came out of a design decision worth recording.*

## What the roadmap assumed vs. what's true

P2.3 was specced as a `/places/music-venue` page rendering "from the existing
venue registry." Building it surfaced two things the roadmap didn't anticipate:

1. **The venue registry (`VENUE_PAGES`) is ALL tracked venues** — not just music
   ones. It includes the Minnesota Zoo, Mall of America, Ames Center. So a page
   labeled "Music Venues" would misdescribe its own contents.
2. **The site already has `/venues`** — a full venue browse, grouped by city,
   with live event counts, linking to each `/venues/[slug]` schedule. A
   `/places/music-venue` page would largely **duplicate** it.

A separate Places venue page would therefore be both mislabeled and redundant —
against the honest-data and "zero duplicated data" stances the roadmap itself
raised. **Taren's call (asked and answered): cross-link to `/venues`.**

## What shipped

A **"Venues" card** on the `/places` index
([app/places/page.tsx](../../app/places/page.tsx)) — "The metro's concert halls,
clubs, theaters, and arenas — each with its full upcoming schedule" — that links
to the existing **`/venues`** page (`Browse all venues →`). No second venue list,
nothing mislabeled, nothing new to maintain. Venues take their rightful place in
the "where can we go?" taxonomy by pointing at the browse the site already has.

The `music-venue` kind stays in the model (`PlaceKind`, `KIND_META`, the
`venueSlug` field) as a valid-but-unused option — a music-venue Place row could
still point at a venue page later — but there is **no `/places/music-venue`
page**; that route 404s, as an unseeded kind should.

## Verification (observed, not intended)

- **Live in dev (fresh server):** `/places` shows three cards — Beaches (16),
  Splash Pads (19), and **Venues → /venues** ("Browse all venues →").
  `/places/music-venue` returns **404** (no duplicate page). Fresh-server logs:
  no errors.
- **Tests +1 (933/933):** a tripwire that the Places index cross-links to
  `/venues`. (The music-venue special-case work built earlier was reverted — the
  cross-link needs none of it.)
- **Gate:** `tsc` clean · 933/933 · `npm run build` clean (only `/places/beach`
  and `/places/splash-pad` prerender — no music-venue page) · `npm audit` 0.

## Note for the next session

Ran `npm run build` (the gate) while a dev preview was live, which clobbered the
dev server's `.next` chunks and produced a spurious 500 on `/places/music-venue`
until the dev server was restarted. The `MODULE_NOT_FOUND: ./NNNN.js` signature
is that corruption, not a code bug. (Standing lesson: don't build against a live
dev preview.)

## Deploy steps

Push to `main`. One card on the index + one tripwire test. No schema, no env, no
deps, no new routes.

## Verify checklist

- [ ] `/places` shows a "Venues" card that opens `/venues`.
- [ ] `/places/music-venue` (or any unseeded kind) 404s.

## Rollback

`git revert`. Single additive card + a test.

## Places Phase 2 status

- ✅ **P2.2** neighborhood cross-linking (shipped).
- ✅ **P2.3** venue bridge — cross-link (this).
- ⏳ **P2.1** more kinds (pools, curated parks, the fall rink/sledding pair) —
  pure data curation, zero new code; the season math already handles the winter
  wrap.
