# City Pulse MN — Places Roadmap v1 (Build Edition)

*Static maps and lists of the metro's go-to spots: parks, splash pads, pools, beaches, rinks, sledding hills, concert venues. The evergreen half of the site.*

**Where this lives:** `docs/PLACES-ROADMAP.md`. Built in Claude Code sessions, one item at a time, same working agreement as ever (design → build → test → deploy guide). Data curation and source research are Cowork-shaped work.

---

## Why Places (the strategic case)

**City Pulse answers "what's happening?" Places answers "where can we go?"** — the question families ask on a random hot Saturday when nothing's on the calendar.

1. **Evergreen SEO that compounds.** Events churn weekly; a splash-pad page ranks and *keeps* ranking. Queries like "splash pads minneapolis," "free swimming pools st paul," "sledding hills twin cities" are high-intent, seasonal-spike, and currently won by parks-department PDFs and stale listicles. This extends Phase 3's "earn the index" thesis with content that never expires.
2. **The audience is already here.** Family is a pillar category; the people searching for splash pads are exactly the people who should meet the digest's subscribe band.
3. **Zero pipeline risk.** Static registry data — no weekly research, no verification churn, no agent costs. The proven `VENUE_PAGES`/`NEIGHBORHOODS` pattern: registry in code, drift-guard tests, editorial intros in the house voice.
4. **Instagram fuel.** "Every splash pad in the metro, mapped" is a save-and-share carousel — the IG operation's favorite kind of post.
5. **A future revenue surface.** If Phase 5's gates ever open, "presented by" on a places page is the least invasive sponsorship imaginable. Not now; noted.

**The one-line pitch:** the site becomes the Twin Cities' answer to both "what's on this weekend?" *and* "where should we take the kids today?"

---

## Product attributes (the data model)

### Core fields — every place

| Field | Type | Notes |
|---|---|---|
| `slug` | string | URL-safe, unique across all places |
| `name` | string | |
| `kind` | enum | `park` · `splash-pad` · `pool` · `beach` · `playground` · `rink` · `sledding` · `music-venue` · `farmers-market` (extensible) |
| `lat` / `lng` | number | pin position |
| `address` | string | |
| `city` | string | reuse the existing city list |
| `neighborhood` | key \| null | **reuses the existing 16-key registry** — this is the bridge to neighborhood pages |
| `season` | object | `{ type: "year-round" }` or `{ type: "seasonal", opens: "late May", closes: "early Sep" }` — month-level honesty, never fake precision |
| `cost` | enum | `free` · `paid` · `donation` — `free` is a first-class filter; it's half the point |
| `tags` | string[] | amenity tags from the per-kind vocabulary below |
| `intro` | string | 1–3 sentences, house voice rules apply (concrete over promotional; banned-words list) |
| `sourceUrl` | string | the authoritative page (park board, city rec) — **required**; it's the honesty anchor |
| `verifiedAt` | string | date the facts were last checked against the source |
| `venueSlug` | string \| null | for `music-venue` kind: points at the existing venue page instead of duplicating it |

### Per-kind tag vocabularies (attributes that matter for choosing)

- **splash-pad:** `toddler-friendly`, `shade`, `restrooms`, `adjacent-playground`, `parking-lot`, `wading-pool-too`
- **pool:** `outdoor`, `indoor`, `zero-depth-entry`, `waterslide`, `lap-lanes`, `diving`, `free-admission`
- **beach:** `lifeguard-seasonal`, `sand`, `canoe-rental`, `concessions`
- **park:** `trails`, `grills`, `pavilion-rentable`, `dog-friendly`, `disc-golf`, `fishing-pier`
- **playground:** `accessible-surface`, `fenced`, `ages-2-5`, `ages-5-12`, `shade`
- **rink:** `outdoor`, `indoor`, `skate-rental`, `warming-house`, `hockey-and-open`
- **sledding:** `lit-evenings`, `steep`, `gentle`, `parking-nearby`
- **all kinds:** `restrooms`, `accessible`, `transit-nearby`

Tags stay flat strings — no nested schema until a real need appears. Filters are just tag membership.

### Storage decision

**Registry in code (`lib/places.ts`), not a database table.** Same reasoning as venues: testable with drift guards, versioned in git, no pipeline, editable in any Code session, renders at build/ISR with zero queries (ENGINEERING rule 2 satisfied by construction). Graduate to a DB table only if the registry passes ~300 entries or public submissions open (P4) — and the page code shouldn't care which.

---

## Design decisions (settled up front)

**Static maps first, interactive later.** The site's only map today is a Mapbox *static* image (venue pages) — fast, zero JS, phone-friendly. Kind pages launch the same way: one static map with **numbered pins matching a numbered list below**. An interactive map (pan/zoom/tap) is a real enhancement but costs bundle weight, and 3.5 just spent effort keeping vitals clean — so it ships later, behind an explicit vitals check (P4), not by default.

**Kind pages are the indexable unit; detail pages are earned, not automatic.** `/places/splash-pads` = one *strong* page (map + full list + editorial + FAQ-ish practical notes). Individual splash pads do NOT get their own pages — a 60-word stub page is thin content, and `docs/INDEXING.md` exists precisely because "Crawled — currently not indexed" punishes exactly that. A place earns a detail page only when it has real depth (P4). Music venues already have theirs — `venueSlug` links there instead of duplicating.

**Seasonal honesty.** A splash-pads page in January says so, plainly, up top: "Closed for the season — most reopen late May." Never hide the page (the SEO value persists year-round; January searchers are planning or curious), never pretend it's open. Month-level dates only; exact dates change yearly and belong to `sourceUrl`.

**The neighborhood key is the connective tissue.** Every place carries the existing neighborhood key where applicable, which makes "Places in Uptown" a selector away — and makes neighborhood pages richer without new data.

---

## The roadmap

### Phase P1 — Foundation (two kinds, done right)

**P1.1 — The places registry + selectors**
**Why:** everything else builds on the data shape. **Design:** `lib/places.ts` — types above, `PLACES` array, pure selectors: `placesByKind(kind)`, `placesByNeighborhood(key)`, `openNow(place, date)` (season math, Chicago dates), `KIND_META` (label, plural, blurb, icon-ish). Seed with the two launch kinds: **splash-pads (~20–25)** and **beaches (~12–15)** — summer-urgent, list-sized, source-verifiable (Mpls Park Board, St. Paul Parks, county pages). Every entry: real `sourceUrl`, `verifiedAt`, intro in house voice. **Build:** registry + selectors. **Tests (~8):** drift guards (neighborhood keys resolve, venueSlug resolves, slugs unique, kind values valid), season math boundaries (year-round always open; seasonal open in July, closed in Jan), intro length bounds, sourceUrl present on every entry. **Verify:** spot-check 5 entries against their sourceUrls. **Size: M** (the data curation is the bulk — Cowork-shaped work; the code is S).

**P1.2 — Kind pages + the places index**
**Why:** the SEO money pages. **Design:** `/places` (index: kind cards with counts + season state) and `/places/[kind]` — title/meta tuned for the query ("Splash Pads in Minneapolis & St. Paul — Every One, Mapped"), Mapbox **static** map with numbered pins, numbered list beneath (name, neighborhood, cost badge, tags, intro, source link), free-first sort, seasonal banner when closed, editorial header paragraph (voice rules). Canonicals, sitemap entries, ISR like other index pages. **Build:** two routes + `PlacesList`/`PlacesMap` components + CSS. **Tests (~5):** pin/list number agreement, kind-page 404 on unknown kind, seasonal banner logic. **Verify:** smoke both kinds + index; static map renders ≤ the pin limit cleanly (Mapbox static caps URL length — cap pins per map, paginate by area if a kind exceeds it). **Size: M.** Depends: P1.1.

**P1.3 — Wire-in (nav, sitemap, OG, ops)**
**Why:** a page nobody can reach doesn't exist. **Design:** footer + homepage nav link ("Places"); sitemap gains `/places` + kind pages (the ops digest's Index-surface count picks this up automatically — watch it tick up); OG cards for kind pages via the existing `og-card` shell ("EVERY SPLASH PAD / Mapped · Minneapolis–St. Paul"); `docs/PLACES.md` subsystem doc. **Build/Tests:** small; OG route + links. **Verify:** OG debugger post-deploy; sitemap count delta appears in Monday's digest. **Size: S.** Depends: P1.2.

### Phase P2 — Coverage & integration

**P2.1 — Four more kinds.** Pools, parks (curated "worth crossing town for" ~25, not all 180), playgrounds (destination-tier), sledding + rinks (ship in fall together as the winter pair). Each kind = data curation + zero new code if P1 held. **Size: M** (data), rolling.

**P2.2 — Neighborhood cross-linking.** Neighborhood pages gain a "Places in {label}" strip (reusing `placesByNeighborhood`); kind-page entries link back to their neighborhood. The two halves of the site start feeding each other. **Size: S.**

**P2.3 — Venue bridge.** `music-venue` kind entries on `/places/music-venues` render from the *existing* venue registry + editorial intros (3.2's work) — one page, zero duplicated data, `venueSlug` links through to full schedules. **Size: S.**

### Phase P3 — Seasonal ops & distribution

**P3.1 — Season flip discipline.** Two calendar moments a year (water opens ~Memorial Day, closes ~Labor Day; ice inverts). A `verify-places` checklist doc + the ops digest gains one line in an existing section: "places: 24 splash pads open (season: summer)" — and an **alert if a seasonal kind shows 0 open mid-season** (the honest-emptiness rule, operationalized). **Size: S.**

**P3.2 — Instagram formats.** "Mapped" carousel per kind from the same registry (extend the existing IG generator): cover card + map card + top-picks cards. The bio link rotation gains `/places/splash-pads` for summer. **Size: M.**

**P3.3 — Digest spotlight.** A "Place of the week" block in the subscriber digest, seasonal, hand-picked from the registry. **Size: S.**

### Phase P4 — Depth (each item gated, none default)

**P4.1 — Detail pages, earned.** Only for places with genuine depth (photo-worthy, history, insider notes ≥ 150 words). Start with ~10. **Gate:** kind pages indexed and receiving impressions first (GSC evidence per INDEXING.md).
**P4.2 — Interactive map.** Mapbox GL on kind pages behind a "View interactive map" tap-in (no default bundle cost). **Gate:** a before/after vitals check on the page must stay green — 3.5's scores are the baseline.
**P4.3 — "Open now / free only" filters.** Client-side tag filters on kind pages. **Gate:** only after ≥ 4 kinds live (filters on a 12-item list are noise).
**P4.4 — Public submissions.** "Know a spot we missed?" reusing the existing submissions moderation flow. **Gate:** admin appetite for moderation; this is when registry→DB graduation gets decided.

---

## Sequencing against the main roadmap

Places doesn't block or race Phase 4 — different muscles. Suggested interleave: **P1.1–P1.3 next** (it's summer *now*; splash pads and beaches are the season's traffic), then main-roadmap 4.1, then P2 items as palate cleansers between Phase 4 builds. The winter pair (P2.1's rinks/sledding) lands in October. 6.1 iCal remains free to jump anywhere.

## First build session (paste into Code)

> Read CLAUDE.md, docs/HANDOFF.md, and docs/PLACES-ROADMAP.md. Let's build P1.1: the places registry with splash pads and beaches. Research the entries from Minneapolis Park Board, St. Paul Parks & Rec, and the county sites — every entry needs a real sourceUrl and today's verifiedAt. Design, build, and test to our standards; drift guards like related.test.ts; intros in the house voice. Deployment guide when complete, written to docs/deploy-history/.
