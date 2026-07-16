# Saved-list durability (magic links)

Roadmap 5.4. Saves live in an anonymous httpOnly cookie — clear the browser or switch phones and the list was gone. Now: from `/saved`, email yourself a signed link; open it on any device and the list comes with you.

## How it composes with 5.3

The 5.3 identity bridge (`subscribers.saver_token`) is the lookup. Requesting a keep-link upserts the email with **this browser's** token; opening the link resolves the token back and points the new device's cookie at it. No new identity system, one nullable column reused.

**Consent rule**: a brand-new email is stored as `status = 'pending'` — asking to keep your list is *not* subscribing to the digest (the sender only mails `status='subscribed'`). The email and the form both say so. An existing subscriber keeps their status untouched.

## Security properties (all tested)

- **Signed**: HMAC-SHA256 over `saved-restore:{id}:{exp}` — unforgeable without the secret, id (never the email) in the URL.
- **Expiring**: 7 days, baked into the signed input — a stretched `exp` param fails the HMAC. Unlike unsubscribe links (which may live forever — worst case you unsubscribe), a restore link *changes state* on whatever device opens it, so it dies.
- **Purpose-namespaced**: an unsubscribe token (public-ish — it sits in every email footer) can NEVER verify as a restore token for the same id, despite the shared secret.
- **No enumeration**: the request form returns the same success message whether or not the email exists.
- **Honeypot** on the form, same as subscribe.
- **Graceful failure**: tampered/expired/garbage links land on `/saved` with a plain banner — verified against a live server, never an error page. A link whose subscriber no longer has a token (e.g. they unsubscribed, which severs it) is invalid.

## Merge, don't lose

If the device opening the link already has its own saves under a different token, they're **merged into the restored identity** (`insert … on conflict do nothing`) before the cookie switches. Nothing is ever lost by restoring.

## Pieces

`lib/restore-token.ts` (pure, tested) · `lib/saved-restore.ts` (request + merge/restore + email render) · `lib/saved-restore-actions.ts` (server action) · `components/KeepListForm.tsx` (shown on `/saved` only when the list is non-empty) · `app/saved/restore/route.ts` (landing). Email sends via the existing Resend key; without one, the link is logged server-side (dev).
