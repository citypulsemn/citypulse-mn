# Deploy — G1.2: deepen Parks, Playgrounds & Rinks

*August 2026. Tier 1 (audience / SEO). Code + data only, no schema.*

## What shipped

A deepening pass on the three under-seeded **curated** Places kinds — more
destination-worthy entries, each verified against its official page. Deliberately
**still curated**, not exhaustive: the unbounded "every neighborhood park /
playground / flooded rink" tail is the job of the OSM bulk map layer, not the
hand-verified registry.

### Parks 12 → 21 (+9)
Regional and state parks worth crossing town for:
- **State parks (paid, DNR permit):** Fort Snelling · Afton · William O'Brien
- **Free:** Minnesota Valley National Wildlife Refuge (Bloomington) · Mississippi
  Gateway Regional Park (Brooklyn Park) · Lake Nokomis Park (Minneapolis) · Phalen
  Regional Park (St. Paul) · Lilydale Regional Park (St. Paul) · Baker Park
  Reserve (Maple Plain)

### Playgrounds 13 → 15 (+2)
- **Fun For All Playground** (Shakopee, Lions Park) — fully inclusive, free
- **Edinborough Park / Adventure Peak** (Edina) — the metro's biggest indoor
  park, warm all winter (paid)

### Rinks 8 → 11 (+3)
- **Wells Fargo WinterSkate** (Rice Park, St. Paul) — free outdoor downtown rink (WINTER)
- **TRIA Rink** (St. Paul) — the Wild's downtown practice rink, public open skate (paid)
- **Schwan Super Rink** (National Sports Center, Blaine) — 8 sheets, public open skate (paid)

## Why still curated

Parks, playgrounds, and rinks stay a curated "destination" set on purpose. Adding
every neighborhood park would (a) be unbounded and unverifiable by hand and (b)
duplicate the OSM `park`/`playground` bulk map layer that already renders the full
set at zoom. This pass adds the marquee places a visitor would actually cross town
for; it does not attempt "every one."

## Verification

Gate: `tsc` clean · **1002** tests · `npm run build` clean · `npm audit` 0. Places
drift guards pass for all 14 new rows (unique slugs, `https` official sources,
intro length + banned-word check, metro bounding box). No `kindsWithPlaces` change
(all three kinds were already seeded).

**Browser-verified (dev):** `/places/park` → "21 across the metro" (Fort Snelling,
Lake Nokomis present); `/places/playground` → "15" (Edinborough, Fun For All);
`/places/rink` → "11" (Super Rink, WinterSkate). No console errors.

## Deploy steps

Push to `main`. Code + data only, no schema, no env.

## Rollback

`git revert`. Pure registry additions.
