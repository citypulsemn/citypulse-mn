# Deploy R0.5 — resubscribing works again (and the UI stops lying about it)

*July 20, 2026 (evening). Roadmap v5 sprint R0, item 5.*

## The bug

`addSubscriber`'s conflict path only refreshed `saver_token` — it never touched `status`,
and nothing else in the codebase ever sets status back to `'subscribed'`. So: unsubscribe →
resubmit the footer form → "You're already subscribed 🎉" → never mailed again, forever,
silently. Same for keep-my-list users (rows created `'pending'`) who later subscribed on
purpose. The unsubscribe page's printed promise ("You can resubscribe anytime") was false,
and the failure quietly capped list growth on the product's core asset.

## What shipped

- `lib/subscribe.ts` — the conflict update promotes `status = 'subscribed'` and clears
  `unsubscribed_at` (an explicit form submit is consent). A `prior` CTE reads the
  pre-statement snapshot so the result distinguishes **added / resubscribed / already**.
  The 5.3 saver-token coalesce is untouched.
- `lib/subscribe-actions.ts` — honest copy for the new case: "Welcome back — you're on
  the list again."
- **Policy, stated deliberately:** resubscribe is immediate (no confirmation email). The
  double-opt-in / confirmation layer is F2.3 and intersects `docs/EMAIL.md`'s deferred
  decision — build it there, not ad hoc here. `confirmed_at` remains untouched.
- Tripwires (`lib/__tests__/subscribe-queries.test.ts`): promotion + clear present,
  prior-status snapshot present, coalesce intact.

## Verification (against prod, zero residue)

Rolled-back-transaction probe ran the exact conflict statement through all five roadmap
cases: fresh insert → `added` · resubmit while active → `already` (token kept) ·
unsubscribed → resubmit → `resubscribed` with status/`unsubscribed_at` restored ·
pending → subscribe → `resubscribed` (promoted, new token coalesced) · rollback left 0
fixture rows.

## Quality gate

tsc clean · 605/605 (3 new) · build clean · audit 0.

## Deploy steps

Push to `main`. Code-only.

## Verify checklist (post-deploy)

- [ ] Live round-trip with a test address: subscribe → unsubscribe → resubscribe →
      banner says "Welcome back" → address appears in the digest recipient count.

## Rollback

`git revert`. Remaining R0: R0.6 JSON-LD escape — the sprint closer.
