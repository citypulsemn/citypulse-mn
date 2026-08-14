# Deploy — G1.1: /this-week conversion improvements

*August 2026. Tier 1 (audience). Code-only.*

## What shipped

Conversion improvements to the `/this-week` landing — the weekly-email shop
window. The G1.1 attribution panel showed `this-week` converting **0** subscribers;
G1.2 fixed its *traffic* (sitewide nav + footer links), and this improves the
page's *conversion rate* once visitors arrive.

**The problem:** the page's single subscribe band sits at the very bottom
(hook → proof → ask), so a scanner who reads the intro and browses the events may
leave before ever reaching the ask.

**The fix (within the one-band / no-popup rule):**
- **An above-the-fold path to the single band.** The intro's "get the next one in
  your inbox →" is now an anchor CTA (`#subscribe-band-title`) that jumps to the
  one band. Above-the-fold readers can reach the ask in one click — **no second
  form, no popup**. (Verified: clicking it scrolls the band from 1228px off-screen
  to 320px in view, clearing the header via `scroll-margin-top`.)
- **Sharper ask copy** tying the sample to the product:
  *"You're reading this week's — subscribe and next Thursday's lands in your inbox.
  Free, no spam, unsubscribe anytime."* (was "One email a week — the week's best,
  hand-picked. Free, no spam.") The "unsubscribe anytime" line lowers friction.

Still **exactly one band per page** (asserted) — this adds a *link* to it, not a
second ask.

## Files
- [app/this-week/page.tsx](../../app/this-week/page.tsx) — intro CTA anchor +
  sharpened band `sub` (both the populated and honest-empty branches).
- [app/globals.css](../../app/globals.css) — `.page-intro-cta` style +
  `scroll-margin-top` on `.subscribe-band-title` so the jump clears the header.

## Verification

Gate: `tsc` clean · **1003** tests (+1 tripwire: the CTA anchors to
`#subscribe-band-title`, uses `page-intro-cta`, and the ask ties sample→product) ·
`npm run build` clean · `npm audit` 0.

**Browser-verified (dev):** the intro CTA reads "get the next one in your inbox →"
with `href="#subscribe-band-title"`; the band shows the new copy; exactly **one**
`.subscribe-band` on the page; clicking the CTA scrolls the band into view
(1228px → 320px). No console errors.

## How we'll know it worked

Watch **Admin → Stats → "Where subscribers come from"** — `this-week` should start
accruing signups (it was 0). The G1.1 attribution panel is the closed-loop metric
for this change.

## Deploy steps

Push to `main`. Code-only, no schema, no env.

## Rollback

`git revert`. Copy + one anchor link; nothing structural.
