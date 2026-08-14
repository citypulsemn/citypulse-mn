# Deploy — G1.1: digest footer forward-to-a-friend ask

*August 2026. Tier 1 (audience / referral loop). Code-only.*

## What shipped

Sharper referral copy in the weekly email digest footer — the one subscribe
touchpoint aimed at *existing* subscribers (the viral/referral loop). The old ask
was passive; the new one leads with the highest-leverage, zero-friction action:
forwarding the email itself.

**Before:** "Know someone who'd like this? Send them citypulsemn.com/this-week."

**After:** "Enjoying this? **Forward it to a friend** — or send them
citypulsemn.com/this-week **to get their own**."

Why: a subscriber forwarding the email is one tap and the strongest referral
mechanic; the `/this-week` link (UTM-tagged `utm_medium=forward`) is then the
friend's path to their own subscription — the shop-window page we've been
sharpening. "to get their own" makes the outcome explicit.

Applied to **both** the HTML and plain-text parts of the email.

## Files
- [lib/digest.ts](../../lib/digest.ts) — `renderDigestEmail` footer, HTML + text.

## Verification

Gate: `tsc` clean · **1003** tests (digest suite green — the forward link tripwire
still holds: HTML keeps `.../this-week?utm_source=email&utm_medium=forward`, text
keeps the `/this-week` URL) · `npm run build` clean · `npm audit` 0.

**Rendered-output check** (`renderDigestEmail`, empty-week sample):
```
HTML footer: Enjoying this? Forward it to a friend — or send them
             citypulsemn.com/this-week to get their own.   [utm forward link: true]
TEXT footer: Enjoying this? Forward it to a friend — or send them
             https://citypulsemn.com/this-week to get their own.
```

## How we'll know it worked

The forward link carries `utm_source=email&utm_medium=forward`, so referral-driven
visits to `/this-week` show up in Vercel Analytics by that UTM; signups from them
land under the `this-week` source in **Admin → Stats → "Where subscribers come
from."** A rising `this-week` share is the referral loop plus the on-page
conversion work compounding.

## Completes the G1.1 conversion-copy pass

All subscribe touchpoints now sharpened: home / event / this-weekend bands, the
/this-week landing (CTA + copy), the first-save nudge, and this digest referral ask.

## Deploy steps

Push to `main`. Takes effect on the next weekly `digest` send. Code-only, no
schema, no env.

## Rollback

`git revert`. Copy-only.
