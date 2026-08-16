# Deploy — raise cache TTLs to cut Supabase egress

*Aug 15, 2026. Follow-on to the homepage cache-poison hotfix; reduces the DB read
frequency that drives egress (Roadmap v6 Tier 0.1).*

## What changed

Four TTLs raised. Content is weekly (the Monday pipeline) and admin edits bust
`EVENTS_TAG` immediately, so wider windows cost no real freshness — they only gate
how fast *pipeline* changes appear, and they cut DB reads.

| Knob | Before | After | Why |
|---|---|---|---|
| `EVENTS_TTL_SECONDS` (getEvents + getEventsForDay, **global shared cache**) | 1800s / 30 min | **3600s / 1 hr** | halves the shared full-table (~0.7 MB) reads |
| `/event/[id]` page revalidate | 300s / 5 min | **3600s / 1 hr** | biggest win — ~950 event pages each do a single-row `getEvent()` DB read on revalidation; 5 min let a crawler sweep force ~950 reads every 5 min. ~12× fewer now |
| `/collections/trending` | 300s / 5 min | **1800s / 30 min** | trending shifts gradually |
| `/event/[id]/calendar` (.ics route) | 300s / 5 min | **1800s / 30 min** | the .ics is stable and crawlers/calendar pollers hammer it |

## Why it's safe (and now safer)

- **No freshness cost:** the pipeline runs weekly and admin edits `revalidateTag`
  the events cache instantly, so only pipeline writes wait — and they still appear
  well within an hour of the Monday run.
- **Synergy with today's hotfix:** longer TTLs = fewer regenerations = fewer chances
  to hit a transient DB failure mid-render. Combined with the hardening (a failed
  read now throws instead of caching sample/empty data), raising TTLs is strictly
  safer, not just cheaper.

## Not a full fix

This buys egress headroom by reading the DB less often; it does **not** raise the
Supabase egress cap. The transient read failures behind the cache-poison incident
come from being over the cap. The durable fix is still the **Pro upgrade / egress
reduction decision (Tier 0.1)** — check Settings → Usage for the actual trend.

## Verification

- `npx tsc --noEmit` clean · `npm run build` clean · `npm audit` 0 · `npm test` 1048.
- Config-only (TTL constants); no test pins these values.
- Post-deploy: `/event/[id]` and the homepage keep serving (fast HITs); the DB is
  simply hit less often on the shared/event-page paths.
