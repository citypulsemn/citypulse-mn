# Deploy — Discovery routing (amplify what ranks)

*Aug 16, 2026. Roadmap v6, born from the GSC "what's ranking" read (the
`gsc-report` diagnostic). Taren's call from the fork: **amplify what ranks**.
Route the pages that already rank to the conversion pages that don't.*

## The GSC finding that drove this
The first real Search Console breakdown (28d) was stark:
- **88.5% of impressions are `/event/[id]` pages** — transactional. Top queries
  are specific event names ("gothic market", "anoka food truck festival 2026").
- **`/places` has ~0 impressions** — the vertical we'd called "the proven organic
  lever" isn't ranking yet (competing in a hard SERP; months-young).
- **Day pages are a working discovery surface** — `/day/2026-08-22` ranks for
  "events in minneapolis tomorrow" / "[date] minneapolis events" at position 5–7,
  11–17% CTR.
- **`/this-week` and `/this-weekend` — the subscribe-optimized shop-windows —
  rank for nothing.** That's *why* `/this-week` has converted 0 subscribers: no
  one finds it.

Recon confirmed the gap in code: **day pages had no subscribe band**, and
**nothing linked to the shop-windows from the high-traffic event/day pages**, so
`/this-week` got neither humans nor the internal-link equity it needs to rank.

## What shipped
One mechanism, two payoffs (route ranking pages → conversion pages = human
traffic **and** internal-link equity):

- **Day pages** ([app/day/[date]/page.tsx](../../app/day/[date]/page.tsx)):
  - Added a `SubscribeBand source="day"` — the surface that already ranks for
    discovery-intent queries had no ask; now it does (still one band, no popup).
  - Added an onward strip linking `/this-week` + `/this-weekend`.
  - **Title now leads with "Minneapolis–St. Paul"** to match the winning query
    term (the page ranked for "…minneapolis…" while the title said only "Twin
    Cities"). Description was already Minneapolis–St. Paul.
- **Event pages** ([app/event/[id]/page.tsx](../../app/event/[id]/page.tsx)) — 88%
  of impressions: an onward strip linking `/this-week` + `/this-weekend`. This
  routes the site's biggest traffic pool to the shop-windows and passes link
  equity from its highest-authority pages. The existing single subscribe band is
  untouched (asserted still exactly one).
- **Attribution** ([lib/subscribe.ts](../../lib/subscribe.ts)): registered the
  `day` source → "Day pages" so Admin→Stats reports whether the new band converts.
- **CSS**: one additive `.onward` class ([app/globals.css](../../app/globals.css)),
  reusing the proven `.day-nav-link` gold-on-navy link style (no new contrast risk).

## Verification (observed, not intended)
- **Rendered HTML, live dev server:** the day page serves the new title
  ("Things to Do in Minneapolis–St. Paul, Saturday, August 22, 2026"), the onward
  `/this-week` + `/this-weekend` links, and the "Never miss a day like this" band.
  The event page serves the onward strip with both links and **exactly one**
  subscribe band. (The browser pane reported a 0×0 viewport — the known headless
  limitation — so verification is via the SSR HTML + DOM, per the standing gotcha.)
- **Tests +9** (1075 total): a `subscribeSourceLabel("day")` unit assertion plus
  source-tripwires (day page has the band + both shop-window links + the
  Minneapolis title; event page links to both shop-windows and stacks no second
  band — the no-dark-pattern guard).
- Gate: `tsc --noEmit` clean · 1075/1075 · `npm run build` clean · `npm audit` 0.

## Deploy steps
Merge to `main`; Vercel auto-deploys. No schema, no secret, no config. ISR
windows unchanged (day/event pages already 30 min / 1 hr).

## Verify checklist (post-deploy)
- A day page shows the subscribe band + the two onward links; view source shows the
  Minneapolis–St. Paul title.
- An event page shows the onward strip and still exactly one subscribe band.
- **The real proof is slower and lives in the instrument:** re-run the `gsc-report`
  workflow in ~3–4 weeks — watch for `/this-week` + `/this-weekend` starting to
  accrue impressions (internal links are indexed and counted), and Admin→Stats for
  any `day`-sourced signups. Internal-link equity is not instant; give it a cycle.

## Rollback
`git revert`. All changes are additive JSX/metadata + one CSS class + one label
map entry; reverting restores the prior pages exactly. No data to undo.
