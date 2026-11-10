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

### Outcome (9 Nov 2026, second commit)

Taren approved the recommendations "after a double-check". One skeptic agent
per row then tried to refute each recommendation using operator pages only.

- **Removed — confirmed:** `eagan-community-center-pool` (every City of Eagan
  page for the building omits a pool; Eagan's only city pool is Cascade Bay),
  `grove-cove-aquatic-center` (city: "Our pools are closed for renovations…
  reopen in 2028"; nothing stayed open — same rule as Northview on 5 Oct; re-add
  with a new intro when it reopens), `camden-farmers-market` (absent from the
  City of Minneapolis 2026 market layer, and from its 2022 and 2023 lists),
  `fridley-farmers-market` (the market's own Facebook last posted March 2019;
  nothing on fridleymn.gov). Pools 26 → 24, farmers markets 72 → 70. Their
  detail URLs now 404, which is honest for places that aren't there.
- **Updated — confirmed:** `lake-elmo-farmers-market` → Washington County
  Fairgrounds, 12300 40th St N (the fair's own address; the Facebook "12398 43rd
  St N" is not a real address point), city **Baytown Township** (the registry's
  pattern for a township with a Stillwater mailing address), Saturdays 9–1 per the
  market's own 2026 posts. Pin: the west parking field, read twice blind, 13m
  apart. Season stays `MARKET_SEASON` — the June start is attested only by
  aggregators.
- **Shakopee — NOT applied; the double-check did not support the re-point.**
  St. Francis Regional Medical Center's market is documented only for **2025**,
  on a page headed "Care Team Member Events", with nothing saying the public may
  shop. The Chamber's downtown market has no evidence after 2023 and its site has
  lapsed. Re-pointing would publish a market nobody has shown runs in 2026 or is
  open to the public. **Removed** on Taren's call later the same day (third
  commit), so farmers markets 70 → 69 and the farmers-market pin audit confirms 0.
  If the St. Francis market is confirmed public for a new season — the hospital's
  main line is (952) 428-3000 — re-add it as its own row.

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
