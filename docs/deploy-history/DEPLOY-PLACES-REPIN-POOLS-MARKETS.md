# Deploy — 39 pool and farmers-market pins moved to where the place actually is

*9 Nov 2026. Registry-only (`lib/places.ts`). Follows the two community-center
pins fixed on 8 Nov (`DEPLOY-PLACES-INDOOR-PLAY-SWEEP.md`).*

## What shipped

`scripts/places-coord-audit.ts` confirmed **45 rows** — 14 of 26 pools, 31 of 72
farmers markets — where both geocoders agree with each other and against our pin.
Nearly all were entered mid-August with padded round numbers (45.1150, 44.8585):
the guessed-pin tell from the 6 Sep audit, slipping past the 4-decimal test.

**39 pins moved**, by 0.5–3.5km (median about 1.2km). One address corrected:
Hastings Farm Market was filed at 1250 Vermillion St; it runs at Westview Center,
**1355 S Frontage Rd** (its own Facebook, the Chamber, Minnesota Grown and Dakota
County's WIC list agree, and its intro already said Westview).

Each changed row carries a one-line comment: the old pin, how far off it was, and
how closely the two reads agreed.

## How each pin was settled

1. **Research agent per row** — read the operator's own page first, then found
   where the place *physically* is: the aquatic facility itself (often far from a
   park's mailing address), or for a market, the lot or street the stalls use
   (often not the city-hall address we had). Then read the coordinate from two
   map sources — Google place records, named OSM features, county address points
   (Hennepin, Dakota, Washington, Met Council).
2. **Blind cross-check per row** — a second agent was given only a sentence
   describing the spot, never the first coordinate, and read its own.
3. **Applied only where the two agree within 150m.** All 39 do; 33 within 30m.
   Four checkers disputed a wording detail ("south of I-94, not north") but landed
   on the same spot.

One real dispute, decided for the operator: **Forest Lake.** The checker found
older listings (to 2025) of a Tuesday market at Lakeside Park. The researcher read
the city's own **2026** flyer: "Where: City Hall … Every Saturday … NEW for 2026."
The current operator flyer wins; the pin is City Hall, matching the intro.

After: the pool audit confirms 2, the farmers-market audit 4 — exactly the six
rows held below.

## Held for Taren — not pins, content

Moving the pin would have made these look more right than they are.

| Row | What the operator's own pages say | Recommendation |
|---|---|---|
| `eagan-community-center-pool` | The city's Eagan Community Center pages list a gym, fitness, The Blast and event rooms — **no pool**. Eagan's only city pool is Cascade Bay (outdoor). | Remove the row — it describes a pool that doesn't exist |
| `grove-cove-aquatic-center` | **Closed 8 Sep 2026 for renovation, reopens ~June 2028** (city project site). Intro says "open year-round". | Remove until it reopens, or rewrite the intro as closed |
| `camden-farmers-market` | Left 4400 Osseo Rd after 2021; Robbinsdale 2022–24; now runs under another name in south Minneapolis. | Remove |
| `fridley-farmers-market` | No season after 2019 on any operator source; the row's source is an aggregator. | Remove |
| `shakopee-farmers-market` | The row mixes two markets: the Chamber's downtown market (no 2024–26 evidence) and St. Francis Regional Medical Center's own Tuesday market (the stored address). | Re-point to the St. Francis market, or remove |
| `lake-elmo-farmers-market` | Moved from Lake Elmo Elementary to the **Washington County Fairgrounds** (12300 40th St N, Stillwater); 2026 season ran there, Saturdays. | Apply: new address, pin, intro and city — needs your nod since the name says Lake Elmo |

**Intro errors found on rows whose pins did move** — one agent's reading each, not
double-checked, so worth a quick look before editing:

- `brooklyn-center-community-center-pool` — closes **14 Dec 2026** for renovation,
  reopening mid/late June 2027; intro says "open year-round".
- `apple-valley-farmers-market` — operator and city both say **Saturdays**; intro
  says Wednesday.
- `eagan-market-fest` — Wednesdays June–August at the Festival Grounds is right,
  but the **fall** market (Sept–Oct) runs at Goat Hill Park.
- `shoreview-farmers-market` — the indoor winter market now starts **17 Nov**, not
  January.
- `savage-farmers-market` — the building is the 1880 **Savage Depot** (Omaha Road),
  not a "Dan Patch depot".

## Not done

The registry-wide audit of the other kinds was not re-run this session (usage
limits). Pools and farmers markets were the two kinds the 8 Nov spot-check showed;
the rest should be run the same way before trusting them —
`npx tsx scripts/places-coord-audit.ts --kind=<kind>` per kind.

## Gate (observed)

- `npx tsc --noEmit` — clean
- `npm test` — **3,357 passed** (the suite grew from other sessions' work)
- `npm run build` — clean, built in a separate worktree from `origin/main` plus
  this diff (another session's dev server was running in the shared checkout)
- `npm audit` — **0 vulnerabilities**
- Coordinate audits after: pool 2 confirmed, farmers-market 4, indoor-playground 0

## Deploy steps

Push to `main`; Vercel auto-deploys. Registry data only — no schema, no env.

## Verify checklist (production)

```bash
curl -sL https://www.citypulsemn.com/places/pool | grep -c "Bloomington Family Aquatic Center"
```

- [ ] `/places/pool` and `/places/farmers-market` load; open the map and check
  Bloomington Family Aquatic Center sits at 90th St, not on W 80½ St
- [ ] Hastings Farm Market's detail page shows 1355 S Frontage Rd

## Rollback

`git revert` the commit. Registry pins and one address only.
