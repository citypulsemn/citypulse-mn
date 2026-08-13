# Deploy — G1.1 the /this-week landing (subscriber-conversion flagship)

*August 2026. First slice of Monetization roadmap G1.1
([ROADMAP-MONETIZATION.md](../ROADMAP-MONETIZATION.md)). The retro's binding
finding: the blocker is audience, and 5 subscribers against ~1k monthly views is
a conversion problem. This is the highest-leverage fix for it.*

## What shipped

A public, indexable, shareable page at **`/this-week`** that renders **this
week's hand-picked shortlist — the exact set the Thursday email leads with** —
and ends in one subscribe ask. It's the newsletter's shop window: show people the
value, then ask. Growth surface first, SEO second.

- **[app/this-week/page.tsx](../../app/this-week/page.tsx)** — reuses the already
  pure/tested email selection (`digestEvents`, `digestWeekLabel`) and the list
  grouping (`groupEventsByDay`); day-grouped `EventDayCard`s; a framing intro
  ("the shortlist we send by email every Thursday"); one sharpened `SubscribeBand`
  after the list (source `this-week` → placement conversion shows in the ops
  digest); ItemList JSON-LD; honest-empty branch.
- **[app/this-week/opengraph-image.tsx](../../app/this-week/opengraph-image.tsx)**
  — branded OG card (navy/gold, "This Week", the week label), so every share
  looks like an ad rather than a bare URL. Mirrors the `/this-weekend` card.
- **[app/sitemap.ts](../../app/sitemap.ts)** — `/this-week` added at priority 0.9
  (matching `/this-weekend`); it's built to rank for "things to do this week in
  the Twin Cities".

## Design decisions

- **Reuse the email's selection, don't reinvent it.** The page IS the email's
  content, so it uses `digestEvents` verbatim. A visitor who subscribes sees on
  Thursday exactly what the page promised — honest, and zero selection drift.
- **Day-grouped, not a flat list.** `EventDayCard` shows the time, not the
  weekday; a week-spanning shortlist needs day headings for context (same pattern
  as `/this-weekend`).
- **One band, after the list.** Hook (intro) → proof (the shortlist) → ask (the
  band). Respects the no-dark-patterns rule: one band per page, no popup. Copy is
  concrete and honest about cadence: "Get this shortlist every Thursday. One
  email a week — the week's best, hand-picked. Free, no spam." (The digest really
  does send Thursdays — `.github/workflows/weekly-digest.yml`.)
- **Not in the TopBar nav.** It's a landing/share/SEO surface, and a `This Week`
  item next to `This Weekend` would confuse. Discovery is via the sitemap, shares,
  and (next slice) the digest footer + save nudge.
- **Evergreen URL.** Like `/this-weekend`, the URL never carries a date; only the
  content rolls with the clock. `revalidate = 1800` (30 min; the shared events
  cache is the real freshness floor).

## Verification (observed)

Gate: `tsc` clean · **948** tests (+9 tripwires) · `npm run build` clean
(`/this-week` prerenders static, OG image builds) · `npm audit` 0.

Live dev-server render of `/this-week` (HTTP 200):
- H1 "This Week's Best"; count line "7 hand-picked for August 13 – 19".
- 7 real events grouped across 6 day-headings (Top the Tater Days, Arboretum Art
  & Craft Festival, Eagan Lakefest, Mill City & Bloomington farmers markets, …),
  each with time/multi-day badge, venue, price, category.
- Framing intro present; ItemList JSON-LD present.
- **Exactly one** rendered subscribe band (checked via its unique
  `aria-labelledby`, not the CSS class Next inlines), positioned **after** the
  full list.

(No screenshot: the headless preview pane doesn't composite frames locally —
verified via the DOM/a11y tree and rendered HTML instead, per the standing
local-verify note.)

## Deploy steps

Push to `main`. Code-only, no schema, no env. Vercel auto-deploys; the page is
statically generated and revalidates every 30 min.

## Verify checklist (after deploy)

- [ ] `citypulsemn.com/this-week` renders this week's shortlist with the OG card
      (paste the URL into a Slack/iMessage to see the card).
- [ ] The subscribe band submits and the new row shows `source = 'this-week'`
      (so the ops digest can report conversion by placement).
- [ ] `/sitemap.xml` includes `/this-week`; submit/spot-check in Search Console.

## Rollback

`git revert`. Self-contained new route + one sitemap line; nothing else depends
on it.

## Next G1.1 slices (not in this deploy)

- Sharpen the **default** SubscribeBand copy site-wide (home, event, venue pages)
  the way this page's is.
- A subscribe line in the **FirstSaveNudge** (a saver is the warmest lead) and in
  the **digest footer** (forward-to-a-friend → /this-week).
- Link `/this-week` from the homepage subscribe context so on-site traffic finds
  it (kept out of the crowded TopBar deliberately).
