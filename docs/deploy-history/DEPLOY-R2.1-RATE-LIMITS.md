# Deploy R2.1 — rate limits on the public write paths (sprint R2 opener)

*July 20, 2026 (late evening). Roadmap v5 sprint R2, item 1. The forcing reason:
the keep-list form would email a restore link to ANY typed address, as fast as a
script could POST it — an email bomb aimed at a stranger, on our Resend quota.*

## What shipped

**New: [lib/rate-limit.ts](../../lib/rate-limit.ts)** — one counter table, no new infra.
`rateAllow(bucket, limit, windowMinutes)` does a **single atomic upsert** (insert
… on conflict … returning n): the window resets in place when it lapses, and two
concurrent requests can't both slip under the cap the way a read-then-write would
allow. **Fail open** on missing DB or DB error (a rate-limit outage must never
take down subscribing — rule 1), **fail closed** on the limit.

**New table `rate_events`** (bucket pk, window_start, n) — additive, idempotent,
RLS enabled, **already applied to prod**. Holds IPs/emails transiently for abuse
control only; the weekly pipeline prunes buckets idle 2+ days (`pruneRateEvents`
in [run-pipeline.ts](../../scripts/run-pipeline.ts)).

**Wired at five points, always AFTER the honeypot** (bot noise the honeypot eats
never inflates a bucket):

| Surface | Cap | Over the cap |
|---|---|---|
| Keep-list email, per **target address** | 3/hour | generic success, no send |
| Keep-list request, per IP | 10/hour | generic success |
| Subscribe, per IP | 30/hour | honest error, try again later |
| Submit event, per IP | 10/hour | honest error |
| Beacon, per IP | 240/hour | dropped, same 204 |

## Design decisions (why these shapes)

- **Keep-list throttling is silent** — the no-enumeration rule extends to the
  cap: an attacker looping a victim's address gets "check your inbox" forever
  while nothing sends. A real requester's first 3 links are already in their inbox.
- **Subscribe/submit throttling is honest** — a silently dropped subscriber
  thinks they're on the list and never retries; that's a lost reader. Nothing is
  sent to third parties on these paths, so telling the truth costs nothing.
- **Subscribe cap is the loosest form cap (30/hr/IP)** — one venue Wi-Fi during a
  promoted show is many real people behind one address. Still three orders of
  magnitude below a script loop.
- **Beacon parses before counting** so junk POSTs don't cost a counter write, and
  the response never varies (uniform 204) so the cap is invisible from outside.

## Verification (observed, not intended)

- Rolled-back-transaction probe against prod: 4 hits at limit 3 →
  `true,true,true,false`; counter read back n=4; window backdated 2 hours → next
  hit allowed with n reset to 1 and a fresh window_start; rollback left 0 rows.
- Tests +17 (652/652): fail-open (null db, throwing db), boundary (n==limit
  allowed, n==limit+1 blocked), atomic-upsert query tripwires, honeypot-before-
  rateAllow ordering on all three forms, per-email gate before the subscriber
  insert, beacon uniform-204, schema/pipeline tripwires, limit sanity.
- Quality gate: tsc clean · 652/652 · build clean · audit 0.

## Deploy steps

1. ~~Apply schema~~ — **done** (create table if not exists, idempotent; re-running
   `db/schema.sql` is safe as always).
2. Push to `main` → Vercel.

## Verify checklist

- [ ] Subscribe with a test address once — normal success (nowhere near any cap).
- [ ] `select bucket, n, window_start from rate_events order by window_start desc limit 10;`
      after some traffic — buckets appear, n counts look like human numbers.
- [ ] Next pipeline run logs `pruned N stale rate-limit bucket(s)` once buckets age out.

## Rollback

`git revert` the commit. The `rate_events` table can stay (nothing else touches
it); an unused counter table is harmless.
