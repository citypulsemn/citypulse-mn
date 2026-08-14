# Deploy — Places cross-linking mesh (themed "More guides")

*Roadmap v6 Tier 1.2 (compounding Places SEO — the cross-linking pass). Aug 14, 2026.*

## What shipped

Turned the 18 Places kind pages from SEO **leaves** into an interlinked **mesh**.
Each `/places/[kind]` page now carries a **"More Twin Cities guides"** section
linking to its *thematic sibling* kinds — pure internal-link equity, zero new
curation. A rink links to Sledding and Ski & Tubing; a museum links to Indoor
Playgrounds, Trampoline & Climbing, Farmers Markets, and Orchards.

**Why this was the gap:** each kind page previously linked out to nothing but the
external source link — it received link equity (from the `/places` hub + sitemap)
and passed none along. Search engines reward interlinked topical clusters; a hub
that spokes out to leaves, with no leaf-to-leaf links, leaves that value on the
table. The mesh fixes it across all 18 kinds at once, with no per-entry work.

## Design decisions

- **Themed, not a wall of links.** Kinds are grouped into six themes (Summer &
  water · Winter · Rainy-day & indoor · Parks & outdoors · Get out & play · Food &
  culture); a page links to the *other* kinds in its theme(s). Contextual, relevant
  links beat linking every page to every other page — better for readers and for
  how search engines read topical relevance. A kind may sit in more than one theme
  (ski-hill is Winter + active; museum is Rainy-day + Food & culture), so it links
  to all its siblings.
- **Pure logic, drift-guarded.** `KIND_THEMES` (the map) and `relatedKinds(kind)`
  (the selector) live in `lib/places.ts`. `relatedKinds` excludes the kind itself,
  de-dupes across themes, and **filters out kinds with no places** — so the empty
  `music-venue` kind never appears as a dead link (honest emptiness). Three golden
  tests assert: every theme references only real kinds; **every seeded kind is in
  ≥1 theme** (no dead-end leaf page); `relatedKinds` returns valid, non-empty,
  self-excluding, dup-free siblings.
- **No new data, no new pages.** This is entirely internal wiring over the existing
  registry — no entries added, no routes added, no schema.

## Files

- `lib/places.ts` — `KIND_THEMES` (the six-theme map) + `relatedKinds(kind)` pure
  selector.
- `app/places/[kind]/page.tsx` — renders the "More Twin Cities guides" `<nav>` when
  `relatedKinds` is non-empty.
- `app/globals.css` — `.related-guides` pill styles (navy/gold, gold on hover).
- `lib/__tests__/places.test.ts` — 3 golden tests for the mesh.

## Verification (observed)

- `npx tsc --noEmit` — clean.
- `npm test` — **1013 passed** (72 files); places suite 46/46 incl. the 3 new mesh
  tests.
- `npm run build` — clean, 41/41 static pages.
- `npm audit` — **0 vulnerabilities**.
- **Live smoke:**
  - `/places/rink` → "More Twin Cities guides": **Sledding Hills** + **Ski & Tubing
    Hills** (the Winter theme). Correct.
  - `/places/museum` (multi-theme) → **Indoor Playgrounds, Trampoline & Climbing**
    (Rainy-day) + **Farmers Markets, Orchards & Patches** (Food & culture). Correct.
    **music-venue (0 places) did NOT appear** — the empty-kind filter works.
  - Clicked the Farmers Markets link on the museum page → landed on
    `/places/farmers-market` (h1 "Farmers Markets"). End-to-end navigation confirmed.

## Deploy steps

1. Merge to `main` — Vercel auto-deploys. No schema/env change, no new URLs.
2. Confirm live: any `/places/[kind]` page shows the "More Twin Cities guides" pills
   linking to sibling kinds.

## Rollback

Revert this commit — removes the section, the styles, `KIND_THEMES`/`relatedKinds`,
and the tests together. No data touched.

## Follow-ups (the rest of the cross-linking pass, as separate items)

- **Places ↔ events.** For event-synergy kinds (nature centers, gardens, breweries,
  music venues), link the kind page to relevant calendar collections / the venue's
  upcoming events. Higher design cost (needs a kind→collection mapping); a distinct
  item.
- **Theme the `/places` index.** Group the hub grid under the same `KIND_THEMES`
  headers for browse UX + link context (low-risk; deferred to keep this item tight).
- **Neighborhood fill.** Most entries carry `neighborhood: null`, so the P2.2
  neighborhood↔places bridge is dark for them. Filling neighborhood keys is curation
  (not a cross-linking-wiring item) — a separate pass if wanted.
