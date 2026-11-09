# Deploy — Places: the indoor-play sweep (indoor playgrounds 15 → 36, gyms 17 → 27)

*8 Nov 2026. Registry-only. Built from a parent-sourced list Taren pasted in:
about 55 metro indoor-play spots, from baby play cafés to ninja gyms.*

## What shipped

Taren asked for a new "Indoor Playplaces" category. **It already existed:**
`indoor-playground` ("Indoor Playgrounds & Play Cafés") shipped 14 Aug 2026, and
its big-kid sibling `trampoline-climbing` shipped alongside it. So this item fills
those two kinds out from the list, rather than adding a third that would split the
same search in two.

- **`/places/indoor-playground` — 15 → 36.** New: Little Playdate (Blaine and the
  new St. Paul site), Williston Treehouse, Minnesota Playseum, Chaska Community
  Center Indoor Playroom, Prairie Play Zone, HealthPartners Fieldhouse Indoor
  Playground (Rogers), Playground Plaza, Lava Island, Avery's Adventures, The Play
  Group, Tropical Adventure (Shoreview), The Lookout (Shakopee), Good Times Park
  Woodbury, Planet Imagination, We Rock the Spectrum (Eagan and Woodbury), Millz
  House, and three **free mall play areas** — Southdale, Eden Prairie Center,
  Maplewood Mall.
- **`/places/trampoline-climbing` — 17 → 27.** New: Sky Zone Blaine, Big Air
  Burnsville, Fun City Maplewood, Jump Start Chanhassen, Slick City (Maple Grove,
  Woodbury), Conquer Ninja (Burnsville, Edina, Rosemount), Ninjas United.

Files: `lib/places.ts` (one new dated section at the end of `PLACES`),
`lib/__tests__/places.test.ts` and `lib/reels/cards/__tests__/places-card.test.ts`
(counts). No route, sitemap, or OG code — the kind pages, detail pages, index
card, and sitemap all derive from the registry.

## Decisions (Taren's calls are marked)

- **Big-kid parks go in Trampoline & Climbing, not Indoor Playgrounds** (Taren).
  The indoor-playground page stays about little kids.
- **Free mall play areas are in** (Taren). Rosedale's is not — see below.
- **Edge cases left out** (Taren left all four unchecked): the Hudson, WI pair
  (Giggle Factory, Hudson GNG); party-leaning spots (Pump It Up, Grand Slam, The
  Fun Lab); Rainbow Play Systems and Ninth Street Soccer; Crayola Experience.
  Millz House is a playset showroom much like Rainbow Play Systems, but it was on
  the main list, so it went in — say the word if the two should be treated alike.
- **Two passes, not one.** Four research agents read each operator's own page.
  Then a second, adversarial pass (one agent per entry) re-read every claim and
  tried to refute it. All 31 survived; 27 needed corrections — mostly "plus tax",
  per-pass vs per-child prices, and one-word overstatements ("next to" → "near").
- **Chain template copy does not count.** Lava Island's "foam pits and
  trampolines" and its toddler-area line are word-for-word on the chain's
  Brookfield and Aurora pages and nowhere specific to Eden Prairie, so both were
  cut and the toddler badge withheld. Same rule withheld Little Playdate St. Paul's
  toddler badge (the crawler-area copy predates that site).
- **Badges stay inside each kind's filter set.** Indoor playgrounds filter on
  toddler / café / socks; gyms on trampolines / ninja / climbing / socks. Facts
  that don't fit (Sky Zone Blaine's Toddler Zone, Jump Start's pizza counter) are
  in the intro text instead of a badge the page can't filter.
- **Slick City has no activity badge but socks.** It's dry slides, not
  trampolines, ninja, or climbing, and its intro says so first. No existing kind
  fits better.
- **Two renames for the Instagram card.** The card shows a place's name without
  its parenthesis, so "Indoor Playground (HealthPartners Fieldhouse)" would print
  as a bare "Indoor Playground". Now "HealthPartners Fieldhouse Indoor Playground"
  and "Chaska Community Center Indoor Playroom".
- **Pins read from a map, not guessed.** 17 pins came from two geocoders agreeing
  within 100m. The other 14 (malls, big community centers, single-geocoder hits)
  were read from county address points, OSM building features, or Google/Bing
  place records, with two or more sources agreeing. Planet Imagination uses the
  mall's centre: its street address point sits outside the building.

## Not added, with reasons

| Place | Why |
|---|---|
| Rosedale Center play area | Permanently closed — the mall's own FAQ: replaced by DICK'S Sporting Goods |
| Ninjas United, Maple Grove | Every operator page now prints only the Brooklyn Park address (listed) |
| Sky Zone "Oakdale" | Same park as `sky-zone-st-paul` (595 Hale Ave N, Oakdale) — already listed |
| Kids Castle (Northtown, Maplewood) | No website or Facebook of its own; malls list the name only — no price or hours to verify |
| Community Grounds, Columbia Heights | No current operator page mentions a play area (last mention: 2019) |
| The "closed or not open yet" list | Closed or unopened per Taren's own list; not re-added |

**Facts that differed from the pasted list:** MN Playseum is $9 a person (the
list said $15); Little Playdate states no upper age (the list said through 6);
Community Grounds' hours match neither of its own pages; the Brooklyn Park
Ninjas United is a move, not a second gym; and Conquer Ninja "Eden Prairie" now
operates from 5301 Edina Industrial Blvd, Edina. Aggregator prices the research
turned up were also stale (Avery's, Lava Island, Millz House); the registry uses
the operators' own figures throughout.

## Flags for the next verify pass (perishable or thinly attested)

- **Mall "free" — the weakest claim shipped.** Southdale's "free activity center"
  wording is from an archived 2024 copy of its own play-area page (the live page
  is behind a bot check). Eden Prairie Center and Maplewood Mall never say free
  or charge — they list the areas as amenities (Maplewood's page *does* list a $5
  stroller fee, so a charge would likely appear). Because the page sorts free
  first, these two mall areas lead the list. If that's not comfortable, the lever
  is their `cost`.
- Prairie Play Zone's price: the city lists $5 on one page and $8 on a newer one,
  so the intro names no price. Ages also conflict (9 vs 11), so none is stated.
- Playground Plaza's hours conflict on its own site (closes 6pm vs 9pm) — omitted.
- Rogers' toddler area appears only in renderings marked "proposed" — no badge.
- Williston's rates change January 2027; Planet Imagination's prices sit under a
  "Deal of the Season" heading; Conquer and We Rock schedules move week to week
  (their intros say "check the schedule").

## Side effect: the Instagram Places card (unscheduled)

The weekly Places still card (built and rehearsed, deliberately **not** scheduled
since 19 Oct) only cards a kind with 10+ different businesses. Gyms were 7, so
the tests asserted "never a gym card". They're now 12, so gyms can card. The
tests now say so. **Nothing posts** — the card isn't scheduled.

## Found in passing (not fixed here)

`scripts/places-coord-audit.ts --kind=indoor-playground` confirms two **August**
pins are off by about a kilometre, both geocoders agreeing:
`maple-maze-maple-grove` (we say 45.108,-93.457; suggested 45.10390,-93.44156)
and `eagles-nest-new-brighton` (45.065,-93.202 → 45.06565,-93.19147). Check each
against its source page before editing. None of the 31 new pins was flagged.

## Gate (observed)

- `npx tsc --noEmit` — clean
- `npm test` — **3,290 passed, 155 files**
- `npm run build` — clean; `/places/[kind]` and the detail pages prerender
- `npm audit` — **0 vulnerabilities**
- Local production smoke (`npm run start`): `/places/indoor-playground` 200, "36
  across the Twin Cities metro"; `/places/trampoline-climbing` 200, "27"; a new
  detail page (`/places/indoor-playground/little-playdate-blaine`) 200 with intro
  and source link; Rosedale and Kids Castle absent. Phone-width (375px) render
  checked. The only console errors are the two Vercel analytics scripts, which
  404 off-Vercel by design.

## Deploy steps

1. Commit and push to `main`; Vercel auto-deploys. **No schema change, no env
   change.**
2. Nothing else — the sitemap picks up the 31 new detail URLs on its own.

## Verify checklist (production)

Use the `www` host and follow redirects (the apex 308s, and a bare curl reads an
empty body as "not deployed"). If checking in a browser you've used before,
unregister the site's service worker first — it can serve the previous build.

```bash
curl -sL https://www.citypulsemn.com/places/indoor-playground | grep -o "36 across"
```

```bash
curl -sL https://www.citypulsemn.com/places/trampoline-climbing | grep -o "27 across"
```

- [ ] On a phone: the indoor-playground page shows "36", mall areas carry FREE
- [ ] `/places/indoor-playground/little-playdate-blaine` loads
- [ ] `/places/trampoline-climbing/ninjas-united-brooklyn-park` loads
- [ ] Next Monday's ops digest: sitemap URL count up by 31

## Rollback

`git revert` the commit. Registry data and test counts only; the pages, sitemap
entries, and detail pages disappear with the rows. No data to migrate.
