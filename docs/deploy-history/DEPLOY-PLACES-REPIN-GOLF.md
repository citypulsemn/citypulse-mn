# Deploy — 39 golf-course pins moved to the clubhouse

*10 Nov 2026. Registry-only (`lib/places.ts`). Same method as
`DEPLOY-PLACES-REPIN-POOLS-MARKETS.md`, applied to the next kind.*

## Scope, and what it deliberately leaves alone

Taren asked for golf courses and beaches first. **Beaches are not in this commit.**
A separate measurement (`docs/PLACES-PIN-AUDIT-NOV-2026.md`, commit `c86ed7c` on the
unpushed branch `claude/epic-haibt-b8e2ad`) already placed every beach, splash pad,
sledding hill, disc-golf course, dog park, nature center and park pin against the
2025 aerial photo — all 45 beaches are off, five on the wrong lake — and proposes a
point for each, checked by eye. Its recommendation (move 148 pins in one commit) is
waiting on Taren. An address-based re-pin would be the worse method there: a beach's
address is usually the park entrance, which is exactly what the address audit
compares against.

## What shipped

`scripts/places-coord-audit.ts --kind=golf-course`: of 85 courses, **33** had pins
both geocoders reject and agree on, and **10** had pins both reject but disagree on.
Those 43 went through two stages:

1. **Research** — the course's own site: still operating (2026 rates or tee times)?
   Its address? Then the **clubhouse** (where a golfer parks) read from two map
   sources: Google place records, named OSM clubhouse buildings, county address
   points.
2. **Blind cross-check** — a second agent given only a sentence describing the
   spot, never the coordinate.

**39 pins moved**, all where the two reads agree within 150m (36 within 10m). The
old pins were 0.5–13.7km off, median about 2.4km — Heritage Links was 13.7km away,
Eagle Lake 8.2km, Hidden Greens 7.6km. Each changed row carries a one-line comment.

**Two addresses corrected**, as the operators print them:
- **Theodore Wirth Par 3** → 1221 Theodore Wirth Pkwy (the Trailhead, where the
  Park Board says to check in; the old 1325 is the former par-3 building).
- **Eagle Lake Golf Center** → 11000 Bass Lake Rd, Plymouth.

After: the golf audit's "within 500m of a geocoder" count goes 23 → 60. Six rows
still flag — the four closed courses below, plus **Halla Greens** and **Creeksbend**,
where the geocoders are the ones that are wrong (both interpolate along the highway;
the county point for 495 Pioneer Trail sits on Halla's maintenance building). Both
new pins are on the clubhouse, two independent sources within 5m.

## Held for Taren — four courses that have closed

Moving the pin would make these look more real than they are. Each is one research
agent's finding, not yet double-checked.

| Row | Evidence found |
|---|---|
| `viking-meadows-golf-club` | Closed 2024; the operator's domain now redirects elsewhere; the land is a housing development sold as "Viking Meadows" |
| `fountain-valley-golf-club` | Rezoned Nov 2024 for a data-center campus; clubhouse demolished under Farmington permit FA062506 (finaled 30 Jun 2026) |
| `parkview-golf-course` | Last season 2013; sold for housing |
| `valley-view-golf-club-belle-plaine` | Own site said "Closed for Business" by Jan 2016; Google "Permanently closed"; clubhouse sold as a home Jul 2026 |

Golf is an **exhaustive** kind ("every public course, 7 counties"), so a closed
course on the list is a false claim. Recommendation: double-check, then remove, as
with Grove Cove and the farmers markets.

### Outcome (10 Nov 2026, second commit) — all four removed

Taren asked for a double-check against operator and city sources first. One agent
per course tried to prove it still runs; removal needed an operator or government
source, not just directories. All four held:

- **Viking Meadows** — Anoka County: "The property is currently the Viking Meadows
  Golf Course" being redeveloped for homes (Jun 2024); East Bethel council minutes
  through Feb 2026 on the plat; the course's own Facebook ran an "Everything must
  go" sale on 26 Oct 2024.
- **Fountain Valley** — City of Farmington permit FA062506, "Demolition of
  Clubhouse and Garage", 2830 220th St W, finaled 30 Jun 2026; rezoning approved
  Nov 2024.
- **Parkview** — the club's own 2013 pages selling its buildings; Eagan re-guided
  the 80 acres from Private Recreational to Low Density Residential.
- **Valley View (Belle Plaine)** — its own site: "Closed for Business / Thanks for
  Playing with us" (Aug 2015); the domain parked by Mar 2016.

Golf courses 85 → 81. Their detail URLs now 404.

**The five intro errors below were fixed in the same commit**, each through a
refute-first check of every claim and a second agent's refute pass on the new
sentence (all five survived). Hyland Greens, Halla Greens and Arbor Pointe also
lost the `par-3` tag (they are executive nines → `9-hole`). Two unattested phrases
went: Columbia's "since 1919" (the Park Board's page gives both 1917 and 1919) and
Arbor Pointe's "walkable".

## Intro errors found

- `columbia-golf-club` — par **70**, not 71 (operator page).
- `hyland-greens-golf` — par **28**: the card has one par 4; "par 27" is wrong.
- `halla-greens-golf` — a par **29** executive course, not a par-3.
- `rum-river-hills-golf-club` — built **1986**, not 1988.
- `arbor-pointe-golf-course` — an executive nine, par **31**, not a par-3.

## Not done in this round

- The **18 courses where only one geocoder answered** and it disagrees, plus 1 that
  neither resolved — a second round.
- The other unaudited kinds: rinks, museums, orchards, gardens, ski hills, music
  venues.

## Gate (observed, on the exact tree pushed — `origin/main` plus this diff, LF checkout)

- `npx tsc --noEmit` — clean
- `npm test` — **3,383 passed** (156 files)
- `npm run build` — clean
- `npm audit` — **0 vulnerabilities**

## Deploy, verify, rollback

Push to `main`; Vercel deploys. Registry data only — no schema, no env.

```bash
curl -sL https://www.citypulsemn.com/places/golf-course/braemar-golf-course | grep -o '"latitude":[^,]*'
```

- [ ] Braemar's latitude reads the new clubhouse pin, not the old one
- [ ] `/places/golf-course/theodore-wirth-par-3` shows 1221 Theodore Wirth Pkwy

Rollback: `git revert` — pins and two addresses only.
