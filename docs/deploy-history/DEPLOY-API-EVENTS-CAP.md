# Deploy — half a megabyte, unauthenticated, uncached, on a site with two overages

**29 Oct 2026.** One route, one constant, one test, three doc lines. No schema
change, no data change. Deploy is a push.

Surfaced by the B4 research: while establishing what `/for-partners` was allowed
to promise, the check found that the thing we were about to say we *didn't* have,
we did.

## What was there

`GET /api/events` returned the **entire published table** on every request.
Measured live before the change:

```
HTTP/1.1 200 OK
Content-Length: 542226
Cache-Control: public, max-age=0, must-revalidate
X-Vercel-Cache: PRERENDER
```

764 events, 20 fields each, **542,226 bytes** — unauthenticated, unthrottled, and
with its own header telling every downstream cache not to keep it. The heaviest
fields were `description` (103KB), `sourceUrl` (46KB) and `ticketUrl` (42KB), so
a caller also got the research provenance for the whole calendar in one pull.

This project has a **Supabase egress overage** and a **Vercel compute overage**
already on its record. An uncapped half-megabyte read path with downstream
caching switched off is that bill waiting to be run up by anything that loops.

## Who was using it

Checked before touching it, because removing a live endpoint is the kind of thing
that looks free and isn't:

- **No application code.** The only client fetches in the repo are `/api/saved`,
  `/api/visited`, `/api/beacon` and `/osm/*.json`.
- **`docs/SETUP.md`** uses it as the local smoke check — *"should return YOUR
  events, not the 30 samples."*
- **A takedown check** in `HOTFIX-cadence-extrapolation.md` and
  `DEPLOY-RECITE-DEAD-SOURCES.md` used it to confirm an archived event had
  stopped appearing (`/api/events  0 occurrences`).
- Robots already disallowed `/api/`, which is advisory and stops nobody.

So: a real operator tool with no application dependency. **Cap, not remove.**

## What shipped

A fixed slice of 20, `count` still the honest full total, and cache headers that
let the CDN do its job.

```
count: 764   returned: 20   events: [20]
15,131 bytes  (was 542,226 — 97.2% smaller)
cache-control: public, s-maxage=300, stale-while-revalidate=600
x-robots-tag: noindex
```

`count` is deliberately the full number, so SETUP.md's check still reads true:
764 is obviously not 30.

### The design decision worth recording

**I built the `?limit=` version first, and then took it out.**

Capping with an optional `?limit=` (default 20, max 100) worked and was tested —
`?limit=99999` clamped to 100, garbage fell back to the default. But reading
`searchParams` makes the route **dynamic**, and the build said so: `/api/events`
flipped from `○` (prerendered) to `ƒ` (server-rendered on demand). That matters
more than the flexibility did:

- Prerendered, the route is served from cache and costs no function invocation.
- Dynamic, **every distinct query string is its own cache key and its own
  invocation** — and query strings are unbounded. `?limit=abc1`, `?limit=abc2`,
  on forever. A parameter worth 80 extra rows would have handed anyone an
  unmetered invocation knob on a site that has already overrun its compute
  budget once.

So the limit is a constant, the handler takes no request, and the route is `○`
again. There is also no `offset`, for the same reason in a different shape:
without one, the cap is a ceiling rather than a speed bump — nobody walks 764
rows 20 at a time.

The deleted alternative is why `lib/api-events.ts` is a constant and a long
comment rather than a parser. The comment is the point: it records what the
endpoint is for, so the next person to find it doesn't either delete it or grow
it into an API by accident.

## Rate limiting was considered and rejected

`lib/rate-limit.ts` exists and is good, but it is built for **write paths** and
costs one Postgres upsert per check, failing open on database trouble. Pointing
it at a read endpoint would mean a database write per read — under exactly the
flood it is meant to stop, it makes the bill *larger*. The payload and the cache
headers are the root fix; the rate limiter would have been a second mechanism
treating the symptom.

One loose end it would have tidied: `app/terms/page.tsx` asks readers not to
"work around the rate limits" while no read-path limit exists. That contradiction
is older than this change and is left alone — it is a terms edit, not a code one.

## What shipped

| File | Change |
|---|---|
| [app/api/events/route.ts](../../app/api/events/route.ts) | fixed slice, cache headers, `x-robots-tag`, no request parsing |
| [lib/api-events.ts](../../lib/api-events.ts) | `API_EVENTS_LIMIT` and the rationale |
| `lib/__tests__/api-events.test.ts` | pins the ceiling — fails if the cap is raised enough to undo the fix |
| [docs/SETUP.md](../SETUP.md) | the smoke check now reads `count` |
| [docs/ARCHITECTURE.md](../ARCHITECTURE.md) | "operator convenience, capped, NOT a public API" |

## Quality gate

- `npx tsc --noEmit` — clean
- `npm test` — **2,877 passing**
- `npm run build` — clean; `/api/events` is `○` (prerendered, 5m revalidate)
- `npm audit` — **0 vulnerabilities**
- Smoked locally against the real database, before and after the `?limit=`
  removal; homepage still renders with no console errors

## Verify

```bash
curl -sS -D - -o /dev/null "https://www.citypulsemn.com/api/events"
```

1. `content-length` is around **15KB**, not 542KB.
2. `cache-control` reads `public, s-maxage=300, stale-while-revalidate=600`.
3. The body's `count` is the full published total; `events` has 20 entries.
4. `?limit=99999` changes nothing — the parameter is not read.

## Rollback

`git revert` and push. The endpoint goes back to returning everything, which is
the condition this guide exists to describe — so if something genuinely needed
the full table, the right answer is roadmap 6.2 with a decision behind it, not a
revert.
