# Deploy — the institution kinds: nature centres, gardens, museums, indoor play (6 Sep 2026)

## Result

| kind | before | after | in cities |
|---|---|---|---|
| nature-center | 12 | **16** | 12 → 16 |
| museum | 20 | **24** | 5 → 9 |
| indoor-playground | 13 | **15** | 11 → 13 |
| garden | 9 | **10** | 5 → 6 |

544 → 555 places. Museums went from five cities to nine, which was the point —
twenty museums almost all inside the two downtowns is a directory of downtown,
not of the metro.

## What was added

**Nature centres.** Gateway Center at Mississippi Gateway (Brooklyn Park — new
building, deck onto the Treetop Trail, free borrow-a-backpack kits), Silverwood
Visitor Center (St. Anthony — a nature centre that is also an art gallery and a
café), Harriet Alexander (Roseville — 52 acres of marsh with boardwalk, free),
Blaine Wetland Sanctuary (500+ acres, boardwalk, free).

**Museums.** The Works (Bloomington — hands-on engineering for 5–12s, $14),
Oliver Kelley Farm (Elk River — a working 1860s farm, $12), Wings of the North
(Eden Prairie — aircraft in a hangar at Flying Cloud, weekends 11–3), Bruentrup
Heritage Farm (Maplewood — an 1891 farm, tours by appointment).

**Indoor playgrounds.** Kids Empire Bloomington and Roseville.

**Gardens.** Arneson Acres (Edina — 28 separate gardens on one block).

## Two duplicates the sweep would have created

Caught by reading the registry rather than trusting the leads:

- **Gibbs Farm** came back as a *garden*. It is already listed as a *museum*.
- **Edinborough Park** came back as a *garden*, while Adventure Peak inside it
  is already an *indoor playground*.

Both are the same failure shape: a place that exists in the registry under a
different kind reads as missing to a per-kind sweep.

## What was held, and why

52 leads; 11 listed. The rest failed a source check, and the failures are
consistent enough to be worth naming:

- **Wikipedia and blogs as sources.** Bloomington Historical Society cited
  Wikipedia; Historic Eidem Farm cited `nwmetrolife.com`; Little Playdate and
  Big Air cited `thriftyminnesota.com` and `twincitiesfamily.com`. Not operator
  pages.
- **An index instead of a page.** Oakland Cemetery cited
  `mngardens.horticulture.umn.edu/all-gardens` — the directory, not the garden.
- **A source that does not resolve.** The Thomas C. Savage Visitor Center cited a
  DNR URL that renders a generic state-parks template naming no park at all.
- **A source that names something else.** Minnesota Zoological Gardens cited a
  zoo blog post about the Tropics Trail.
- **Sites that refuse us.** Plymouth History Center, Eden Prairie Outdoor Center
  (403 after a redirect), Shakopee's indoor playground (404), Lava Island (TLS
  certificate does not cover `www.`), Peekabooboo's (empty response).

Every one of those is a real place. None of them is a listable row yet.

## Verify

```bash
npm run places-coverage
```

nature-center 16, museum 24, indoor-playground 15, garden 10; 555 total, 546 in
box. Then open `/places/museum` — the new four are outside Minneapolis and
St. Paul, which is the visible change.

## Rollback

One contiguous block at the end of `PLACES` in `lib/places.ts`, headed
"INSTITUTION KINDS, coverage-box sweep". Deleting it and restoring the four
counts in `places.test.ts` reverts everything here.

## Quality gate

`npx tsc --noEmit` clean · **1941/1941** tests · `npm run build` exit 0 ·
`npm audit` 0 vulnerabilities · every listed row opened against its operator's
own page; four count drift-guards updated deliberately, detail counts left
untouched because the new rows carry no curated `details` yet.

## Where the remaining gaps actually are

Museums are still concentrated: 24 across 9 cities. The county historical
societies (Carver, Scott, Dakota, Chaska, Maple Grove, Golden Valley, Edina,
Lakeville, Warden's House in Stillwater) all came back with plausible operator
URLs and are the obvious next batch — they just need the source checks that ran
out of room here.

Gardens remain the thinnest kind at 10, and genuinely so: the metro does not
have many public display gardens beyond the ones already listed.
