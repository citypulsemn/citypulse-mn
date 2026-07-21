# Deploy R2.7 — housekeeping batch (sprint R2 closer)

*July 20, 2026 (late evening). Roadmap v5 sprint R2, item 7 — five XS fixes
bundled, closing the sprint.*

## What shipped

**a) SSRF surface closed** ([next.config.ts](../../next.config.ts)). The image
optimizer allowed `https://**` — any crafted `event.image` could aim the
server-side fetcher anywhere. Recon first, per the spec: **zero events carry
images in prod** and nothing routes remote URLs through `next/image` (detail
art is CSS backgrounds), so the config guarded an optimizer with no users.
Removed entirely — remote images now refused by default. If images ever ship
through `next/image`, allowlist specific hosts; never `**`.

**b) Canonical origin aligned to what actually serves**
([lib/seo/site.ts](../../lib/seo/site.ts)). Verified live: the apex
`citypulsemn.com` **308-redirects to `www`**; Vercel serves `www` directly, and
`SITE_URL` in Vercel/Actions/.env.local is already `www`. The hardcoded apex in
`site.ts` meant every canonical URL, sitemap entry, JSON-LD id, and ICS URL
round-tripped through a redirect. Now `www` everywhere — `app/layout.tsx`
metadataBase and the admin digest preview read the constant instead of
hardcoding. (GSC is a domain property, so the sitemap's host change is benign;
the next crawl simply stops seeing 308s.)

**c) `digest_sends` honesty** ([lib/digest-send.ts](../../lib/digest-send.ts),
[lib/subscribe.ts](../../lib/subscribe.ts)): dry runs no longer insert rows (a
rehearsal must never pose as "the last digest" in the ops email — same
philosophy as `ops_digest_runs`); the `recipients` column now records
**attempted** rather than the possibly-partial sent count, with partial
failures noting "sent N of M before failure"; and `getSubscriberStats` counts
`status = 'subscribed'` only — `pending` keep-list rows no longer inflate the
admin "Subscribers" tile beyond who actually gets mailed.

**d) List-Unsubscribe delivery check — owner action, Monday.** The headers ride
Resend's **batch** endpoint, which has historically dropped per-message custom
headers. After Monday's real send: Gmail → the digest → ⋮ → **Show original** →
search `List-Unsubscribe`. Present: done, close this item. Absent: switch
`sendWeeklyDigest` to per-recipient `/emails` calls (the sender already chunks;
it's a small loop change) — it's a Gmail/Yahoo bulk-sender requirement.

**e) Keep-list token overwrite — merge-on-request (Taren's product call)**
([lib/saved-restore.ts](../../lib/saved-restore.ts)). Typing your email on a
1-save phone used to repoint your subscriber row at the phone's token,
orphaning the 100-save laptop list. Now the prior token's saves fold into the
requesting device's token **before** the row repoints — the emailed link
restores the union, a mid-flight failure leaves the old pointer intact, and
personalization follows a list that's never smaller than before. Mirrors
`mergeAndRestore`'s merge-don't-lose.

## A dividend along the way

The R2.6 drift guard flagged my first draft of (e) — its `on conflict`
lookahead crossed a template-literal boundary and mis-attributed columns. The
guard's parser now stops at the closing backtick; the false-positive class is
fixed, and the guard proved it runs hot on day one.

## Verification (observed, not intended)

- Prod probes: image-host query returned **no hosts** (0 events with images) ·
  apex→www 308 observed directly.
- Tests +7 (684/684): merge-before-repoint order · union merge fragments ·
  different-token guard · dry-runs-leave-no-row · attempted-not-sent ·
  partial-failure note · subscribed-only stats.
- Gate: tsc clean · 684/684 · build clean · audit 0.

## Deploy steps

Push to `main`. Code-only (rate_events shipped with R2.1; no schema here).

## Verify checklist

- [ ] Monday: List-Unsubscribe raw-header check (item d above).
- [ ] Monday's ops digest "last digest" note describes a REAL send, never a dry run.
- [ ] Spot-check one event page's `<link rel="canonical">` → `https://www.…`.

## Rollback

`git revert`. Nothing here is data-destructive; the merge fix only ever ADDS
saved_events rows.

## SPRINT R2: COMPLETE

R2.1 rate limits · R2.2 red digest · R2.3 cockpit honesty · R2.4 escape ·
R2.5 ICS correctness · R2.6 drift guard · R2.7 housekeeping. With R0 and R1
(also today), all of Roadmap v5's repair work is live. Next: F1 ripening
(mid-August) or F2 proposals — nothing urgent, nothing blocked.
