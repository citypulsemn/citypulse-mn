# Deploy R2.2 — a missing RESEND_API_KEY turns the digest workflow RED

*July 20, 2026 (late evening). Roadmap v5 sprint R2, item 2. Size XS, stakes not:
the failure it fixes is "every subscriber silently unmailed, green checkmarks all
the way down."*

## The bug

[lib/digest-send.ts](../../lib/digest-send.ts) folded a missing `RESEND_API_KEY`
into the dry-run branch: `ok: true`, a `digest_sends` row recorded as a dry run,
exit 0, green workflow — zero emails, for as many weeks as it took someone to
notice a side note in the ops digest. The repo had already learned this lesson
twice (`send-ops-digest.ts` exits 1 on the same condition; the Jul 15 incident
comment in `saved-restore.ts`) — the weekly digest sender just hadn't caught up.

## The fix

A real run (`dryRun: false`) with no key now fails **first and loudly**, before
any composition: `ok: false`, an honest `digest_sends` row (`ok=false`,
`dryRun=false`, note `no RESEND_API_KEY — NOTHING SENT`), and
`scripts/send-digest.ts`'s existing `exit(result.ok ? 0 : 1)` turns the Actions
run red. Dry-run without a key stays green — rehearsing locally is legitimate.

## Verification (observed, not intended)

- `npx tsx scripts/send-digest.ts` with no env loaded → logged
  `no RESEND_API_KEY — NOTHING SENT`, result `ok:false`, **exit code 1**.
- `npm run digest -- --dry-run` with real env → `dry run · 2 personalized:
  3 emails`, `ok:true`, **exit code 0**.
- Tests +5 (657/657): real-run-no-key → ok false / not-a-dry-run / sent 0 ·
  dry-run-no-key stays green · tripwires (key check before composition, the old
  `dryRun || !apiKey` fold is gone, runner exits nonzero on failure).
- Gate: tsc clean · 657/657 · build clean · audit 0.

## Deploy steps

Push to `main`. Code-only, no schema. The digest workflow itself is untouched —
the redness comes from the exit code it already honors.

## Verify checklist

- [ ] Next Monday's digest run: green with real sends (`ok:true`, recipients > 0
      in `digest_sends`). Red would now actually mean something.

## Rollback

`git revert`.
