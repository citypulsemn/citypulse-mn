# Deploy Guide — Roadmap 5.4: Saved-List Durability (Magic Links)

**Your saved list now survives anything.** Until today, saves lived in an anonymous browser cookie — clear the browser, get a new phone, or open a different device and the list was gone. Now `/saved` offers **"Keep this list"**: email yourself a signed link, open it anywhere, and your list comes with you.

**Code-only deploy. No database step, no new secrets** — it reuses the 5.3 `saver_token` column and the existing email key.

---

## The design (composes with 5.3, invents nothing)

The 5.3 identity bridge already links emails to saver tokens on the `subscribers` table. The magic link is just that bridge, made round-trip:

- **Request** (`/saved` → "Keep this list"): this browser's saver token is stored on the email's subscriber row, and a signed link goes out.
- **Restore** (open the link anywhere): the link resolves back to the token and points that device's cookie at it.
- **Merge, don't lose**: if the new device already had its own saves, they're merged into the restored identity before the switch. Restoring never costs a save.

**The consent rule worth calling out**: requesting a keep-link with a brand-new email does **not** subscribe you to the digest — the email is stored as `pending`, which the digest sender ignores. The form and the email both say so plainly. Keeping a list is not opting into a newsletter.

## Security properties (each one is a test)

| Property | How |
|---|---|
| Unforgeable | HMAC-SHA256 signed; the subscriber **id**, never the email, travels in the URL |
| **Expires in 7 days** | The expiry is *inside* the signed input — stretching the `exp` parameter breaks the signature. Unsubscribe links may live forever (worst case: you unsubscribe); a restore link *changes state* on whatever device opens it, so it dies. |
| No cross-purpose replay | An unsubscribe token (which sits in every email footer, forever) can **never** verify as a restore token for the same id, despite sharing the secret — purposes are namespaced inside the HMAC |
| No enumeration | The request form returns the identical success message whether or not the email exists |
| Bot resistance | Same honeypot as the subscribe form |
| Graceful failure | Tampered, expired, or garbage links land on `/saved` with a plain banner — verified against a live server with forged links; never an error page |

## Quality bar (all green)
- **415 tests (6 new)** — the security table above, literally: round-trip, expiry-by-one-second, tampered id/exp/token, the cross-purpose replay guard, and the full URL round-trip including death after the TTL.
- Live-server smoke: forged and garbage links redirect to the graceful banner (rendered HTML verified); the keep-form correctly doesn't appear on an empty list.
- The signed-link verification chain additionally exercised end-to-end with the runtime crypto directly.
- Typecheck clean, build clean, **0 vulnerabilities**.

---

## Deploy

Unzip `citypulse-mn.zip` over your repo, commit (`Saved-list magic links (roadmap 5.4)`) → push. That's it.

## Try it yourself (the real verification)

1. On your phone, save a couple of events, open `/saved` → the **"Keep this list"** box appears under your list.
2. Enter your email → "Check your inbox."
3. Open the email **on your laptop** (or a private window — that's a "new device" too) and click the button.
4. You land on `/saved` with a "Your list is back" banner and your events. Save something new there, click the link on the phone again — both devices now share one list.

- [ ] The email arrives, states the 7-day window and the "doesn't sign you up" promise.
- [ ] A mangled link (edit a character) lands on the polite "expired or isn't valid" banner.
- [ ] If you weren't a digest subscriber before, you still aren't (check Admin → Subscribers: your row says `pending`).

## Rollback
Roll back the deploy. Links stop resolving; nothing else changes. No data was migrated.

---

## Phase 5 status

5.1 analytics ✓ · 5.2 trending ✓ · 5.3 personalized digest ✓ · **5.4 durable saves ✓**. Remaining: **5.5 neighborhoods**, **5.6 the ops digest** (coverage + verification + pipeline health emailed to you weekly — a small, high-value bite), and **5.7 the Ongoing strip**. And the standing item: the **multi-day collapse** data op — the State Fair is still quadrupled, and the export query from earlier is ready whenever you are.
