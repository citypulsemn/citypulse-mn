# Deploy — events → Places reverse link ("Where to go")

*Roadmap v6 Tier 1.2 (cross-linking pass, part 3 — closes the ↔ loop). Aug 14, 2026.*

## What shipped

The reverse of the Places→events bridge. Each collection page now shows a **"Where
to go"** strip linking to the evergreen Places guides that map to it — completing the
two-way link between the events and Places halves of the site. On
`/collections/festivals-and-markets` the strip points to **Farmers Markets** and
**Orchards & Patches**; on `/collections/arts-and-culture`, to **Museums**; on
`/collections/family-fun`, to the six family-destination guides.

**Why it matters:** the forward bridge (shipped previous commit) sends Places' SEO
traffic to the calendar. This reverse link sends calendar visitors to evergreen
Places content — most valuable exactly when the calendar is thin (the empty-state
visitor gets a useful "here's where to go" instead of a dead end).

## Design decisions

- **One source of truth, inverted.** `placeKindsForCollection(slug)` is the inverse
  of the existing `KIND_EVENT_COLLECTION` forward map — no second map to keep in
  sync. It filters to kinds that actually have places, so the empty `music-venue`
  kind never surfaces (the `live-music` collection correctly shows no strip).
- **Honest emptiness.** Collections with no mapped-and-seeded kinds render nothing —
  `date-night`, `free-this-week`, `only-in-minnesota`, and `live-music` (its only
  mapped kind is unseeded) all show no strip.
- **Zero new styling.** Reuses the `.related-guides` pill styles from the kind-page
  mesh, so the two halves look consistent.
- **No new DB.** The collection page already queries events; this adds a pure
  in-memory registry lookup, no extra query.

## Files

- `lib/places.ts` — `placeKindsForCollection(collectionSlug)` (inverse selector).
- `app/collections/[slug]/page.tsx` — renders the "Where to go" `<nav>` before the
  footer when the collection has mapped guides.
- `lib/__tests__/places.test.ts` — 1 golden test: inverts correctly, filters empties
  (`live-music` → `[]`), and round-trips against the forward map.

## Verification (observed)

- `npx tsc --noEmit` — clean.
- `npm test` — **1016 passed**; places suite 49/49 incl. the new reverse-map test.
- `npm run build` — clean, 41/41 static pages.
- `npm audit` — **0 vulnerabilities**.
- **Live smoke:**
  - `/collections/festivals-and-markets` → "Where to go": **Farmers Markets** +
    **Orchards & Patches** (`/places/farmers-market`, `/places/orchard`). Correct
    inverse.
  - `/collections/live-music` → **no strip** (only mapped kind, music-venue, is
    unseeded — filtered).
  - `/collections/date-night` → **no strip** (no mapped kinds).

## Deploy steps

1. Merge to `main` — Vercel auto-deploys. No schema/env change, no new URLs.
2. Confirm live: `/collections/festivals-and-markets` shows the "Where to go" strip;
   `/collections/date-night` does not.

## Rollback

Revert this commit — removes the selector, the page block, and the test together.
No data touched.

## Cross-linking pass — status after this item

- ✅ Places ↔ Places (themed "More guides" mesh)
- ✅ Places → events ("See what's happening")
- ✅ events → Places ("Where to go") — **this item; the ↔ loop is now closed**

Remaining Tier 1.2 threads (each a separate item): theme the `/places` index under
`KIND_THEMES`; the neighborhood fill for the P2.2 bridge (curation); and — once the
new winter kinds have ~4 weeks of Search Console data — let observed demand reorder
what gets deepened next.
