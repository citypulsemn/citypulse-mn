# Deploy — two museum calendars, and where the sweep stopped (26 Aug 2026)

## What shipped

The Bell Museum and the Science Museum of Minnesota, on the same Tribe adapter
the Park Board uses. **35 verified listings added.**

More usefully, this deploy establishes **why the remaining categories cannot be
finished the way the first four were**, with the probe results to back it.

## The ask was "do the rest"

Arts, festival, food and weird: 419 unverified listings. The first thing worth
knowing is their *shape*.

**419 listings across 227 distinct venues. The top 26 venues hold 165 of them —
39%.** Sports was eight teams. Music was First Avenue's six rooms. This is a long
tail, and a long tail cannot be sourced venue by venue.

## So the sweep aimed at the head, and mostly missed

Eighteen sites probed for a machine-readable calendar — The Events Calendar REST
API, schema.org JSON-LD, RSS:

| Result | Sites |
|---|---|
| **Usable Tribe API** | Bell Museum (33), Science Museum (17) |
| Refuses us (403) | Guthrie, Chanhassen Dinner Theatres, Renaissance Festival, Hennepin County |
| Rate-limited (429) | Minneapolis Institute of Art |
| JS app, private back-end | Walker Art Center, Children's Theatre, Can Can Wonderland |
| No API, no JSON-LD | Artistry/Bloomington, St Paul, Minneapolis, State Fair, MN Zoo, Three Rivers, MNHS |

Not one published schema.org event markup. The pattern that made the Park Board
work — a civic or nonprofit WordPress site with The Events Calendar — is simply
not what the big arts institutions run.

## What landed

| | Before | After |
|---|---|---|
| family | 240 upcoming, 73 verified | **275, 108 verified (39%)** |
| arts | 212, 13 verified | 212, **17 verified** |
| site | 1262, 478 (38%) | **1297, 517 (40%)** |

Bell Museum: 28 added, 3 confirmed. Science Museum: 7 added, 1 confirmed.

## Design notes

**Both add-and-confirm only.** A museum runs exhibitions alongside programmes and
rents its rooms out, so "nothing on their calendar that day" is not the claim a
concert hall's dark night makes. This importer must not be able to hide a real
listing on that basis.

**The Science Museum's venue is pinned** because their feed publishes **no
coordinates at all**, for any venue — so nothing there could register itself the
way a park does. Their offsite State Fair entries are skipped for the same
reason.

**Their tags are housekeeping, not categories** — "Offsite", "Tour", "Free with
admission" — so the venue's default category stands rather than a guess at a
title. This is the opposite of the Park Board, whose taxonomy is genuinely
categorical.

**`venuesFromFeed`** was factored out of the Park Board's version so a pinned
base and a feed-derived tail work the same way for any Tribe host.

## Quality gate

`npx tsc --noEmit` clean · **1436/1436** tests (+4) · `npm run build` exit 0 ·
`npm audit` 0 vulnerabilities · converged run is 0-to-add on all four sources.

## What is actually left, and what it would take

**arts 8% · festival 2% · food 1% · weird 0%** — about 400 listings.

Three routes, none of them another afternoon's work:

1. **Ticketmaster.** Still the single biggest lever and still one free API key.
   It reaches the Orpheum, the State, the Ordway, the Armory, Xcel, Target Center
   and Mystic Lake — the largest remaining arts block, and it would settle five
   of the nineteen open clashes outright.
2. **Private app APIs.** The Walker, the Guthrie and Children's Theatre all serve
   their calendars from undocumented internal endpoints. Reachable, but
   unversioned and liable to change without notice — a different kind of
   dependency from a published feed, and worth a deliberate decision rather than
   a quiet one.
3. **The 200-venue tail.** Sisyphus, Bryant-Lake Bowl, LUSH, apple orchards,
   suburban festivals. There is no feed to find; these are one- and two-listing
   venues. The honest options are the report form (which already caught a real
   error on day one) and the verify pass, not another importer.

**Festival and food may never have a primary source at all.** A neighbourhood
street fair does not publish JSON. For those, the self-check and the report
channel are the instruments, and the right expectation is that they stay
unverified rather than that some feed will eventually cover them.
