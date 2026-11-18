# Deploy — the privacy page now says what Vercel collects

**Date:** 18 November 2026
**Code:** `app/privacy/page.tsx`, `lib/growth.ts`, tests in `lib/__tests__/legal-pages.test.ts` and
`lib/__tests__/subscribe-queries.test.ts`, a corrected comment in `components/EventsExplorer.tsx`
**Docs:** `docs/SEARCH.md`, `docs/ANALYTICS.md`, an addendum to `docs/ROADMAP-MONETIZATION.md`
**Schema:** none. **Data:** none.

## What shipped, and why

This came out of the 16 Nov monetization re-measurement. The roadmap's rule is "honest metrics before
honest money", so before anyone quotes an audience figure we checked what the site actually collects.
The privacy page left out a whole flow.

**The gap.** `app/privacy/page.tsx` described Vercel as "hosting. Serves every page, and keeps standard
server logs." But three things send reader data to Vercel:

| Collector | Where | What it sends |
|---|---|---|
| `<Analytics />` | `app/layout.tsx` | a page view from every route: page address, referrer, city-level location, device and browser |
| `<SpeedInsights />` | `app/layout.tsx` | load-speed measurements, with the route |
| `track()` | `lib/track.ts`, called from 8 components | 14 named events, including **`track("search", { q })`**: the text a reader types into the search box |

The search text also lands in the page address as `?q=` (`lib/explorer-url.ts`), so it travels with the
page view as well.

**Why it survived.** Three things were wrong, and each made the others look fine:

- `docs/SEARCH.md` said the search call was "a no-op until roadmap 1.4 wires analytics". So did the
  comment above the call. Both were false: `lib/track.ts` forwards to `@vercel/analytics` and the
  component is mounted in the root layout. Anyone checking would have read that line and stopped.
- The test for third parties only checks that the word "Vercel" appears on the page. It was green while
  Vercel was disclosed for the wrong activity.
- The page's own header says a policy that omits data we hold is worse than none.

## The design decisions

**Disclose, don't remove.** Dropping `q` from the search event is a one-line alternative, and it is
still open to you. The search terms are the only record of what readers look for and don't find, so
this keeps them and says so. Your call either way.

**The wording comes from Vercel's own documentation**, read 18 Nov 2026
(`vercel.com/docs/analytics/privacy-policy` and `/docs/speed-insights/privacy-policy`): no cookie; a
visitor is told apart by a hash of the incoming request, discarded after 24 hours; the per-page-view
fields listed above. One sentence was softened before shipping. The draft said "We use this to see what
people look for". Nobody has ever opened those events, so it now says "It's there so we can see…".

**The test is pinned from the code side, not the page side.** Grepping the page for its own sentence is
the weakness this file already confessed twice. So the new tests switch on what the code does:

- if `<Analytics` is in the source, the page must carry the Vercel section;
- if `<SpeedInsights` is, it must mention load speed;
- if `track("search"` is, it must name the search box;
- **every `track("…")` name in the source must be on a known list.** A new event fails the suite
  until someone reads the Vercel paragraph and adds the name. The next collector costs one deliberate
  look instead of slipping in under a green suite.

**The page also gained one first-party fact it was missing.** `referrer_stats` counts which website sent
an event-page visit (just the hostname), as a daily total. It now says so.

## The second commit: the subscriber counters disagreed

`/admin/growth` said **54** subscribers; the Monday ops email said **53**. `getSubscriberRows` in
`lib/growth.ts` had no status filter, so it counted one keep-list row that never confirmed and never
asked for the email. The ops email filters `status = 'subscribed'`.

**The fix is not that filter.** `churnRate` counts rows whose `unsubscribed_at` is set. Every one of
those has left `'subscribed'`, so the obvious clause would drop them all and churn would read 0%
forever. A worse number than the one being fixed. The shipped clause is
`where not (status = 'pending' and unsubscribed_at is null)`. It drops only never-confirmed rows. It
keeps the re-confirm flow's parked leavers (`pending` with `unsubscribed_at` set, see `lib/subscribe.ts`).

Read live after the change: **53 active, churn 1.9%**. That matches the ops email, and churn is still
non-zero.

## Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` | **3,428 passed in 156 files** (4 new) |
| `npm run build` | clean |
| `npm audit` | **0 vulnerabilities** |
| `/privacy` on a production build | new section renders, date reads 18 November 2026, the Vercel bullet updated, no console errors except the Vercel scripts, which only exist on Vercel's hosting |

**Mutations. Each was applied, run, and reverted:**

| Mutation | Result |
|---|---|
| privacy page: "the words you type into the search box" reworded | 1 test fails |
| privacy page: the Vercel heading removed | 1 test fails |
| `ShareButton`: `track("share_click")` renamed to a new event | 1 test fails, naming the event |
| `getSubscriberRows`: the naive `where status = 'subscribed'` | 2 tests fail |
| `getSubscriberRows`: the clause removed | 1 test fails |

## Deploy

Already pushed to `main`; Vercel auto-deploys. Nothing to configure.

## Verify in production

1. Open `https://www.citypulsemn.com/privacy` and check that the date reads **18 November 2026**. If it
   doesn't, the service worker may be serving the old build: hard-refresh.
2. Under "What we collect", find **"Page views and searches, counted by Vercel"**.
3. `/admin/growth` should now show **53**, the same as Monday's ops email.

## Rollback

`git revert` the two commits. No schema, no data, no secrets involved.

## Left open (owner decisions, not code)

- **Keep sending search terms, or stop?** Removing `q` is one line in `components/EventsExplorer.tsx`;
  the page and the known-events test would then need the search sentence edited.
- **Open the Vercel Analytics dashboard** before any audience figure goes into a grant application or a
  sponsor conversation. Check the plan's retention window and event cap. Vercel's own docs say
  "Custom Events are available on Enterprise and Pro plans" (`/docs/analytics/custom-events`, read
  18 Nov 2026). If the project is still on Hobby, the browser sends `search` and the other 13 events
  but they may never be stored or shown. The page discloses the sending, which is the side to err on.
- The six places that record the refuted "no CORS, so no widget" reasoning are unchanged. Separate
  prose fix, see the roadmap addendum.
