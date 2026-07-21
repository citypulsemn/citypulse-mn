# Deploy F2.3 — resubscribe confirmation (the consent policy layer)

*July 21, 2026. Roadmap v5 F2.3. The policy `docs/EMAIL.md` deferred since day
one, now decided and built. No schema change — the fields (`status`,
`confirmed_at`, `unsubscribed_at`) have carried this since the table was created.*

## The decision (Taren, Jul 21)

**Single opt-in stays for new signups; only a return-after-unsubscribe is
reconfirmed.** New readers join instantly (no growth tax). Someone who
*explicitly left* must click a confirm link to come back — you left on purpose,
so returning is deliberate, and a malicious re-add of an opted-out victim is
blocked. (The alternatives — full double opt-in, or deferring — were weighed;
this is the low-friction middle that still protects sender reputation.)

## The state machine

`addSubscriber`'s conflict path gains ONE exception. The reconfirm trigger is
precise: `unsubscribed_at is not null AND status <> 'subscribed'`.

| Existing row | Form submit → | Result |
|---|---|---|
| none (new email) | `subscribed` | added |
| `subscribed` | stays `subscribed` | already |
| keep-list `pending` (never unsubscribed) | `subscribed` | resubscribed |
| **explicitly `unsubscribed`** | **`pending`, keeps `unsubscribed_at`** | **reconfirm → email** |
| reconfirm-`pending` (email failed, retry) | stays `pending` | reconfirm → email |

`confirmSubscriber(id)` promotes **only** a `pending` row (`where status =
'pending'`) to `subscribed` + `confirmed_at = now()`, clearing
`unsubscribed_at`. Scoping to pending means a stale confirm link can never
resurrect a row that has since unsubscribed again; a double-click reads back as
"already".

## Pieces

- **[lib/confirm-token.ts](../../lib/confirm-token.ts)** — HMAC tokens, namespace
  `subscribe-confirm:`, 14-day TTL. Distinct namespace ⇒ an unsubscribe or
  restore token can never be replayed as a confirm token (all share the secret).
- **[lib/confirm-send.ts](../../lib/confirm-send.ts)** — the "confirm you're back"
  email (plain-fetch Resend, missing key = honest infra failure).
- **[app/subscribe/confirm/route.ts](../../app/subscribe/confirm/route.ts)** — the
  landing (GET; success / expired pages mirror the unsubscribe route).
- **[lib/subscribe-actions.ts](../../lib/subscribe-actions.ts)** — sends the confirm
  email on the reconfirm result, **capped per target address** (3/hr, the same
  email-bomb guard as the keep-list link); throttled → generic check-inbox
  message, nothing sent. Honest failure copy if Resend is down.

## Verification (observed, not intended)

- **Rolled-back transaction probe against prod** proved every branch on real
  Postgres: unsubscribed→resubmit lands `pending` keeping `unsubscribed_at`;
  confirm promotes to `subscribed` with `confirmed_at` set and `unsubscribed_at`
  cleared; keep-list `pending`→resubmit subscribes immediately; subscribed
  re-submit stays subscribed. Rollback left 0 rows.
- **Live dev server:** `/subscribe/confirm` with no token renders the styled
  "Link expired" page (400); no server errors. Success page is the
  unsubscribe-route template (live-proven) with the DB effect proven above.
- Tests +15 (713/713): confirm-token round-trip / expiry / tamper / cross-purpose
  replay (unsub & restore tokens rejected) / URL end-to-end; confirm-email
  content; addSubscriber reconfirm-predicate + pending-parking + report mapping;
  confirmSubscriber pending-scoping + outcome mapping + id guard; action-layer
  per-email cap ordering.
- Schema drift guard stayed green (every referenced column exists).
- Gate: tsc clean · 713/713 · build clean · audit 0.

## Deploy steps

Push to `main`. **No schema change.** Requires the already-present secrets
(`RESEND_API_KEY`, `DIGEST_FROM`, `UNSUBSCRIBE_SECRET`, `SITE_URL`) — the confirm
token reuses `UNSUBSCRIBE_SECRET`, the confirm email reuses the Resend creds.

## Verify checklist

- [ ] Subscribe a fresh test address → instant "on the list" (single opt-in unchanged).
- [ ] Unsubscribe it (footer link) → then resubscribe → "check your inbox to
      confirm you're back"; the confirm email arrives; clicking it → "You're back
      on the list"; it now appears `subscribed` with a `confirmed_at`.
- [ ] Re-open the same confirm link → still shows success (idempotent), no error.

## Rollback

`git revert`. The new columns were already in the schema and are harmless if
unwritten; no migration to undo.
