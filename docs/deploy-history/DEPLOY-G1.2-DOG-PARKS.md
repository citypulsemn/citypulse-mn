# Deploy — G1.2: Dog Parks, a new Places kind (58 entries)

*August 2026. Tier 1 (audience / SEO). Code + data only, no schema.*
*(Shipped in two commits: the initial 57, then Bunker Hills added — 58 total.)*

## What shipped

A brand-new `/places/dog-park` page — **58 verified off-leash dog areas across
the metro** — continuing the G1.2 evergreen-sitemap push. Each entry is checked
against an official park-agency or city page; a new indexable URL targets a fresh,
high-demand "dog park near me" search.

- **New `PlaceKind` "dog-park"** in [lib/places.ts](../../lib/places.ts): union +
  `KIND_META` + 57 `Place` rows. Proves the "new kind = data only" architecture
  again — **zero page/route code**: `/places` grew a Dog Parks card via
  `kindsWithPlaces`, `/places/dog-park` prerendered from the `[kind]` route, and
  the sitemap auto-picked it up.
- **`DOG_WARM` season const** (April–October) for the handful of hockey-rink /
  ski-trail conversions that genuinely close for winter (Staring Lake, the two
  New Hope, the two Golden Valley rink parks). The other 52 are `YEAR_ROUND`.
- **Editorial intro** for the kind in [lib/editorial.ts](../../lib/editorial.ts).

### Coverage (57)
- **Minneapolis (MPRB): 9** — all require an MPRB off-leash permit.
- **Three Rivers Park District: 10** — all require a Three Rivers dog pass.
- **St. Paul + Ramsey County: 10** — all free.
- **North/west suburbs: 16** — Bloomington, Eden Prairie, Plymouth, Brooklyn Park,
  Blaine, Crystal, New Hope, Golden Valley, St. Louis Park, Edina, Richfield, plus
  **Bunker Hills** (Andover — joint Anoka County / Coon Rapids / Andover, free,
  6.5 fenced acres; verified against the Coon Rapids .gov facility page).
- **South/east suburbs: 13** — Burnsville, Woodbury, Cottage Grove, Eagan,
  Lakeville, Chaska, Shakopee, Savage, Inver Grove Heights, Oakdale, Stillwater,
  Hastings, South St. Paul.

~34 free / 23 permit-or-pass — the free ones lead the free-first sort.
Coordinates are park-level from each real street address (not surveyed).

## Honest exclusions (not invented, deliberately left out)

- ~~Bunker Hills Dog Park~~ — **now included** (verified against the official
  Coon Rapids .gov facility page: Hanson Blvd & 133rd Ave, Andover; free; 5am–10pm;
  joint Anoka County / Coon Rapids / Andover).
- **Brooklyn Park "Environmental Nature Area"** — almost certainly the same
  physical area as Three Rivers' Mississippi Gateway (10201 vs 10360 W River Rd);
  dropped to avoid a duplicate.
- **St. Paul**: Kellogg Mall, Pedro Park, Lower Landing dog runs — officially
  listed but under-verified (no confirmed size/fence/address).
- **Minnetonka** — off-leash plan adopted (2025) but nothing built yet.
- **Rosemount (Dakota Woods), Chanhassen (Lake Minnewashta)** — county parks, not
  city; **Apple Valley** (Delaney/Huntington) and **Lakeville** signed zones —
  seasonal hockey-rink or in-park off-leash, not dedicated fenced dog parks.

## Verification

Gate: `tsc` clean · **1002** tests · `npm run build` clean (`/places/dog-park`
statically generated) · `npm audit` 0. The Places drift guards pass for all 58
rows: unique slugs, `https` official sources, `verifiedAt` format, intro
length + banned-word check, and the **metro bounding-box** coordinate check;
`kindsWithPlaces` exact-list test updated to include `dog-park`.

**Browser-verified (dev):** `/places/dog-park` renders the free-first list with
FREE/PAID badges and FENCED / UNFENCED / SMALL DOG AREA / WATER ACCESS tags, the
intro, and per-row official-source links; `/places` shows the Dog Parks card. No
new console errors. (Verified at 57; Bunker Hills added after as a single
guard-validated row — same page, count now 58.)

## Deploy steps

Push to `main`. Code + data only, no schema, no env. The sitemap gains
`/places/dog-park` automatically → ops-digest Index count ticks up.

## Rollback

`git revert`. Pure registry addition; reverting removes the kind and its page.
