# Deploy — Places ↔ events bridge ("See what's happening")

*Roadmap v6 Tier 1.2 (cross-linking pass, part 2). Aug 14, 2026.*

## What shipped

Connected the evergreen Places pages to the events calendar. Each `/places/[kind]`
page for an **event-synergistic kind** now shows a "**See what's happening: {Collection}
on the calendar →**" link under its intro, pointing at the most relevant events
collection. This steers Places' SEO traffic toward the calendar — the funnel — which
is the strategic point of Places in the first place.

**Mappings (10 of 19 kinds):**

| Place kind | → Collection |
|---|---|
| Music Venues | Live Music |
| Farmers Markets · Orchards | Festivals & Markets |
| Museums | Arts & Culture |
| Gardens · Nature Centers · Playgrounds · Parks · Indoor Playgrounds · Trampoline & Climbing | Family Fun |

The other 9 kinds (golf, disc golf, dog parks, rinks, sledding, ski/tubing, beaches,
splash pads, pools) carry **no** event link — honestly, they aren't where you'd look
for what's on the calendar, so a bridge there would be noise.

## Design decisions

- **Link the collection *page*, not a live query.** The bridge is a static link to
  `/collections/<slug>`; the Places page runs **no DB query** (ENGINEERING rule 2
  stays satisfied — the collection page does its own ISR-cached query). No coupling,
  no build-time DB.
- **Direction: Places → events (this half).** Places is the evergreen top-of-funnel;
  pushing that traffic to the calendar serves the conversion goal. The reverse
  (collection → Places guide) is a separate, cheaper follow-up.
- **Honest restraint.** Only genuinely event-synergistic kinds map. A splash pad or a
  dog park isn't an events destination, so it gets no link rather than a forced one.
- **Drift-guarded.** `KIND_EVENT_COLLECTION` lives in `lib/places.ts` as plain slug
  strings (no import of `lib/collections`, so no circular dependency). Two golden
  tests assert: every key is a real kind, and **every mapped slug resolves in
  `COLLECTIONS`** via `getCollection` — so a renamed/removed collection fails CI
  instead of shipping a dead link.

## Files

- `lib/places.ts` — `KIND_EVENT_COLLECTION` map.
- `app/places/[kind]/page.tsx` — resolves the collection via `getCollection` and
  renders the bridge under the intro when the kind is mapped.
- `app/globals.css` — `.places-event-link` (gold, centered, underline-on-hover).
- `lib/__tests__/places.test.ts` — 2 golden tests (valid kinds + slugs resolve).

## Verification (observed)

- `npx tsc --noEmit` — clean.
- `npm test` — **1015 passed**; places suite 48/48 incl. the 2 new bridge tests.
- `npm run build` — clean, 41/41 static pages.
- `npm audit` — **0 vulnerabilities**.
- **Live smoke:**
  - `/places/farmers-market` → bridge reads "See what's happening: **Festivals &
    Markets** on the calendar →", href `/collections/festivals-and-markets`. Correct.
  - `/places/beach` (unmapped) → **no bridge**. Honest restraint confirmed.
  - `/collections/festivals-and-markets` → renders (h1 "Festivals & Markets", no
    error) — the bridge target is a live, valid route.

## Deploy steps

1. Merge to `main` — Vercel auto-deploys. No schema/env change, no new URLs.
2. Confirm live: `/places/farmers-market` (and the other 9 mapped kinds) show the
   calendar bridge; `/places/beach` does not.

## Rollback

Revert this commit — removes the map, the page block, the styles, and the tests
together. No data touched.

## Follow-ups (the rest of cross-linking)

- **Reverse link: events → Places.** On collection pages (or event pages), a "Where
  to go" strip pointing back to the matching Places guide(s) — completes the ↔. Uses
  the same `KIND_EVENT_COLLECTION` map inverted; a small, cheap item.
- **Theme the `/places` index** under `KIND_THEMES` (deferred from the mesh item).
- **Neighborhood fill** for the P2.2 bridge (curation, separate).
- Once the new winter kinds have ~4 weeks of Search Console data, let observed demand
  reorder what gets deepened next.
