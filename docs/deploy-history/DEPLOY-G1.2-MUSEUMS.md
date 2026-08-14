# Deploy — G1.2: Museums, a new Places kind (13)

*August 2026. Tier 1 (audience / SEO). Code + data only, no schema.*

## What shipped

A new `/places/museum` page — **13 metro museums** (art, science, history, and
the wonderfully specific), each verified against its official page. High-search
category, another evergreen indexable Places URL, and the natural home for the
Bell Museum (which was deliberately excluded from nature-centers and gardens as
"a museum, different category" — now it has one).

- **New `PlaceKind` "museum"** in [lib/places.ts](../../lib/places.ts): union +
  `KIND_META` + editorial intro + 13 rows. All `YEAR_ROUND`. Zero page/route code.

### Coverage (13) — 3 free / 1 donation / 9 paid
- **Free:** Minneapolis Institute of Art (Mia) · Weisman Art Museum ·
  Minnesota Museum of American Art
- **Donation:** Hennepin History Museum
- **Paid:** Science Museum of Minnesota · Walker Art Center · Minnesota History
  Center · Bell Museum · The Bakken · The Museum of Russian Art · Mill City
  Museum · American Swedish Institute · Minnesota Children's Museum

The intros note the many free days/evenings (Walker Thu eve, History Center Tue
eve, Bell Sundays, etc.). Free-first sort leads with the free three.

## Verification

Gate: `tsc` clean · **1002** tests · `npm run build` clean (`/places/museum`
statically generated) · `npm audit` 0. Places drift guards pass for all 13 rows
(unique slugs, `https` official sources, intro length + banned-word check, metro
bounding box); `kindsWithPlaces` exact-list test updated to include `museum`.

**Browser-verified (dev):** `/places/museum` renders "13 across the Twin Cities
metro", free-first (Mia / MMAA / Weisman → Hennepin *Donation* → 9 *Paid*), with
type tags (ART / SCIENCE / HISTORY / NATURAL-HISTORY / PLANETARIUM / KIDS) and
official-source links; `/places` shows the Museums card ("13 spots →"). No
console errors.

## Data note

Caught a common mislabel during research: the "2600 Park Ave" address some guides
attach to the Bell Museum is actually the **American Swedish Institute** (Turnblad
Mansion). The current Bell Museum is at **2088 Larpenteur Ave W, Falcon Heights**
(it moved to the U's St. Paul campus in 2018). Both are stored correctly.

## Deploy steps

Push to `main`. Code + data only, no schema, no env.

## Rollback

`git revert`. Pure registry addition; reverting removes the kind and its page.
