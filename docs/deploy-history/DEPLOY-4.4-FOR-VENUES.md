# Deploy 4.4 — Submissions flywheel (/for-venues)

*July 20, 2026. Roadmap v4 item 4.4 — the free half of the venue relationship, in writing,
before Phase 5 ever puts money in the conversation.*

## What shipped

- `app/for-venues/page.tsx` — static page: how listings happen (the Monday sweep + Thursday
  verify pass), what qualifies, the submit link, and the rules stated plainly: **free,
  stays free, no pay-to-list, no pay-to-rank, ever**. No backend change — the submissions
  inbox already existed.
- Copy lives in `lib/editorial.ts` (`FOR_VENUES`) per the standing rule — Taren edits freely,
  and this page is a promise, so Taren's wording wins.
- Every venue page carries the footer line "Is this your venue? Get your events listed —
  free →" linking here. Sitemap entry added (monthly, 0.4).

## Quality gate

tsc clean · 589/589 tests (no new pure logic — static page per spec) · build clean
(`○ /for-venues`, fully static) · audit 0 · smoke on a real `next start`: page renders all
four sections + submit link, venue page shows the CTA line, sitemap includes the URL.

## Deploy steps

Push to `main`. Code-only.

## Verify checklist

- [ ] `https://www.citypulsemn.com/for-venues` renders on phone; reads like Taren, not a brochure.
- [ ] Any venue page shows the "Is this your venue?" line.
- [ ] Optional: tweak `FOR_VENUES` strings in `lib/editorial.ts` to taste — one commit, no
      other changes needed.

## Rollback

`git revert` — additive static page plus one link line.
