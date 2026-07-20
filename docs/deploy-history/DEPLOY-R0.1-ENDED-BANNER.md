# Deploy R0.1 — Event pages: "already happened" banner fixed (Chicago frame + true spans)

*July 20, 2026 (evening). First item of Roadmap v5 (Repair & Ripen). Also adopts v5 into
the repo (`docs/ROADMAP-v5.md`) and carries the Part-3.6 docs tidy.*

## The bug, verified before fixing

`isEnded` in `lib/event-view.ts` parsed naive Chicago wall strings with `new Date()` — on
Vercel's UTC servers, 6 PM Chicago reads as 6 PM UTC, five/six hours early — and never
consulted `multiDayEnd`. **Confirmed live at ~2:45 PM CT:** the Minnehaha Falls Art Fair
page (`/event/d8b5d142-…`, fair running until 6 PM) and Music in the Trees
(`/event/71b562b4-…`, 2–4 PM show) both displayed "This event has already happened."
mid-event, on the exact pages shares point to.

## What shipped

- `isEnded` now compares **wall clock to wall clock**: "now" is converted into a Chicago
  wall string (`chiWallClock`, the Intl pattern proven in `lib/trending.ts`) and compared
  against the event's **true span end** — latest of `multiDayEnd`/`end`/`start` (rule 5).
  All-day events end at end of their (Chicago) day, not their midnight start.
- `chiWallClock` is exported and interim — R1.1 (`lib/clock.ts`) absorbs it; the shape
  stays identical when it moves.
- Old tests encoded the buggy frame; replaced with 6 golden cases: the live bug as a
  regression (6 PM CT boundary), mid-run collapsed event, final-day-until-midnight,
  all-day own-day, genuinely past, and a CST (winter, −6) variant.
- Docs tidy per v5 Part 3.6: `docs/ROADMAP-v5.md` added as the canonical plan;
  `HANDOFF.md` points at it (and records the rule-9 spot check closing with evidence —
  zero `edit` actions in `admin_audit`, so no corrupted hand-edited times exist);
  `ops/README.md` no longer calls COLLAPSE-1.1 "pending."

## Quality gate

tsc clean · 592/592 tests (16 in event-view, all new isEnded cases) · build clean ·
audit 0 · fix probed against the three real records (both live victims now "not ended";
the long-`end_at` case that was already correct stays correct).

## Deploy steps

Push to `main`. Code-only. Event pages revalidate every 300 s, so the live banners clear
within ~5 minutes of deploy.

## Verify checklist

- [ ] `/event/d8b5d142-…` (Minnehaha, until 6 PM today) — no banner before 6 PM, banner
      after midnight.
- [ ] Any evening event's page fetched in the afternoon — no banner.
- [ ] A genuinely past event still shows the banner.

## Rollback

`git revert` — single pure function + tests + docs.

## Up next in v5

**R0.2 (`archivePastEvents` ignores `multi_day_end`) is the document's most-urgent item —
must land before the Jul 27 pipeline run** or Ramsey County Fair gets archived two days
early. Same one-line `coalesce` shape the codebase already uses in `trending.ts`.
