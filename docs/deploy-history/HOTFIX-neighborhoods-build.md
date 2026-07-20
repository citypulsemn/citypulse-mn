# HOTFIX — Neighborhoods build failure (prerender timeouts)

## What happened, honestly

The build log tells the story precisely: every `/neighborhoods/[slug]` page timed out at the 60-second prerender limit, retried three times in batches (you can see the failure waves recurring every 60 seconds in the timestamps), and `downtown-st-paul` died on its third attempt — killing the build.

**Root cause: my `generateStaticParams`.** It told Vercel to prerender all 16 district pages *at build time*, each running the full `getEvents()` query. Parallel build workers firing 16+ concurrent full-table queries stampeded the Supabase connection pool — queries queued behind each other, every page blew past the limit, and the retries added *more* concurrent load to an already-starved pool. Collections gets away with its 8 static pages; adding 16 more crossed the tipping point.

**Why I didn't catch it: this container has no database.** My cold-build of the exact deployed artifact passed cleanly because build-time prerenders here use sample data — no pool to stampede. Same blind spot shape as the 5.1 admin-stats incident (the DB path only exists in production), now bitten from the build side.

## The fix (in this zip)

`generateStaticParams` is removed from the district pages, with a comment explaining why so it never quietly returns. The pages now render **on demand**: the first visitor to a district triggers the render, and it's cached for 5 minutes (the same ISR everything else uses). For users the behavior is identical; for the build, the database dependency is **zero** — confirmed in the build manifest, where `/neighborhoods/[slug]` now shows as on-demand (`ƒ`) instead of prerendered.

Verified after the change:
- Full gate: 439 tests, typecheck clean, build exit 0, 0 vulnerabilities.
- Live smoke: `downtown-st-paul` — the exact page that killed the build — renders on demand, caches on the second hit, bogus slugs still 404, the index still renders.
- Collections' static params are untouched: 8 pages has built fine for weeks; no reason to churn what works.

## Deploy

Unzip over the repo, commit (`Hotfix: neighborhoods on-demand ISR`) → push. The build should now sail through page generation — the neighborhoods pages simply aren't in the prerender list anymore.

## Verify
- [ ] The Vercel build succeeds (page-generation phase finishes in seconds, not minutes).
- [ ] Visit `/neighborhoods/downtown-st-paul` on the live site — first hit renders (may take a beat), refresh is instant (cached).
- [ ] The 5.5 verification checklist from DEPLOY-5.5-NEIGHBORHOODS.md applies unchanged from there.

## Process note

Recorded alongside the 5.1 lesson: any page that queries the database **at build time** is a production-only risk this container cannot exercise. Going forward, new pages default to on-demand ISR; build-time prerendering of DB-backed pages needs a positive reason and a count check against the connection budget.
