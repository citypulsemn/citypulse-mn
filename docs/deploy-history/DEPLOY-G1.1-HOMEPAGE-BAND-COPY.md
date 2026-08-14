# Deploy — G1.1: homepage subscribe band copy

*August 2026. Tier 1 (audience). Code-only.*

## What shipped

Sharper copy on the homepage subscribe band — the site's **~60% conversion
surface** (per the G1.1 attribution panel). It had been rendering the generic
component default; now it carries homepage-specific, benefit-driven copy.

**Before** (component default): "Get the week's best in your inbox" / "One email
every Thursday — the Twin Cities' best events, hand-picked. Free, no spam."

**After** (homepage-specific):
- Heading: **"Every Thursday: the week's best, hand-picked"** — the exact concrete
  value-prop the G1.1 roadmap called for ("…beats 'Subscribe for updates'").
- Sub: **"Skip the scroll — one email a week with the concerts, games, and weekend
  plans worth your time, chosen from everything here. Free, unsubscribe anytime."**
  "Skip the scroll" and "chosen from everything here" speak directly to a visitor
  browsing the full calendar; "unsubscribe anytime" lowers friction.

Still **exactly one band, mid-flow, no popup** (the placement test pins that; copy
itself stays deliberately unpinned — it's Taren's to edit freely, plain strings in
`app/page.tsx`).

## Scope note

Only the homepage band changed. The event and This-Weekend bands still use the
component default; the homepage is the high-traffic workhorse worth tailoring
first. The default remains available to sharpen later if those surfaces warrant it.

## Verification

Gate: `tsc` clean · **1003** tests (placement test green — one band, source=home,
mid-flow before the collections strip and footer) · `npm run build` clean ·
`npm audit` 0.

**Browser-verified (dev):** the homepage shows exactly one `.subscribe-band` with
the new heading and sub, `source="home"` intact for attribution. No console errors.

## How we'll know it worked

**Admin → Stats → "Where subscribers come from"** — `home` is already the leading
placement (~60%); watch whether its share or recent-30d count lifts after the copy
change.

## Deploy steps

Push to `main`. Code-only, no schema, no env.

## Rollback

`git revert`. Copy-only; reverting restores the component default on the homepage.
