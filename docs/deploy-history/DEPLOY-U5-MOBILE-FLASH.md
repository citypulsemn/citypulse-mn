# Deploy — U5: kill the mobile calendar→list flash (list is the universal default)

*Roadmap UX2 U5 (Taren's list #1, mobile). Aug 14, 2026. Size S.*

## What shipped

The homepage no longer flashes on phones. Previously the server rendered the month
**calendar** (the initial state), then a mount effect swapped phones to the **list**
— a visible flash + layout shift on every fresh phone load. Now **list / "this week"
is the universal default**, so the server-rendered first paint already matches every
device: no swap, no flash. The calendar is a one-tap opt-in (and saved if chosen).

## Why this shape (and not device-detection)

The obvious fix — render the calendar on desktop and the list on mobile from the
server — would require reading the User-Agent server-side, which opts the homepage
out of static generation and makes it dynamic. The homepage is **ISR-cached**
(`revalidate = 1800`) and that caching matters (egress), so server-side viewport
detection is off the table. With one device-agnostic SSR paint, the only flash-free
option is a **single shared default**. List reads well on both mobile and desktop
(the month calendar hides event titles below 820px anyway), so list/week is the
right universal default; calendar/month is one tap away.

## The trade-off (worth Taren's eye)

**Desktop's default changed** from the month calendar to the this-week list.
Rationale: it's consistent with mobile, it's a better "what's on" default, and
calendar is one tap away and remembered. If you'd rather desktop still open on the
calendar, the alternative is to accept the mobile flash or move the homepage off ISR
— neither is worth it. Easy to revisit.

## Design decisions

- **One source of truth:** `DEFAULT_VIEW = "list"` / `DEFAULT_RANGE = "week"`
  consts drive all three definition sites (initial `useState`, the `applyParsed`
  URL fallback, and `urlDefaults` for clean-URL omission), so they can't drift.
- **Precedence unchanged:** a URL with params still wins, then a saved
  `cp_default_view`, then the list/week default. Only the *default* changed; the
  saved-preference and shared-link paths are untouched. (A returning user who saved
  "calendar" still gets it — that path is inherently client-side via localStorage.)
- **Clean URL preserved:** at the default (list/week, current month) the query
  string is empty, because `serializeExplorer` omits keys matching `urlDefaults`
  (now list/week).
- The `window.innerWidth < 820` swap is deleted — no viewport branching remains.

## Files

- `components/EventsExplorer.tsx` — `DEFAULT_VIEW`/`DEFAULT_RANGE` consts; initial
  state, `applyParsed`, and `urlDefaults` use them; the mobile switch removed.
- `lib/__tests__/list-view.test.ts` — the UX4 test that pinned the
  `innerWidth < 820` swap now asserts the universal list/week default and that no
  viewport swap remains.

## Verification (observed)

- `npx tsc --noEmit` clean · `npm run build` clean · `npm audit` 0.
- `npm test` — **1036 passed** (list-view + explorer-url green against the new default).
- **Live smoke:**
  - Mobile viewport (375×812), fresh load: view toggle shows **List active**, no
    calendar grid rendered, preset **This Week** — i.e. the list is the first paint,
    no calendar→list swap.
  - Desktop viewport, fresh load: also **List** default, URL clean (`/`, no params —
    confirming list/week is the omitted default).

## Deploy / rollback

Merge to `main` — Vercel auto-deploys. No schema/env change. Rollback: revert this
commit (restores calendar/month default + the mobile swap).

## Note — the mobile calendar itself (U5 part 2, deferred)

The month calendar still shows dots-only (no titles) below 820px. That was most
harmful when it was the *default*; now that it's an opt-in, it's acceptable (tap a
day → its event list). A mobile agenda-style calendar is a possible future
enhancement, not shipped here to keep U5 tight.
