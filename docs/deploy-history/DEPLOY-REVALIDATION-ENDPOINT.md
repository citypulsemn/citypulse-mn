# Deploy — scripts can finally clear the cache (26 Aug 2026)

## What shipped

`POST /api/revalidate`, and the eight scripts that change what the public sees
now call it. Full reference in `docs/REVALIDATION.md`.

**This is a prerequisite, not a saving.** It does not reduce CPU by itself. It is
the thing that makes raising the TTLs safe, and that raise is deliberately a
separate step — see "Deploy steps" below, and do them in order.

## The gap it closes

The only thing that could bust a cache was `refresh()` in `lib/admin-actions.ts`
— a server action, reachable only from the admin UI. Everything else that changes
the public view runs as a script, outside Next, and could not call
`revalidateTag`.

That cost was already recorded. From `HOTFIX-sports-phantom-games.md`, after 26
phantom listings were hidden by script:

> Vercel's cache was not busted by `refresh()`. A deploy was pushed immediately
> after to clear it.

Pushing an empty deploy to clear a cache is a workaround, not a mechanism.

## Design decisions worth the words

**Fails closed.** No `REVALIDATE_SECRET` configured → **503**, not "allow".
Mirrors `middleware.ts` denying `/admin` when `ADMIN_PASSWORD` is unset. 503
rather than 401 so a misconfigured deploy is distinguishable in the logs from a
caller with the wrong key.

**GET never revalidates** (405). Otherwise a crawler or a link prefetch could
dump every cache by following a URL.

**`eventIds` can only add, never restrict.** An empty body means "bust
everything", and ids are extra page busts on top of the always-total tag bust. A
caller cannot ask for less than the tag, because a partial bust is precisely what
leaves a hidden event on a city page. Bounded at 200.

**Timing-safe token comparison**, with the length check first — `timingSafeEqual`
throws on a length mismatch, so a naive call would turn a short token into a 500.
The house idiom from `lib/confirm-token.ts` et al.

**Rule 1, in both directions.** `revalidateAndReport` never throws and never
changes an exit code: a pipeline that imported 305 events correctly has succeeded
even if a page stays stale for an hour. But it is loud — a failure prints
`⚠ revalidation did NOT happen` with the reason, because silence is what would
let a cancellation hide behind a long TTL. `npm run revalidate` is the deliberate
exception and exits non-zero, because a human running it is asking whether it
worked.

**The endpoint mirrors `refresh()` exactly**, and a test asserts they stay in
step. If one gains a cache layer and the other doesn't, a script-driven change
clears one and not the other — the trap refresh()'s own comment warns about.

## Verified end-to-end, against a production build

| | |
|---|---|
| GET | 405, and no revalidation |
| POST no header | 401 `missing Authorization header` |
| POST wrong token | 401 `bad token` |
| POST bare token, no `Bearer` | 401 `expected 'Bearer <token>'` |
| POST valid, empty body | 200, tag + tree |
| POST valid + 1 good + 1 malformed uuid | 200, `eventIds: 1` — the bad one dropped |
| **Server with no secret** | **503**, and the page stayed `HIT` |

And the thing that actually matters — the cache really clears:

```
/this-week   x-nextjs-cache:  MISS → HIT → HIT → [revalidate] → MISS → HIT
```

A refused call left it on `HIT`, so the auth gate is not decorative.

Script side, against the same server:

```
npm run revalidate -- --reason="script smoke test" --event=<uuid>
  → [revalidate] ✓ caches cleared                       exit 0

with REVALIDATE_SECRET unset:
  → ✗ FAILED: REVALIDATE_SECRET is not set              exit 1
with a wrong secret:
  → ✗ FAILED (HTTP 401): {"ok":false,"error":"bad token"} exit 1
```

`.env.local` was borrowed for these tests and **restored byte-identical** (451
bytes, `cmp` clean). No test secret is left on the machine.

## Deploy steps — order matters

1. **Generate the secret.**
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   ```
2. **Set `REVALIDATE_SECRET` in three places:** Vercel (all environments),
   GitHub Actions secrets, and your local `.env.local`.
3. Merge to `main`. Nothing is build-time; no schema change. The workflows
   already pass the secret to the five steps that run a revalidating script
   (`weekly-research` ×3, `verify-events`, and the pre-send verify inside
   `weekly-digest`); `ops-digest` deliberately gets nothing, since it only reads.
4. **Confirm it works before anything depends on it:**
   ```bash
   npm run revalidate -- --reason="post-deploy smoke test"
   ```
   `✓ caches cleared` is the green light. **Until this passes, do not raise any
   TTL** — a long window with a broken bust channel is worse than what we have.
5. Only then, the follow-up: raise `revalidate` on the event/venue/city/day
   pages. That is the change that cuts the CPU bill.

If step 2 is skipped, nothing breaks: every call fails, each one prints a ⚠ with
the reason, and the site behaves exactly as it does today.

## Why the TTL raise is not in this commit

Next requires `revalidate` to be a literal, so it cannot be flipped by an env var
once the secret is confirmed. Tested rather than assumed:

```
export const revalidate = Number(process.env.PAGE_TTL_SECONDS) || 1800;
→ Unsupported node type "BinaryExpression" at "revalidate".
```

Since Vercel auto-deploys on push to `main`, shipping both together would put
long TTLs live at the same moment as the mechanism they depend on, with no
opportunity to check the secret in between. So: mechanism now, raise after step 4.

## Rollback

Delete `app/api/revalidate/route.ts` and unset the secret; the scripts' calls
become no-ops that log a warning. Or just unset `REVALIDATE_SECRET` — every call
fails closed and the site returns to TTL-only freshness. Nothing is destructive
and no data is touched.

## Quality gate

`npx tsc --noEmit` clean · **1468/1468** tests (+14) · `npm run build` exit 0 ·
`npm audit` 0 vulnerabilities · every auth path and the cache-clearing itself
exercised against a production build in a real browser.
