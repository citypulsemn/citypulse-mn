# Deploy R0.4 — magic-link restore: merge case fixed (wrong column, no catch)

*July 20, 2026 (evening). Roadmap v5 sprint R0, item 4.*

## The bug

`mergeAndRestore`'s merge insert referenced `saved_events.saver_token` — a real column,
but on **subscribers**; saved_events keys on `user_token`. Postgres 42703 → the route had
no catch → Next.js 500 page, in exactly the advertised merge-don't-lose case (open your
restore link on a device that already has its own saves). Only fresh-browser restores
worked, which is why it demoed fine and survived. The docs' "never an error page" promise
was broken from day one.

## What shipped

- `lib/saved-restore.ts` — `user_token` on both sides of the merge insert.
- `app/saved/restore/route.ts` — unexpected throws degrade to the `?restore=invalid`
  banner instead of a 500. `redirect()` stays OUTSIDE the try (it throws NEXT_REDIRECT
  by design; catching it would break the redirect).
- Tripwire tests (`lib/__tests__/saved-restore-queries.test.ts`): merge SQL targets
  `user_token`, `saver_token` never touches saved_events (while remaining legitimately on
  the subscribers insert). The R2.6 schema drift guard will generalize this class.

## Verification (against the real schema, zero residue)

Transaction-rollback probe on prod: the OLD SQL fails with **42703 undefined_column** as
diagnosed; the NEW SQL executes and merges a fixture token's saves (count verified inside
the txn); rollback confirmed — 0 fixture rows remain.

## Quality gate

tsc clean · 602/602 (2 new) · build clean · audit 0.

## Deploy steps

Push to `main`. Code-only.

## Verify checklist (post-deploy — needs two browsers, Taren)

- [ ] Save an event on browser A → request the link → save a DIFFERENT event on
      browser B → open the link on B → both events in the list, no error page.
- [ ] A garbage link (`/saved/restore?id=1&exp=1&t=x`) lands on the invalid banner.

## Rollback

`git revert`. Remaining R0: R0.5 resubscribe · R0.6 JSON-LD escape.
