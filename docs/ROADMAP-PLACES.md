# Place Guides — prioritized build plan (Roadmap item F2.7)

*Mid-August 2026. Self-contained spec: a Claude Code session can execute any wave item from this file alone. The Places SEO deep-dive referenced by `docs/ROADMAP-v6.md` Tier 1.2. House rules apply to every item: one item per session, finished (design → build → test → deploy guide); quality gate per `CLAUDE.md`; honest data; Taren's voice wins.*

## What this is and why

Evergreen **place directories** — "Splash pads in the Twin Cities," "Sledding hills," "Concert venues by size" — as first-class pages on citypulsemn.com. Feasibility study conclusions (July): Google Maps lists have no API (manual mirror only, ops item at the bottom); Google Places API data can't legally be stored to build a directory; therefore places are **hand-curated registry data in `lib/`**, the same pattern as the venue registry, with drift-guard tests. That constraint is also the moat: the winning detail ("which beaches have lifeguards," "which taprooms allow kids") is exactly what can't be scraped.

**The timing insight that drives the wave order: pages take months to index and rank, so guides are built one season *ahead* of demand.** Winter guides ship September–October to rank by December; summer guides ship January–March to rank by June. Building a splash-pad guide in July is too late for that July.

**Prioritization scoring (used throughout):** search demand (qualitative — validate against Search Console once live) · event-synergy (does it link into the calendar?) · curation cost (can 15–30 entries be verified in one sitting and re-verified twice a year?) · season lead time.

---

## Wave 0 — Infrastructure + seed guide (build first; one session; size M)

**W0. `lib/places.ts` registry + `/guides/[slug]` template.**

Design decisions:
- **Data shape** (hand-maintained array, exported, drift-guard-tested like `related.test.ts`):
  ```ts
  type Place = {
    slug: string; name: string; kind: PlaceKind;      // 'splash-pad' | 'sledding-hill' | ...
    address: string; city: string; lat: number; lng: number;
    area?: string;                                     // reuse lib/areas.ts keys
    website?: string; price?: 'free' | '$' | '$$';
    season?: 'summer' | 'winter' | 'year-round';
    details?: Record<string, string | boolean>;        // guide-specific facts: lifeguards, kidFriendly, dogFriendly, rentals
    venueSlug?: string;                                // bridge to the venue registry when the place hosts events
    blurb: string;                                     // 1-2 sentences, Taren voice, TODO(taren) placeholders OK at ship
    verifiedAt: string;                                // YYYY-MM-DD; staleness surfaces in ops digest later
  };
  type GuideSpec = { slug: string; title: string; kinds: PlaceKind[]; intro: string; season?: Season; detailColumns?: string[] };
  ```
- **Page:** `app/guides/[slug]/page.tsx` + `app/guides/page.tsx` index. Server-rendered, `revalidate` (no build-time DB — registry is code, so prerender is actually fine here; positive reason: zero DB reads). Each entry: name, area chip, price, the guide's detail columns, blurb, Mapbox static map (reuse the venue-page pin helper), and — when `venueSlug` matches — "Upcoming here" links via the existing venue-event selector (`MoreAtVenue` pattern).
- **SEO:** `ItemList` JSON-LD **through `jsonLdSafe()`** (the R0.6 escaping helper — hard dependency; do not ship guides before that fix). Canonicals, sitemap entries, footer "Guides" link, OG card reusing the 3.3 style.
- **Cross-links both ways:** guide → venue pages/events; venue pages get a "More guides" line when their venue appears in one.
- **Tests (~10):** registry drift guards (unique slugs, valid areas, lat/lng bounds, kinds match a GuideSpec, verifiedAt parseable) · guide selection/ordering pure function · ItemList JSON-LD golden incl. `</script>`-title case · empty-guide honesty (unpublished until ≥8 entries — no sad placeholders).
- **Seed guide shipped in the same session: G1 (concert venues by size)** — it re-slices the existing 42-venue registry, so the data cost is near zero and the template proves itself on real content.

**Deploy:** code-only. **Verify:** smoke `/guides` + `/guides/concert-venues`, Rich Results test on the ItemList, one venue cross-link click-through.

---

## Wave 1 — Winter guides (build September–October; rank by December)

Priority order. Each is one session: curate + verify entries, write intro (`TODO(taren)` pass), ship, mirror as a Google Maps list (ops step below).

| # | Guide | Demand | Event-synergy | Count | The winning detail |
|---|-------|--------|---------------|-------|--------------------|
| G2 | **Sledding hills** | High, sharply seasonal, and no good metro list exists — the moat query | Low | ~20 | Lit at night? Steepness/age fit; parking; "the one with the warming house" |
| G3 | **Indoor playgrounds & play cafés** | High Sept–April (parents) | Medium (story times, events) | ~15 | Age bands, price, café quality, sock policy, birthday rooms |
| G4 | **Ice skating rinks** | High Dec–Feb | Medium (open-skate times are event-ish) | ~25 | Outdoor neighborhood rinks vs indoor arenas; rentals; free vs paid; flooded-by-city dates |
| G5 | **Trampoline, ninja & climbing gyms** | Medium, evergreen-indoor | Low | ~12 | Toddler hours, day-pass price, age minimums |
| G6 | **Ski, snowboard & tubing hills** | Medium-high Nov–Feb | Medium (Hyland/Buck Hill host events) | ~8 | Tubing reservations, night skiing, lesson programs |

## Wave 2 — Evergreen & commercial (November–December)

| # | Guide | Demand | Event-synergy | Count | The winning detail |
|---|-------|--------|---------------|-------|--------------------|
| G7 | **Birthday party venues** | High year-round, high commercial value | Medium | ~20 | Mostly re-slices G3/G5 + bowling/mini-golf entries — cheap once Wave 1 exists; price-per-kid, private-room yes/no |
| G8 | **Museums by kid age** | Medium-high, evergreen | **High** (family events already on the calendar) | ~15 | Free days, age-band honesty ("Bell is 7+, MCM peaks at 5") |
| G9 | **Breweries & taprooms with patios** | Medium-high, evergreen | **High** (trivia/music nights already scraped) | ~25 | Kids allowed? Dogs? Food truck cadence; patio heat lamps (winter angle) |
| G10 | **Free attractions** | Medium, evergreen, broad | High (Como Zoo etc. host events) | ~15 | What's *actually* free vs donation-suggested; parking cost — the honest catch |
| G11 | **Indoor walking spots** (conservatories, skyways) | Sneaky-high Dec–Mar (stroller/senior) | Low | ~12 | Hours, stroller-friendliness, attached parking |

## Wave 3 — Summer guides (build January–March; rank by June)

| # | Guide | Demand | Event-synergy | Count | The winning detail |
|---|-------|--------|---------------|-------|--------------------|
| G12 | **Splash pads & wading pools** | Very high May–Aug; the flagship parent query | Low | ~30 | Hours/season dates, shade, bathrooms, fenced or not |
| G13 | **Swimming beaches & pools** | High Jun–Aug | Low | ~25 | **Lifeguard schedule** — nobody keeps this current; water-quality-advisory link |
| G14 | **Destination playgrounds** | Medium-high, evergreen-leaning-summer | Low | ~15 | Chutes & Ladders is the anchor; age fit, shade, bathrooms |
| G15 | **Waterparks** (indoor + outdoor) | Medium-high | Low | ~8 | Indoor ones flip this to a winter guide too — tag both seasons |
| G16 | **Paddle launches & rentals** | Medium Jun–Aug | Low | ~15 | Rental prices, reservation links |
| G17 | **Nature centers** | Medium, evergreen | **High** (their programs are already events) | ~12 | Free vs paid, best-for ages, indoor exhibit for rain days |

## Wave 4 — Fill-ins and next-season prep (as capacity allows; June–July for the fall pair)

G18 **Apple orchards & pumpkin patches** (build June–July to rank by September; very high Sept–Oct demand, high event-synergy — orchard festivals are already on the calendar) · G19 **Regional parks & gardens** · G20 **Dog parks** · G21 **Mini golf / go-karts / bowling** · G22 **Comedy clubs & small music rooms** (re-slice of venue registry) · G23 **Disc golf** · G24 **XC ski & snowshoe trails** (next winter's addition).

*Deliberately excluded for now:* restaurants-as-such (different product, different competitors), anything requiring daily freshness (water quality readings — link out instead), and any pay-to-be-listed arrangement (the Phase 5 exclusions apply to guides identically: **inclusion is never for sale**).

---

## Standing rules for every guide session

1. **Ship at ≥8 verified entries or don't ship** (honest-emptiness). Target counts above are ceilings of usefulness, not quotas.
2. **Every entry gets `verifiedAt`** — the date a human (or a session with web evidence) confirmed name/address/status. Re-verify cadence: seasonal guides at season start, evergreen twice a year. A later ops-digest line ("N guide entries stale >180d") is a small follow-on once ≥3 guides exist.
3. **Voice rules apply** (`CLAUDE.md`): concrete over promotional; the banned-word list; blurbs are Taren-editable data.
4. **Editorial intros** ship as `TODO(taren)` placeholders flagged in the deploy guide, filled in one commit — same convention as the 3.2 venue intros.
5. **Distribution ritual per shipped guide** (ops, ~30 min, no code): mirror it as a Google Maps list in the CityPulse account (manual — there is no API) and link "Open in Google Maps" from the guide page · one digest mention · one Instagram slot. The site page earns search; the Maps list earns app-native follows; both point at the same curated data.
6. **Measure before Wave 2 locks:** after Wave 1 is live ~4 weeks, read Search Console queries/impressions per guide and reorder the remaining waves by observed demand. The table's demand column is judgment; the instrument outranks it.

## Sequencing at a glance

```
NOW (late Aug)   → W0 infra + G1 concert venues (M; requires R0.6 JSON-LD fix shipped)
SEP              → G2 sledding hills → G3 indoor playgrounds → G4 ice rinks
OCT              → G5 gyms → G6 ski/tubing
NOV–DEC          → G7 birthdays → G8 museums → G9 taproom patios → G10 free → G11 indoor walks
JAN–MAR          → G12 splash pads → G13 beaches/pools → G14 playgrounds → G15–G17
JUN–JUL          → G18 orchards/pumpkins (for the fall) → Wave 4 fill-ins
EVERY GUIDE      → +Google Maps list mirror, digest mention, IG slot
```

**If you build one thing: W0 + G1** — the template proves itself on data you already own. **If you build two: G2 sledding hills in September** — highest-demand unserved query in the metro, and it must be indexed before the first snow.
