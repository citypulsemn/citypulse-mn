# Personalized digest

Roadmap 5.3. The weekly email leads with the subscriber's own saved events and reorders the general picks toward their taste. A reminder beats a recommendation.

## The identity bridge (the design decision)

Subscribers are emails; savers are anonymous cookies. The bridge: **when someone subscribes, the server action reads the same anonymous `cpid` cookie the save button uses and stores it on the subscriber row** (`subscribers.saver_token`). The link is created only when a person voluntarily hands over their email, from their own browser.

- **Re-subscribing refreshes the link** — that's also how an *existing* subscriber connects their saves: submit the footer form once from the browser they save in. (Harmless: the upsert keeps them subscribed.)
- **Unsubscribing severs it** (`saver_token = null`) — no reason to keep the link for someone who left.
- **Used for exactly one thing**: showing subscribers their own saved events in their own email. It appears nowhere else — not in analytics, not in the admin.
- Honest limitation: a subscriber who saves on their phone but subscribed from their laptop won't see personalization until they resubmit from the phone. Roadmap 5.4 (magic-link saved lists) is the durable fix.

## What changes in the email

- **Subject**: `You saved "X" — happening this week` (or `You saved N events…`).
- **A leading section**: "You saved these — happening this week" — their published saves starting (or still running, multi-day aware) within 7 days, soonest first, capped at 5. All-day events labeled honestly.
- **"Also worth your time"**: the same curated picks, reordered by category affinity (ranked from ALL their saves — taste is long-lived even when plans aren't). Stable within categories, so curation survives; events already in the personal section are dropped (no double-feature).
- **No token, no saves, or nothing imminent ⇒ byte-identical to the standard digest** (tested literally — same HTML string).

## Plumbing

`lib/digest-personal.ts` (pure: `selectSavedUpcoming`, `categoryAffinity`, `personalizePicks`) · `renderDigestEmail` gains optional `savedThisWeek` (HTML + plain-text) · the send loop fetches saves once per distinct token and renders per-recipient (it already did, for unsubscribe links). Failures degrade to the standard digest — personalization must never cost anyone their email. The run result note reports `N personalized`.
