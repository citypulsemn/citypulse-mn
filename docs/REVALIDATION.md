# On-demand revalidation

How a script tells the live site to drop its caches.

## Why this exists

Until now, the only thing that could bust a cache was `refresh()` in
`lib/admin-actions.ts` — a server action, reachable only from the admin UI.

Everything else that changes what the public sees runs as a **script**: the
Monday pipeline, the verify pass's evidence-gated cancellations, the sports and
venue importers, the bulk hide/dedupe/conflict tools. None of them run inside
Next, so none of them could call `revalidateTag`.

That gap had a recorded cost. From `HOTFIX-sports-phantom-games.md`, after 26
phantom listings were hidden by script:

> Vercel's cache was not busted by `refresh()`. A deploy was pushed immediately
> after to clear it — otherwise the hidden games would have sat on cached pages
> for up to the 1-hour `EVENTS_TTL_SECONDS` window.

Pushing an empty deploy to clear a cache is a workaround, not a mechanism.

It also had a running cost. Because freshness came only from short ISR windows,
those windows had to stay short — and across 2,198 sitemap URLs crawled about
once a day, a 1-hour window means **every crawl finds every page stale and pays
for a full re-render**: 80,539 ISR writes in 30 days against 3,464 human page
views, and Fluid Active CPU 4h16m over a 4h allowance (26 Aug 2026).

**With a real bust-on-write channel, freshness stops being a function of TTL.**

## The endpoint

`POST /api/revalidate`

```
Authorization: Bearer $REVALIDATE_SECRET
Content-Type: application/json

{ "reason": "verify pass — 2 cancelled", "eventIds": ["<uuid>", ...] }
```

An empty body is the normal case and means "bust everything". `eventIds` is an
**addition** to the always-total tag bust, never a restriction — a caller cannot
ask for less than the tag, because a partial bust is exactly what leaves a hidden
event on a city page. Bounded at 200 ids.

It clears the same two layers as `refresh()`, in the same order:

1. `revalidateTag(EVENTS_TAG)` — the shared events DATA cache. Skip this and the
   pages re-render but re-read the still-cached `getEvents()` array.
2. `revalidatePath("/", "layout")` — the PAGE cache for the whole public tree.
3. `revalidatePath('/event/<id>')` per id supplied.

A test asserts the endpoint and `refresh()` stay in step. If one gains a layer,
the other must.

### Responses

| | |
|---|---|
| `200` | cleared; body reports what |
| `401` | missing, malformed or wrong token |
| `503` | **`REVALIDATE_SECRET` is not configured on the server** |
| `405` | someone sent a GET |

**It fails closed.** No secret configured means 503, not "allow" — mirroring
`middleware.ts`, which denies `/admin` outright when `ADMIN_PASSWORD` is unset.
An endpoint that dumps every cache is not something to leave open because an env
var went missing. 503 rather than 401 so a misconfigured deploy is
distinguishable in the logs from a caller with the wrong key.

GET never revalidates — otherwise a crawler or a link prefetch could dump the
cache by following a URL.

## The secret

`REVALIDATE_SECRET` — a long random string. It must be set in **three** places:

| Where | Why |
|---|---|
| Vercel (all environments) | the endpoint reads it; without it every call 503s |
| GitHub Actions secrets | the pipeline and verify workflows call it |
| `.env.local` | so `npm run revalidate` works from your machine |

Generate one with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Never printed, never committed, never echoed in a response body.

## Who calls it

| Script | When |
|---|---|
| `run-pipeline` | end of a successful run — the biggest writer on the site |
| `verify-events` | after cancellations, **with the cancelled ids** |
| `import-sports` | after a non-dry run |
| `import-venues` | after a non-dry run that changed something |
| `dedupe-flagged` · `hide-placeholders` · `resolve-conflicts` | after `--apply` |
| `collapse-multiday` | after a non-dry run that archived or collapsed |

Plus by hand:

```bash
npm run revalidate
npm run revalidate -- --reason="hid a bad listing" --event=<uuid>
```

## Rule 1 applies, in both directions

`revalidateAndReport` (used by the scripts) **never throws and never changes an
exit code**. A pipeline that imported 305 events correctly has succeeded even if
the CDN serves a stale page for another hour. A broken instrument must not kill
its panel.

But it is **loud** — a failure prints `⚠ revalidation did NOT happen` with the
reason, because silence here would mean stale cancellations sitting behind a long
TTL with nothing saying so.

`npm run revalidate` is the deliberate exception: it **exits non-zero** on
failure, because a human running it by hand is asking whether it worked.

## Verify it works

```bash
npm run revalidate -- --reason="smoke test"
```

`✓ caches cleared` means the whole channel is live. Anything else names what is
wrong — an unset secret, a 401, an unreachable host.

Proven end-to-end on 26 Aug 2026 against a production build: `x-nextjs-cache`
went **HIT → HIT → (revalidate) → MISS → HIT**, and a refused call left the page
on HIT.

## Still to do

**The TTLs have not been raised yet.** This endpoint is the prerequisite, not the
saving. Raising `revalidate` on the event/venue/city/day pages is what actually
cuts the CPU bill, and it must not happen until the secret is set and
`npm run revalidate` has been seen to succeed against production — otherwise a
cancellation would sit behind a long TTL with no way to clear it.

Next.js requires `revalidate` to be a literal, so this cannot be flipped by an
env var (verified: `Unsupported node type "BinaryExpression"`). It is a code
change, deliberately sequenced after the secret exists.
