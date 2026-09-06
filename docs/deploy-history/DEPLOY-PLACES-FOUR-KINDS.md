# Deploy — four kinds swept: orchards, rinks, sledding, pools (6 Sep 2026)

## Result

| kind | before | after | new | leads held |
|---|---|---|---|---|
| orchard | 12 | **14** | 2 + 1 correction | 5 |
| rink | 27 | **34** | 7 | ~20 |
| sledding | 11 | **14** | 3 | 34 |
| pool | 25 | **27** | 2 | 10 |

522 → 544 places overall (disc golf's eight from the earlier pass included).

Every added row was opened by hand against the operator's own page before being
listed. Nothing was taken on the agent's word.

## Orchards first, because the season is open

Requested last, done first: apple picking is running now and the patches open in
a fortnight, while rinks are two months out and pools eight. That was the only
re-ordering.

**The most valuable thing here is not an addition, it is a correction.**
"Sponsel's Minnesota Harvest" in Jordan has been sold and renamed — it is
Ferguson's now. The registry still carried the old name, pointed `sourceUrl` at
`minnesotaharvest.net`, and said `cost: "free"`. The orchard charges admission to
go out to the trees. Caught because the sweep proposed "Ferguson's Minnesota
Harvest" as a *new* orchard and the address matched an existing row exactly:
8251 Old Highway 169 Blvd. The slug is unchanged so existing links still work.

Added: **Applewood Orchard** (Lakeville — one of the few u-picks in Dakota
County) and the **Arboretum AppleHouse** (Victoria — the shop for the University
programme that bred Honeycrisp, open daily until 5 November).

Also caught: **Pine Tree Apple Orchard was already listed.** The candidates tool
reported it missing because the registry's coordinates and OpenStreetMap's differ
by about 1.5 km. The 600 m proximity threshold is tuned to catch near-duplicates;
this one slipped past it and the name check caught it instead.

Held: Brand Farms, Knapton's, Thompsons' Hillcrest and Berry Hill (Nominatim has
no record of these small farms, and guessing coordinates is not allowed);
Victoria Valley Orchard (its domain now redirects to a different business, so it
needs re-sourcing under whatever it is called today); Minnetonka Orchards
(`minnetonkaorchards.com` turns out to be a gardening-content site, not the
orchard).

## Rinks: the index-page problem, and a fix for it

34 leads came back and **18 of them cited `rinkfinder.com/facilities/` or
Minnesota Hockey's find-an-arena page** — directory indexes. Opening one does not
show a reader the rink it is attached to. That is the same defect as citing a
fall-concerts roundup for one show.

So `research-places` now **flags any source URL handed back for more than two
entries** as a probable index page. It is a one-line signal that would have made
this obvious immediately instead of after a manual audit.

Seven arenas whose operator page could actually be read are listed. Apple
Valley's page also revealed a rename in progress: Hayes Park Arena is becoming
**Wings Arena**, so it went in under the new name.

Held: Plymouth Ice Center and both Lakeville arenas (city sites 403 automated
requests), Eagan Civic Arena (cited a generic parks index), Eden Prairie (no
coordinates), plus the dozen index-sourced ones. Also held: six "Outdoor Ice
Rinks" leads that each bundle three or four separate sheets into one row — a
place is one location, and those need splitting first.

## Sledding: only three, and the reason matters

37 leads, **28 of them from family-blog round-ups** or a 2022 PDF. That is not
the agent being lazy — it is where this information actually lives. **Cities do
not publish sledding pages.** A hill is a hill; most park departments never write
it down. It is precisely why the registry only had eleven.

The exception is Three Rivers Park District, which runs winter recreation as a
programme and documents it: Elm Creek, French Regional and Hyland Lake are in,
all three confirmed (French Regional's is lighted and groomed, non-rail sleds
only; Elm Creek's free hill is separate from its ticketed tubing lift).

The other 34 stay leads. The bar for this file is an operator saying "you may
sled here", and a blog listing a hill is not that.

## Pools: the thinnest pass

12 leads, most from magazine round-ups, and the two city sites that would have
settled it (Eden Prairie, Plymouth) refuse automated requests.

South St. Paul's page could be read, and it **corrected the lead**: what came
back as one row, "Northview Pool & Splash Pool", is two pools in two different
parks. Northview is the deep one — three to twelve feet, diving board, climbing
wall. Lorraine is zero-depth for small children, and is already closed for 2026.
Both listed separately, which is what they are.

Pools are the least urgent of the four — the outdoor season is eight months out —
so the next pass has room to do this properly.

## What the four passes say about the method

The agent is a good finder and an unreliable citer. Across the four kinds it
proposed roughly 90 leads; **around 24 survived a source check**. The failures
were not hallucinated places — they were real places with the wrong page
attached, or no page that could be opened at all.

That ratio is the argument for `research-places` writing a draft rather than the
registry. It is also why the index-page flag went in today.

## Verify

```bash
npm run places-coverage
```

orchard 12, rink 34, sledding 14, pool 27, disc-golf 32; 544 total, 535 in box.
Then load `/places/rink` and open one of the seven new arenas.

## Rollback

Each batch is a contiguous, headed block in `lib/places.ts` ("INDOOR ARENAS,
coverage-box sweep", "SLEDDING, coverage-box sweep", "POOLS, coverage-box
sweep"), plus the two orchards and the Ferguson's rename. Deleting a block and
restoring its count in `places.test.ts` reverts it. The orchard rename should be
kept regardless — the old row pointed at a dead source and the wrong price.

## Quality gate

`npx tsc --noEmit` clean · **1941/1941** tests · `npm run build` exit 0 ·
`npm audit` 0 vulnerabilities · every listed row opened against its operator's
page; four count drift-guards updated deliberately rather than loosened.

## Next

The gaps that remain worth a pass, in order: **nature centers** (12, and the
county park districts document these well), **gardens** (9), **museums** (20 but
in only 5 cities), **indoor playgrounds** (13). All four are institution kinds
with real websites, which is the shape that survives a source check.

Sledding and outdoor rinks will not get much further without deciding whether a
well-known local guide counts as a source for a public hill. That is a policy
call, not a research problem.
