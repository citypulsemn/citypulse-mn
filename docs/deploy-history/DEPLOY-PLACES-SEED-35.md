# Deploy — Places seed to 35 (suburban splash pads + honesty fix)

*August 2026. Second curation pass on `lib/places.ts`, hitting the roadmap's
~35-entry target. Pure data + a small metadata honesty fix.*

## What shipped

**Splash pads: 10 → 19** — nine verified suburban additions, each checked
against its city's official parks page on `verifiedAt` (2026-08-07):

| Splash pad | City | Free? |
|---|---|---|
| Kelley Park | Apple Valley | free |
| Round Lake Park | Eden Prairie | free |
| Grand Prairie Park | Lakeville | free |
| Oak Hill Park | St. Louis Park | free |
| Lions Park | Shakopee | free |
| Nicollet Commons Park | Burnsville | free |
| Cliff Fen Park | Burnsville | free |
| Cedarcrest Park | Bloomington | free |
| Boulevard Plaza | Coon Rapids | free |

The registry is now **35 entries — 16 beaches + 19 splash pads across 14
cities** (splash pads alone span 12: Minneapolis, St. Paul, Apple Valley,
Bloomington, Burnsville, Coon Rapids, Eden Prairie, Lakeville, Maple Grove,
Shakopee, St. Louis Park, Woodbury). Good spread north (Coon Rapids), south
(Lakeville, Apple Valley), and west (Shakopee, Eden Prairie).

**Left out on purpose (honest data):** Chanhassen City Center Park (mid-
redevelopment, couldn't confirm it's open), Roseville Rosebrook (splash pad under
construction, 2027), Blaine Aquatore (splash pad only "planned"), Plymouth and
Maplewood (couldn't confirm a specific splash pad + address). Better absent than
wrong on an evergreen page.

## The honesty fix

The kind-page `<title>` said "**Every One**, Mapped" and the description said "A
**complete** list." That was fine as an aspiration for a comprehensive set — but
19 splash pads across 12 cities is a strong *curated* list, **not literally every
splash pad in the metro** (dozens more exist in other suburbs). Under the no-
overclaim / honest-data stance, that's a claim to soften:

- Title → `${plural} in the Twin Cities, Mapped`
- Description → "A **hand-checked**, mapped list across the Minneapolis–St. Paul
  metro …"
- OG subtitle → "Mapped across the Minneapolis–St. Paul metro"

**Taren's call:** if you consider the list comprehensive enough (or want the
"Every One" SEO phrasing back), it's a one-line revert — flagging it rather than
deciding your SEO voice for you.

## The metro bounding-box guard widened

The coordinate drift-guard box grew (lat 44.5–45.4, lng −94.0 to −92.6) to admit
the legitimate far suburbs — Lakeville at 44.66 to the south, Coon Rapids at
45.19 to the north — while still catching a transposed or garbage lat/lng.

## Verification (observed, not intended)

- **Live in dev:** `/places/splash-pad` → **19 numbered rows across 12 cities**
  (Apple Valley … Woodbury); `/places/beach` unchanged at 16. No console errors.
- **Drift guards validated all 35 entries** (unique slugs, resolvable keys, https
  `sourceUrl`, banned-word check, widened metro box).
- **Gate:** `tsc` clean · **927/927** · `npm run build` clean · `npm audit` 0.

## Honesty notes

- **Sources** are official city/park pages (Apple Valley, Eden Prairie,
  Lakeville, St. Louis Park, Burnsville, Bloomington, Coon Rapids) plus Discover
  Shakopee's water page for Lions Park.
- **Coordinates** for the suburban entries are placed from their real street
  addresses at park level; `address` + `sourceUrl` are the precise anchors.

## Deploy steps

Push to `main`. Registry data + one test bound + a metadata edit. No schema, no
env, no deps.

## Verify checklist

- [ ] `/places/splash-pad` lists 19 spots spanning the core cities and suburbs.
- [ ] Spot-check a few new `sourceUrl` links resolve to the right park + free
      splash pad.
- [ ] The kind-page title no longer claims "every one."

## Rollback

`git revert`. Pure data + the test bound + the title/description/OG text revert
together.
