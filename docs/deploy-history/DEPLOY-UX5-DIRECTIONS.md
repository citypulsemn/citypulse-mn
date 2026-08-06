# Deploy UX5 — "get me there" (directions)

*August 2026. UX roadmap item 5. The most common phone action on an event —
"how do I get there?" — had no answer: the address was plain text and the map
thumbnail dumped you on the site-wide map of every event.*

## What shipped

- **[lib/event-view.ts](../../lib/event-view.ts): `directionsUrl(event)`** —
  pure, golden-tested. Builds a Google Maps **Directions** deep-link
  (`/maps/dir/?api=1&destination=…`, the cross-platform form that opens the
  native maps app on iOS and Android). Prefers the street address (a destination
  the user recognizes), falls back to coordinates, then the venue name; null only
  when there's nothing to route to.
- **The venue address is now a directions link**
  ([EventDetailBody](../../components/EventDetailBody.tsx)) — "824 Hennepin Ave,
  Minneapolis, MN · **Directions ↗**", opening in a new tab. It lives in the
  shared body, so both the event page AND the in-app modal get it.
- **The map thumbnail opens directions**, not the site-wide map
  ([app/event/[id]/page.tsx](../../app/event/[id]/page.tsx)) — tapping the venue
  map now routes you there. Falls back to `/?view=map` only if there's nothing
  to route to.

## Verification (observed, not intended)

- Live on a dev server: the address rendered as
  `824 Hennepin Ave, Minneapolis, MN · Directions ↗` → href
  `https://www.google.com/maps/dir/?api=1&destination=824%20Hennepin%20Ave%2C%20Minneapolis%2C%20MN`,
  `target="_blank"`. Correct, encoded, opens maps.
- Tests +6 (826/826): `directionsUrl` (address preferred, URL-encoding,
  coords fallback, venue-name fallback, null when empty) + wiring tripwires
  (body address is a `dir-link`, page map uses `directions ?? "/?view=map"`).
- Gate: tsc clean · 826/826 · build clean · audit 0.
- **Not verified locally:** the map-thumbnail directions href — the dev env has
  no Mapbox token, so `staticMapUrl` returns null and the thumbnail isn't
  rendered. The change is one line and tripwire-pinned; it renders in prod
  (token set on Vercel). On the checklist below.

## Deploy steps

Push to `main`. Code-only, no schema.

## Verify checklist

- [ ] On a phone, open an event → tap the address ("… · Directions ↗") → your
      native maps app opens with directions to the venue.
- [ ] Tap the venue map thumbnail → same (directions), not the site-wide map.
- [ ] Open an event in the in-app modal (from the calendar) → the address is a
      directions link there too.

## Rollback

`git revert`. Additive (new helper + link wiring); the map falls back to its old
`/?view=map` behavior.
