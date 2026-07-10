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

## Status field & what's deferred

The table carries `status` (`subscribed` / `pending` / `unsubscribed`) and `confirmed_at` / `unsubscribed_at` timestamps, so a **double opt-in** and one-click **unsubscribe** can be added when the digest ships — both require an email-sending provider (e.g. Resend/Postmark), which is a Phase 3 concern. Today's capture is single opt-in.

## Files

- `lib/subscribe.ts` — pure validators + DB boundary (`addSubscriber`, `getSubscriberStats`, `listSubscribers`).
- `lib/subscribe-actions.ts` — the public `subscribeAction` (honeypot + result mapping).
- `components/SubscribeForm.tsx`, `components/SiteFooter.tsx`.
- `app/admin/subscribers/export/route.ts` — CSV export.
