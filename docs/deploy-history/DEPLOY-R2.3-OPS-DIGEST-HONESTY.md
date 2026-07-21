# Deploy R2.3 — ops digest: colliding error keys + zero-poisoning

*July 20, 2026 (late evening). Roadmap v5 sprint R2, item 3. Two small honesty
bugs in the one instrument whose whole job is honesty.*

## The bugs

1. **Colliding error keys.** Three auxiliary reads shared error keys with real
   sections: last week's engagement baseline filed failures under `engagement`,
   the last-digest note under `subscribers`, the previous sitemap count under
   `index`. A failed read of LAST week's numbers rendered THIS week's perfectly
   good section "unavailable" — the cockpit discarding live instruments over a
   dead memo.
2. **Zero-poisoning.** The digest called `getEngagement`, whose never-break
   swallow returns all-zeros on failure (right for /admin/stats, a page should
   degrade). The cockpit would report "views 0 (-100% WoW)" as fact — and then
   write those zeros as next week's baseline, so the week after reads "+∞ new"
   against a lie.

## The fix

- **[scripts/send-ops-digest.ts](../../scripts/send-ops-digest.ts):** aux reads
  now carry their own keys (`engagement_prev`, `digest_note`, `index_prev`);
  engagement goes through the same `wrap()` as every section via a new
  **`getEngagementStrict`** ([lib/stats.ts](../../lib/stats.ts)) that throws
  instead of zeroing; and a failed engagement run **skips the baseline write**
  — the last good baseline stands.
- **[lib/ops-digest.ts](../../lib/ops-digest.ts):** aux failures degrade
  honestly and quietly — WoW renders "first report" with a non-alert
  parenthetical ("last baseline unreadable"), the digest-note line degrades to
  "(last digest note unavailable)". Real engagement failure renders
  "section unavailable" + alert, and zeros are never printed as fact.

`getEngagement` (the swallowing version) is unchanged for /admin/stats.

## Verification (observed, not intended)

- `npm run ops-digest -- --dry-run` against prod data: all seven sections
  report, real WoW percentages (views +53%, clicks +47%), no degrade notes —
  the healthy path is byte-for-byte what it was.
- Tests +7 (664/664), golden on `buildSections`: each aux failure leaves its
  section reporting with "first report"/omitted line and **no alert** · real
  engagement failure = unavailable + alert with no "views 0" anywhere · script
  tripwires (strict read inside wrap, distinct aux keys, baseline write guarded
  behind `!errors.engagement`).
- Gate: tsc clean · 664/664 · build clean · audit 0.

## Deploy steps

Push to `main`. Code-only; the ops-digest workflow runs it as-is.

## Verify checklist

- [ ] Next Monday's ops digest arrives with real WoW numbers (baseline exists
      now, so no "first report" except the sitemap line's first WoW next week).

## Rollback

`git revert`.

## Observation for Taren (not part of this item)

The dry run showed **calendar adds 1104 vs views 104** over 7 days — that ratio
smells like bots hitting calendar links rather than humans. R2.1's beacon cap
now bounds the beacon path going forward, but if the calendar number stays
inflated next week it's worth a look at where the `calendar` action is counted.
