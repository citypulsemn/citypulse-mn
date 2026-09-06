# Deploy — county and city historical societies (6 Sep 2026)

## Result

**Museums 24 → 31, across 9 cities → 14.**

The city count is the number that matters. Twenty-four museums concentrated in
Minneapolis and St. Paul described the two downtowns; county historical
societies sit in county seats — Waconia, Shakopee, Anoka, Stillwater — so each
one is both a museum and a piece of metro coverage.

562 places total, 553 inside the box.

## Added

| | | |
|---|---|---|
| Carver County Historical Society Museum | Waconia | weekdays + Saturday mornings |
| Scott County Historical Society | Shakopee | **free**, Tue–Sat |
| Anoka County Historical Society | Anoka | exhibit hall + county archive |
| Washington County Heritage Center | Stillwater | year-round, Tue–Sat |
| Warden's House Museum | Stillwater | May–Oct, guided tours only |
| Hay Lake School & Erickson Log Home | Marine on St. Croix | May–Oct, 1896 schoolhouse + log home |
| Golden Valley History Museum | Golden Valley | Saturdays 11–3 |

## Two things going to the operator's own site bought

**Washington County runs three public sites, not one.** The sweep had found only
the Warden's House, and had sourced it to a *chamber-of-commerce member listing*.
Going to `wchsmn.org` fixed the source and turned up the Heritage Center and Hay
Lake School as well — a third of this batch came from one corrected citation.

**`ackhistory.org` is not the Anoka County Historical Society.** It is the
Nantucket historical association — the TLS certificate names
`anneramsdellcongdon.ackhistory.org` and `festivaloftrees.ackhistory.org`, which
is what gave it away. The right site is `anokacountyhistory.org`. A plausible
domain is not a source; opening it is.

## The one county still missing

**Dakota County.** `dakotahistory.org` returned 503 on two attempts an hour
apart. It is the only county-level gap left in the seven-county metro (Hennepin
and Ramsey were already covered by the Hennepin History Museum and Gibbs Farm).
That is a retry, not a research problem — worth picking up next time the site is
up.

## Coordinates

Nominatim missed three of the seven on a full street address and found all three
on a variant: Carver on `555 1st Street West, Waconia`, Anoka on the institution
name, Hay Lake on `Hay Lake School, Scandia`.

Worth noting for the record: Hay Lake's operator gives the address as Marine on
St. Croix, while Nominatim places it inside Scandia's boundary. Both are true —
a rural mailing address and a municipal boundary need not agree. The listing uses
the operator's city, because the operator is the source.

## Verify

```bash
npm run places-coverage
```

museum 31 across 14 cities; 562 total. Then open `/places/museum` — more than
half the list is now outside Minneapolis and St. Paul.

## Rollback

One block at the end of `PLACES` headed "COUNTY & CITY HISTORICAL SOCIETIES",
plus restoring `31` to `24` in the museum count guard in `places.test.ts`.

## Quality gate

`npx tsc --noEmit` clean · **1941/1941** tests · `npm run build` exit 0 ·
`npm audit` 0 vulnerabilities · all seven opened against the operating society's
own site; the museum drift-guard updated deliberately with detail counts left
untouched.

## Still held from the museum sweep

City-level societies with plausible operator URLs that have not had their source
check yet: Edina History Museum (at Arneson Acres, which this registry now lists
as a garden), Lakeville Area Historical Society, Maple Grove Historical
Preservation Society, Chaska History Center, Plymouth History Center (403s),
Bloomington Historical Society (only ever offered a Wikipedia source), Historic
Eidem Farm (only ever offered a blog).
