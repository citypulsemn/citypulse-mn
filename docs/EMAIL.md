# Email capture

Roadmap 2.2. Converts the audience Instagram drives into an **owned** email list — the asset that later powers the weekly digest (Phase 3) and is genuinely monetizable (Phase 4), unlike rented social reach.

## How it works

- **Where:** a tasteful subscribe form in the site footer on the homepage, event pages, and day pages ("The week ahead, in your inbox").
- **Capture:** `SubscribeForm` (a React 19 `useActionState` form) posts to the `subscribeAction` server action. It works even without JS (progressive enhancement) and shows inline success / already-subscribed / error states.
- **Storage:** `addSubscriber` normalizes the email (trim + lowercase) and inserts into `subscribers` with `on conflict (email) do nothing`, so re-subscribing is a friendly "already on the list," never an error.
- **Validation:** pure `isValidEmail` / `normalizeEmail` (unit-tested). A hidden **honeypot** field silently absorbs bots.
- **Source tracking:** each signup records where it came from (`home`, `event`, `day`) for later attribution.

## Privacy & security

`subscribers` is **sealed** (RLS enabled, no anon policy) — the public REST API can neither read nor write it. All access is through the owner `DATABASE_URL` connection (server action to write, admin to read/export). Verified against a real Postgres engine: anon can't read or insert; the owner can; duplicates dedupe.

## Admin

The **Stats** tab shows subscriber **total** and **new-in-7-days**, plus a **Download CSV** button. The export lives at `/admin/subscribers/export` (behind admin auth, with `assertAdmin` defense-in-depth) and is CSV-injection-safe. Use it to move the list into an email tool.

## Consent policy (F2.3, decided Jul 21 2026)

The table carries `status` (`subscribed` / `pending` / `unsubscribed`) and `confirmed_at` / `unsubscribed_at` timestamps. The policy on top of them (Taren's call):

- **New signups are single opt-in.** An explicit form submit is consent; the row goes straight to `subscribed`. No friction, growth stays easy.
- **Resubscribe-after-unsubscribe is reconfirmed.** A row that *explicitly unsubscribed* (`unsubscribed_at` set and not currently `subscribed`) does **not** get promoted on a form submit — it goes to `pending`, keeping `unsubscribed_at` as the "not back until confirmed" flag, and we email a signed, 14-day **confirm link** (`/subscribe/confirm`). Clicking it sets `subscribed` + `confirmed_at`. This protects sender reputation and blocks a malicious re-add of someone who opted out. The confirm send is capped per target address (R2.1 helpers), same email-bomb guard as the keep-list link.
- **Keep-list `pending` rows are NOT reconfirmed** — they never unsubscribed, so submitting the newsletter form subscribes them immediately (single opt-in).
- One-click **unsubscribe** (`/unsubscribe`, RFC 8058) has shipped since Phase 3.

`confirmed_at` is now written (on reconfirmation); it was carried-but-unused before F2.3.

## Files

- `lib/subscribe.ts` — pure validators + DB boundary (`addSubscriber` → reconfirm state machine, `confirmSubscriber`, `getSubscriberStats`, `listSubscribers`).
- `lib/subscribe-actions.ts` — the public `subscribeAction` (honeypot + rate limit + result mapping + reconfirm send).
- `lib/confirm-token.ts` — HMAC confirm tokens (namespace `subscribe-confirm:`, 14-day TTL).
- `lib/confirm-send.ts` — the "confirm you're back" email (render + Resend send).
- `app/subscribe/confirm/route.ts` — the confirmation landing.
- `components/SubscribeForm.tsx`, `components/SiteFooter.tsx`.
- `app/admin/subscribers/export/route.ts` — CSV export.
