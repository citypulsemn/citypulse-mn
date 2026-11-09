# Deploy — "Before you go" on the playground pages, from the aerial inventory

**Date:** 9 November 2026 · **Asked for by:** Taren ("read in the aerial playground inventory process and build it into the site intelligently")
**Files:** `lib/playground-facts.ts` (new), `components/BeforeYouGo.tsx` (new), `scripts/playground-aerial.ts` (new),
`public/places/aerial/*.jpg` (14 new, ~25 KB each), `lib/__tests__/playground-facts.test.ts` (new),
`app/places/[kind]/[slug]/page.tsx`, `app/globals.css`, `package.json` (one script), `lib/places.ts`, `lib/__tests__/places.test.ts`
**Schema:** none. **Env:** none. Code, registry data and static images only.

The 14 outdoor playground pages (`/places/playground/<slug>`) get a **Before you go** box under the
map: restrooms as the park's own page describes them, ages, toddler area, hours, the lot to park in
with a "Directions to the lot" link, the nearest splash pad, and an April 2025 aerial photo of the
layout. Every pin in the playground list now sits on the playground itself.

---

## What the handoff was, and how much of it shipped

The handoff (`Documents\aerial-playground-inventory-handoff`) counts play pieces from county aerial
photos, joins the city's park records, and scores each park 0–10 on three axes. It was tested on
three Plymouth parks on 8 Nov. **Much less of it is on the page than it can produce, on purpose:**

| Handoff output | On the site? | Why |
|---|---|---|
| 0–10 scores | **No** | Its own rule: no rating until 20–30 parks are calibrated. Three are, none of them on this site. Its play-variety score also rewards big-kid equipment, so a 9 would mislead a parent of a two-year-old. |
| Counts read off the photos (slides, swings, shade) | **No** | Counting needs the 6-inch county flights. **They are not ours to use** (next section). |
| Where the playground and the lot are | **Yes** | Read off the public-domain 2025 photo. This turned out to be the biggest win (pin table below). |
| The park's own facts (restrooms, ages, hours) | **Yes** | Each one stored with the words it was read from, the URL, and the date. |
| The photo itself | **Yes** | 1-ft, public domain, dated and credited. |

### The licence finding (verified, not assumed)

The handoff calls every MnGeo layer "public and unrestricted". It isn't:

- **`met25` (Metropolitan Council, flown 5–16 April 2025)** — its metadata says *"public domain under
  the Minnesota Government Data Practices Act"*. Read at mnatlas.org/metadata/2025_7_county.html. **This
  is the only layer the site fetches or shows,** and a test fails if any file asks for another.
- **Dakota 6-inch** — copyright Nearmap; *"may be used for any purpose, excluding commercial purpose."*
  Off-limits.
- **Hennepin 6-inch (`hen22`, the one the handoff counts from)** — the metadata names *"Hennepin County
  and Nearmap, Inc."* as originator. Nearmap's terms aren't published. Unclear, so not used.
- **Ramsey (`rams20`)** — no terms anywhere. Not used.

At 1-ft you can see where the play area, paths and lot are, but not individual slides — so the photo is
a layout picture, and the caption says so.

---

## The pins were the biggest problem

The old pins came from each park's street address, which for a park reserve is the entrance or the
headquarters. Measured old pin → play area, 8 Nov 2026:

| Playground | Off by | Where the old pin was |
|---|---|---|
| Waterford (Waconia) | **3,883 m** | in Lake Waconia |
| Staring Lake (Eden Prairie) | **2,060 m** | a housing area north of the park |
| Elm Creek (Maple Grove) | **1,577 m** | near the I-94/610 interchange |
| Hamlet (Cottage Grove) | **1,473 m** | |
| French Regional (Plymouth) | **1,134 m** | the Rockford Road entrance |
| Chutes and Ladders (Hyland) | **964 m** | Bush Lake Road, by the lake |
| Roseville Central Park | **743 m** | the *other* half of Central Park (Lexington), which has its own playground |
| Shakopee, Wabun, Becker, Teddy Bear, Maple Grove, Madison's Place, Shoreview | 181–316 m | |

**7 of 14 were more than 700 m off.** That pin drives the "Directions" link in the page header, the
static map, the interactive map and the "nearby" links, so a parent tapping Directions for Hyland
was routed to the wrong side of a lake. The 6 Sep coordinate audit couldn't have caught it: it checks a
pin against the *address*, and these pins matched their addresses. **For a park, the address is not
where the playground is.**

Each new pin is the centre of the play surface, read off a 2025 photo, and checked by eye on a contact
sheet of all 14 photos with a centre mark on each.

---

## What a reader sees (Hyland, as built)

> **BEFORE YOU GO**
> Restrooms in the visitor center, which is open daily 9 AM–5 PM
> Separate toddler area
> Hours: daily, 5 AM–10 PM
> Park in the visitor center lot, about a 2-minute walk. *Directions to the lot ↗*
> Nearest splash pad, 2.7 mi (Memorial Day–Labor Day): *Nesbitt Preserve Park Splash Pad →*
> From *threeriversparks.org ↗*, read 8 November 2026. Parks change — check before you go.
> *[aerial photo]*
> From the air, 5–16 April 2025, before the leaves came out. It shows the layout, not today's
> condition. Photo: Metropolitan Council, via the Minnesota Geospatial Image Service.

### Rules the box follows (all in `lib/playground-facts.ts`, all tested)

- **A line appears only when the park's own page says it.** City, county, Three Rivers or MPRB pages
  only. Aggregators (Family Fun Twin Cities, Minnesota Parent, Yelp…) are banned by a test.
- **Every fact stores the words it was read from** (`quotes`), copied word for word. All 33 were
  re-checked against the live pages on 8–9 Nov; three only appear once the page's scripts run, and
  were checked in a browser.
- **Restrooms say what the source says.** "In the visitor center, which is open 9–5" — not "flush
  restrooms" — because that is the fact that decides a trip. Silence is said out loud ("No restroom
  building yet; the city lists one in its future plans"). Where the evidence was weak, there is **no
  restroom line at all**: Roseville's only restrooms are inside a rentable shelter, and MPRB's notice
  covers all 167 acres of Minnehaha, not Wabun.
- **When a park's own pages disagree, say less.** Hyland's park page says the play area is "Open
  mid-April to October"; Three Rivers' live status page lists it Open on 8 November. No season line.
- **A lot appears only when the photo shows it plainly.** Maple Grove, Teddy Bear and Shakopee had a
  "probably" lot — no parking line there. Walk times stretch the straight line by 1.3 and round up, so
  they err long, not short.
- **The splash-pad line reuses the site's own sweep** (exhaustive, 49 pads): "at this park" within
  400 m, "nearest, X mi" under 3 mi, nothing beyond.
- **No entry, no box.** Edinborough (indoor) gets nothing.

### Side effects on other pages (intended)

- **Badges:** Becker and Madison's Place now show **Restrooms**; Hyland and French show **Toddler area**.
  Each is backed by a quote in the facts file, and a test holds the badge and the box line together.
- **New filter chips:** "Toddler area" appears on `/places/playground` (it narrows to Hyland and French)
  and on `/places/discover`, where it now spans playgrounds and indoor playgrounds.
- **Registry corrections:** Roseville's address and source now point at Central Park – Victoria West
  (2495 Victoria St N), where the inclusive playground is. Shoreview's address is 4680 Victoria St
  (the city's page), not the community center's 4580. Teddy Bear's source link was a 404 and now
  points at the city's current page. Both Becker intros said the community center was there; the
  city lists it at 4800 Douglas Dr N, so they now say what the city's Becker page says instead.

### The page stays static

The box is a server component with a plain `<img>` of a file in `public/` — no `next/image`, no
function, no database. The detail route is still `revalidate = false` / `dynamicParams = false`
(the August CPU-overage fix); the build shows it as SSG with no revalidate interval. Tests pin all of it.

---

## Quality gate — observed 9 Nov 2026

- `npx tsc --noEmit` — clean
- `npm test` — **3,326 passed in 156 files**
- `npm run build` — clean, 642 static pages. **Built in a scratch copy of the tree**, because another
  session's `next dev` was writing `.next` in this checkout and pulled files out from under the first
  attempt mid-export. Same source, separate output folder.
- `npm audit` — 0 vulnerabilities
- Mutation check: 8 deliberate breaks to the logic (thresholds, rounding, the silence line, the layer
  name, a "Coming soon" placeholder) — every one failed a test. One boundary was unpinned at first
  (the 400 m "at this park" line) and now is.
- Phone check (375 px, production build): Hyland and Waterford read cleanly, no sideways scroll, the
  photo loads (200, 25 KB). The Toddler area chip on `/places/playground` narrows to the right two.
  The site has one dark theme, so there is no light mode to check.

---

## Deploy

**This checkout is shared with other sessions.** At the time of writing, another session had its own
uncommitted edits in `lib/places.ts` (two community-centre pins) and in
`docs/deploy-history/DEPLOY-PLACES-INDOOR-PLAY-SWEEP.md`. **Commit only this item's files and hunks.**

1. Fetch and rebase first — `main` moves during the day.
2. Stage the new files and this item's hunks only:
   ```bash
   git add lib/playground-facts.ts components/BeforeYouGo.tsx scripts/playground-aerial.ts public/places/aerial lib/__tests__/playground-facts.test.ts lib/__tests__/places.test.ts app/places/[kind]/[slug]/page.tsx app/globals.css package.json docs/deploy-history/DEPLOY-PLAYGROUND-BEFORE-YOU-GO.md docs/PLACES.md
   ```
   `lib/places.ts` needs only this item's hunks (the 14 playground rows plus the Becker splash-pad
   intro) — not the two community-centre pins.
3. Re-run the gate on what is staged, then push to `main`. Vercel deploys.

## Verify (production)

Use **www** and `curl -L` — the apex 308s, and a bare curl gets a 15-byte body that reads as "not deployed".
The site's service worker serves the previous build's JS; this box is server-rendered HTML, so a
plain reload is enough, but unregister it first if a page looks stale.

- [ ] `curl -sL https://www.citypulsemn.com/places/playground/hyland-chutes-and-ladders-playground | grep -c "Before you go"` → 1
- [ ] `curl -sIL https://www.citypulsemn.com/places/aerial/hyland-chutes-and-ladders-playground.jpg` → 200, `image/jpeg`
- [ ] A second request to the Hyland page shows `x-vercel-cache: HIT` (still static)
- [ ] On a phone: Hyland's header **Directions ↗** opens on the visitor-center end of the park, not Bush Lake Road
- [ ] `/places/playground/waterford-park-playground` shows "No restroom building yet…"
- [ ] `/places/playground/edinborough-adventure-peak` has **no** Before-you-go box
- [ ] `/places/playground` — the Toddler area chip narrows to Hyland and French

## Rollback

Revert the commit. Nothing in the database changes; the photos are static files and go with the revert.
Reverting also puts the old pins back — including Waterford in the lake — so prefer fixing forward.

---

## For Taren

**1. Send the licence question (recommended, ~5 minutes).** Nothing here waits on it; counting play
pieces and the sharper 6-inch photos do. Draft:

> **To:** gis.info@hennepin.us (and Ramsey County GIS)
> **Subject:** Reuse of county 6-inch orthophotos on a local events website
>
> Hello — I run citypulsemn.com, a small Twin Cities events and outings site. We'd like to use
> your spring 6-inch orthophotos (served through the MnGeo Image Service as `hen22` / county
> services) in two ways, and want to be sure it's allowed:
>
> 1. Show small crops (about 160 × 120 m, a few dozen in total) of public playgrounds on our park
>    pages, credited to the county and the flight date.
> 2. Have software (including an AI model) look at those crops to note what play equipment is
>    present — for example "shade structure" or "separate toddler area" — which we would then
>    check against city records before publishing.
>
> The site carries a few affiliate links. The metadata says "Unrestricted" but names Nearmap as
> co-originator, so we'd rather ask than assume. Is either use permitted, and if so, what credit
> line should we use?
>
> Thank you — Taren, citypulsemn.com

**2. Three intros say things no official page I read supports.** They're your copy, so they're flagged here rather than rewritten:
- **Shoreview Commons** — "built-in water-spray play". The city's page lists a drinking fountain, no water play.
- **Teddy Bear Park** — "geared to the seven-and-under crowd". Only third-party sites give an age.
- **Wabun** — "a spraying-rock water feature". MPRB names the Wabun Area Wading Pool (now its own line in the box).

**3. Teddy Bear's "Fenced" badge** was set in August from a city page that is now a 404. No current
city page says fenced. Keep it, or drop it until someone confirms it on site?

**4. Re-check every March,** before playground season (the roadmap's January–March slot for summer
guides). Restroom seasons and hours drift; `readOn` on each entry says when it was read.

**5. The handoff skill was corrected** in its own folder (originals kept as `*.orig-2026-11-08`): a
licence table at the top, the right photo credit, and a note on a bug in `score.py:78` — it lets a
medium-confidence parking guess add 3 points against its own rule. Python isn't installed here, so
it is noted, not fixed.

## Not built, on purpose

Scores; counts from photos; an "every playground" inventory (Places pages average 0.06 Google clicks
each — this improves pages that exist rather than adding URLs); a database table; anything at runtime.
If the counties say yes, the next item is blind counts on the cleared layer, validated against the
records, publishing high-confidence presence facts only — still no score until 20–30 parks.
