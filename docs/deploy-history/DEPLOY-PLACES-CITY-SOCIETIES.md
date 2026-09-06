# Deploy — city historical societies, and a coordinate that was 2.7km wrong (6 Sep 2026)

## Result

**Museums 31 → 36, across 14 cities → 18.** 567 places, 558 inside the box.

Over the two historical-society passes the museum list has gone from **20 in 5
cities to 36 in 18** — which is the difference between a downtown directory and
a metro one.

## Added

| | | |
|---|---|---|
| Chaska History Center | Chaska | Tue/Fri/Sat 1–4 |
| Edina History Museum | Edina | Tue 11–1, Sat 10–12 |
| Maple Grove History Museum | Maple Grove | **free**, 2nd Sunday of the month |
| Lakeville Area Historical Society Museum | Lakeville | Mon & Thu mornings |
| Old Town Hall Museum | Bloomington | **free**, an 1892 town hall |

## The coordinate error this pass caught

Arneson Acres was added yesterday at `44.8731,-93.3736`, from the research
agent. The Edina History Museum shares that site — **same street address, 4711
W 70th St** — and geocoding it independently returned `44.87627,-93.34352`.

**About 2.7 km apart.** The agent's figure was wrong, and nothing would have
surfaced it: the point still landed inside Edina, still inside the coverage box,
and still passed the registry's lat/lng drift guard, which only catches a
transposed or garbage pair. Arneson Acres is corrected.

The lesson is narrow and worth keeping: an agent-supplied coordinate that looks
plausible is not checked merely by looking plausible. The two rows that shared an
address are what made it visible, and that only happened by luck.

## Two sources that needed a second hop

- **Lakeville.** The city page gives the hours but no street address and points
  at `mnlahs.org`, which has it. Both are the society's own; the listing carries
  the city page and the address came from the other.
- **Bloomington.** Originally offered with a **Wikipedia** source. The society's
  own page at `bloomingtonhistoricalsociety.org/about/museum.html` has the
  address, the hours and the fact that it is free — everything Wikipedia was
  standing in for.

## Dakota County: still out

`dakotahistory.org` returned **503 on four attempts across two hours**, on both
the root and the Lawshe Memorial Museum path. That is a site that is down, not a
site refusing us, so there is nothing to work around — it is the last
county-level gap in the seven-county metro and it needs a retry on another day.

## Verify

```bash
npm run places-coverage
```

museum 36 across 18 cities; 567 total. Then open
`/places/museum/edina-history-museum` and `/places/garden/arneson-acres-park` —
they share a site and should now pin to the same spot on the map.

## Rollback

One block at the end of `PLACES` headed "CITY HISTORICAL SOCIETIES", plus `36` →
`31` in the museum count guard. The Arneson Acres coordinate fix is independent
and should be kept regardless — the old value was simply wrong.

## Quality gate

`npx tsc --noEmit` clean · **1941/1941** tests · `npm run build` exit 0 ·
`npm audit` 0 vulnerabilities · all five opened against the operating society's
own site; one existing row corrected on evidence.

## What is left in this seam

Historic Eidem Farm (Brooklyn Park) and Plymouth History Center are the last two
named leads. Eidem has only ever been offered with a blog source, and
`history.plymouthmn.gov` 403s automated requests — both need a human to open the
page rather than more searching.

Gardens remain at 10 and that is close to real; the metro does not have many
public display gardens beyond those listed.
