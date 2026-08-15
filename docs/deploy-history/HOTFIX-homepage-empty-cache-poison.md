# Hotfix — homepage showing "no events" (poisoned ISR cache) + getEvents hardening

*Aug 15, 2026. Live incident: the homepage explorer (list AND calendar, every range)
showed no events for all visitors, while `/this-weekend` etc. worked.*

## What was happening

The homepage was serving a **stale ISR page cache** (`X-Vercel-Cache: STALE`,
`Age: 1815`) that had been rendered from the bundled **June-2026 sample events** —
so the default views (this-week / this-month / calendar = August) matched nothing.

Root-cause chain:
1. A transient Supabase **DB read failure** (the egress issue) hit `getEvents()`
   during a homepage ISR render.
2. `readAllPublished` caught the error and **returned `sampleEvents`** (dated June
   2026, e.g. "Trampled by Turtles" at First Avenue).
3. That render — real events absent, June demo data present, August views empty —
   got **baked into the page's ISR cache** and served to everyone until the next
   deploy.

Confirmed, not guessed:
- `/this-weekend` (432 cards) + `/this-week` (32) worked → `getEvents()` is fine now.
- The dev homepage rendered fully populated all session → **not a code bug**.
- Homepage cache header `STALE, Age 1815` vs `/this-weekend` `HIT, Age 73`.
- The stale homepage HTML literally contained `2026-06-08/22/25` date strings = the
  sample fallback (real published events are August-onward; June is archived).

## The fix (two parts, one deploy)

**1. Clear the poisoned cache — redeploy.** This commit's push triggers a Vercel
redeploy, which re-renders the homepage fresh (getEvents works now) and replaces the
stale cache with real events.

**2. Hardening — a configured-DB read failure must never poison the cache again.**
`lib/events.ts`:
- `readAllPublished` (feeds `getEvents`, wrapped in `unstable_cache`) now **throws**
  on a DB read error when a DB is configured, instead of returning `sampleEvents`.
  Throwing means Next keeps serving the **last-good cached page** and never caches the
  degraded render — graceful degradation without poisoning. Also removed the
  `rows.length === 0 → sampleEvents` path: a reachable, empty published table returns
  `[]` honestly, not June demo data.
- `readEventsForDay` (the `/day` path) gets the same policy — throws instead of
  caching an empty day.
- **Sample data is now served ONLY when there is no DB configured** (`!sql`, i.e.
  local dev without `DATABASE_URL`) — its actual purpose ("runs out of the box").
  `getEvent` (single page → `null`/404) and `getEventsByIds` are unchanged (neither
  poisons a list cache).

## Root cause remains: egress (Roadmap v6 Tier 0.1)

The hardening stops a DB blip from *poisoning the cache*, but the blips themselves are
the **Supabase egress** problem. Until egress is under the cap (Pro upgrade / reduced
egress), transient read failures can still cause brief "serve last-good stale page"
windows. This is why egress is the top-priority item.

## Verification

- `npx tsc --noEmit` clean · `npm run build` clean · `npm audit` 0.
- `npm test` — **1048 passed**; `events-read` 7/7 including 3 new source tripwires:
  `readAllPublished` re-throws (no sample fallback), `readEventsForDay` re-throws,
  and sample data is served only under `if (!sql)`.
- The `!sql` sample-fallback tests (`getEvent`, `getEventsForDay`) still pass — dev
  without a DB is unaffected.
- **Post-deploy (to confirm on the live site):** `https://www.citypulsemn.com/`
  shows this-week events again, no `2026-06-*` date strings, `X-Vercel-Cache` returns
  to a fresh HIT.

## Rollback

Revert this commit. (Note: reverting restores the silent sample-data fallback that
caused the incident — only roll back with the egress path understood.)
