# Deploy R0.6 — JSON-LD `</script>` breakout closed (stored XSS)

*July 20, 2026 (evening). Roadmap v5 sprint R0, item 6 — the sprint closer.*

## The bug

Five pages rendered structured data with `dangerouslySetInnerHTML={{ __html:
JSON.stringify(...) }}`. `JSON.stringify` escapes quotes but not `<` — a title, venue, or
description containing `</script><img onerror=…>` terminates the script block and executes
in every visitor's browser. Event content is NOT trusted input: the weekly pipeline
auto-publishes scraped agent output and approved submissions become events; neither path
strips markup. The other two HTML sinks in the codebase (`lib/digest.ts`, `MapView`)
already escape `<` — JSON-LD was the one that forgot.

## What shipped

- `jsonLdSafe(obj)` in `lib/seo/event-jsonld.ts` — `JSON.stringify` with every `<`
  emitted as the `<` unicode escape: byte-identical to parsers and to Google,
  inert to the HTML tokenizer. Standard Next.js practice.
- All five surfaces converted: event page, day page, collection page, /this-weekend,
  venue page.
- Tests (3): a hostile title/venue/description round-trips with zero literal `<` ·
  output still `JSON.parse`s to the identical object · **repo-wide tripwire** — the test
  walks `app/**/*.tsx` and fails if ANY file ever renders `__html: JSON.stringify` again.

## Verification

Local `next start` smoke: /this-weekend's ld+json block extracted from served HTML,
parses as JSON, contains zero raw `<` characters.

## Quality gate

tsc clean · 608/608 (3 new) · build clean · audit 0.

## Deploy steps

Push to `main`. Code-only.

## Verify checklist (post-deploy)

- [ ] View-source on a live event page: ld+json present, no raw `<` inside the block.
- [ ] Google Rich Results test on one event URL still passes.

## Rollback

`git revert`. **Sprint R0 is complete** — next up per v5: R1.1 `lib/clock.ts` and the
one-clock conversion sprint.
