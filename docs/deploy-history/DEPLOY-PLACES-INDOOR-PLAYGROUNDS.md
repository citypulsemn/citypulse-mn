# Deploy — Places: Indoor Playgrounds & Play Cafés (a new kind, 0 → 13)

*Roadmap v6 Tier 1.2 (compounding Places SEO). Aug 14, 2026. One item, finished.*

## What shipped

A new Places kind — **`indoor-playground`** — with **13 verified entries** across
four metro counties, live at `/places/indoor-playground`. Indoor drop-in play for
the cold months: private soft-play barns, city community-center playgrounds, and
play cafés. It's the first of the **winter guide window** (build Sep–Oct so it
indexes and ranks before December, when the parent search "indoor playground near
me" spikes).

- **Kind:** `indoor-playground`, label "Indoor Playground", plural "Indoor
  Playgrounds & Play Cafés". Season `YEAR_ROUND` (indoor — no closed-banner), cost
  mix (11 paid, 2 free play cafés).
- **13 entries**, 4 counties (Hennepin, Ramsey, Dakota, Washington), each verified
  against the operator's own current page (city `.gov` for community centers,
  business homepage otherwise): Good Times Park (Eagan) · Wild Things (Lakeville) ·
  Adventure Peak / Edinborough Park (Edina) · The Blast (Eagan) · Maple Maze (Maple
  Grove) · Lookout Ridge (Woodbury) · Eagles Nest (New Brighton) · Brookview
  Backyard (Golden Valley) · K.U.B.E. (Plymouth) · InnerActive ×2 (Mounds View,
  Plymouth) · Sovereign Grounds (Minneapolis, free) · Rebe's Play Cafe (St. Paul,
  free).

## Design decisions

- **Registry data in `lib/places.ts`, not a table** — same as every other kind
  (drift-guard-tested, versioned, zero DB reads, prerenders fine).
- **Scope kept tight.** Included: dedicated soft-play spaces, play cafés, and
  community-center indoor playgrounds open for public drop-in. **Excluded** (each
  is or will be its own kind): trampoline/ninja/climbing gyms, children's museums,
  indoor water parks, and party-only rental spaces. This keeps the directory
  honest and the kind coherent.
- **`YEAR_ROUND`, not a winter season.** They're open all year; the *demand* is
  seasonal but the *place* isn't — so no "closed for the season" banner (that would
  be dishonest for a January-open playground).
- **`neighborhood: null` on all 13.** The two in-city entries (Standish, Mac-
  Groveland) aren't among the 16 curated districts, and every suburb resolves to
  null by design — the city name says where. No risk of a bad neighborhood key.
- **Honest sourcing.** Two play cafés (Sovereign Grounds, Rebe's) were confirmed
  as currently operating via a resolving official domain + recent (2026) active
  listings rather than a direct page read (their sites refused automated fetch /
  are JS-rendered); the `sourceUrl` still points at the official homepage. Every
  other entry was confirmed on the operator's own live page. No price was invented
  for Adventure Peak (its page lists passes but no dollar figure), so its intro
  says "passes" without a number.

## Files

- `lib/places.ts` — `indoor-playground` added to the `PlaceKind` union + `KIND_META`
  (TypeScript exhaustiveness forces these together), and the 13-entry block at the
  end of the `PLACES` registry.
- `lib/editorial.ts` — `PLACES_KIND_INTRO["indoor-playground"]` editorial header
  (house voice, no banned words).
- `lib/__tests__/places.test.ts` — `"indoor-playground"` added to the
  `kindsWithPlaces` exact-list drift guard (sorted position).
- **No route/sitemap/OG code** — `/places/[kind]`, the `/places` index, the
  OpenGraph image, `generateStaticParams`, and `sitemap.xml` all derive from the
  registry automatically. A new kind with entries lights them all up.

## Verification (observed, not intended)

- `npx tsc --noEmit` — clean.
- `npm test` — **1010 passed** (72 files); `places.test.ts` 43/43 including the new
  drift-guard line.
- `npm run build` — clean; the page prerenders via `generateStaticParams`.
- `npm audit` — **0 vulnerabilities**.
- **Live smoke** (`/places/indoor-playground`, fresh dev server): HTTP 200, title
  "Indoor Playgrounds & Play Cafés in the Twin Cities, Mapped", h1 correct, "**13**
  across the Twin Cities metro," a 13-item numbered list with pins matching list
  order, **free-first sort confirmed** (Rebe's + Sovereign Grounds first, then paid
  alphabetically), FREE/PAID cost badges, 6+ official source links, canonical
  `https://www.citypulsemn.com/places/indoor-playground`. All page/CSS/chunk/font
  network requests 200 OK.
  - *Note:* the interactive map renders its token-absent `places-map-note` fallback
    in dev (no Mapbox token locally) — pre-existing, kind-independent behavior; the
    map plots `placesByKind` and works in production where the token is set.
  - *Note:* a stale console error citing `EventsExplorer.tsx` line 474 (`<footer>`)
    is a phantom buffer from an earlier build/dev `.next` collision — the on-disk
    file is the committed a11y-fixed version (`<div className="explorer-tagline">` /
    `</main>`), and tsc + build both pass. Not a real error.

## Deploy steps

1. Merge to `main` — Vercel auto-deploys. **No schema change, no env change**
   (registry is code).
2. After deploy, confirm live: `https://www.citypulsemn.com/places/indoor-playground`
   returns the 13-entry page, and the `/places` index shows the new "Indoor
   Playgrounds & Play Cafés" card.
3. The sitemap gains `/places/indoor-playground` automatically; Monday's ops digest
   Index line should tick up by one URL.

## Post-ship ritual (ops, ~30 min, no code — per the Places standing rules)

- Mirror as a Google Maps list in the CityPulse account (manual — no API), link
  "Open in Google Maps" is a future page affordance.
- One digest mention + one Instagram "mapped" slot when convenient.
- **Re-verify cadence:** evergreen kind → twice a year (next: ~Feb 2026, before the
  late-winter break rush). Watch for closures (one candidate, MiniSota Play Cafe,
  already closed in Apr 2026 and was correctly excluded).

## Rollback

Pure additive code. To pull the kind: revert this commit (removes the union member,
`KIND_META`, intro, entries, and the test line together). No data migration, no
orphaned rows — the page, index card, sitemap entry, and OG image all disappear
with the registry entries.

## Follow-ups (not this item)

- Next winter kinds in priority order (Roadmap v6 Tier 1.2): **ice rinks** (expand
  the existing 8 with outdoor neighborhood rinks) → **ski/tubing** (expand the 4) →
  **trampoline/climbing gyms** (a separate kind, deliberately excluded here).
- North-metro gap: **The Fun Lab / Ballocity (Blaine, Anoka County)** is a real,
  open soft-play option held back only because it's FEC-leaning — reconsider if we
  want an Anoka County anchor.
