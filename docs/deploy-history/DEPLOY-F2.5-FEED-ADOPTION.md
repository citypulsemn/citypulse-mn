# Deploy F2.5 — feed adoption affordances

*July 21, 2026. Roadmap v5 F2.5. 6.1 shipped the iCal feeds; nothing measured or
marketed them. This adds the copy-link button, the click counter, and the ops
digest line — so the data can eventually answer whether the public API (6.2)
ever earns building.*

## What shipped

**1 — The button.** [FeedSubscribe](../../components/FeedSubscribe.tsx) is now a
client component that keeps the "📅 Subscribe to this calendar" link AND adds a
**Copy link** button. Copy is the right UX for a *live* feed — you paste the
absolute URL into Apple/Google/Outlook's "add by URL" and events keep arriving;
a one-time download wouldn't update. Both the copy and the direct link fire a
`source`-tagged adoption beacon. Mounted on all four feed surfaces, each tagged:
venues (`venue`), collections (`collection`), neighborhoods (`neighborhood`),
this-weekend (`weekend`).

**2 — The counter.** New table **`feed_events`** (slug, source, day, count) —
additive, idempotent, RLS on, **already applied to prod**. Aggregate-only, same
privacy story as `event_stats`: "how many clicked Subscribe on the venue pages
this week", never "who". [lib/feed-stats.ts](../../lib/feed-stats.ts) holds the
pure `parseFeedBeacon` (integrity check: only ADVERTISED slugs + known sources
count — the beacon's equivalent of `event_stats`' foreign key) and
`summarizeFeedAdoption`, plus `recordFeedClick` (never-break swallow) and
`getFeedAdoption`.

**3 — The beacon.** [/api/beacon](../../app/api/beacon/route.ts) now accepts a
second payload shape `{feed, source}` alongside `{id, action}`, dispatching to
`recordFeedClick`. Parse-before-rate-limit ordering (R2.1) and the uniform 204
are preserved.

**4 — The digest line.** A new **Feeds** section in
[composeOpsDigest](../../lib/ops-digest.ts): total 7-day clicks + top feeds. Zero
clicks reads "feeds are new" and is NOT an alert (honest emptiness, like dark
trending).

## Verification (observed, not intended)

- **True end-to-end on the live dev server:** clicked Copy link on
  /venues/first-avenue → `POST /api/beacon → 204` → a real
  `feed_events` row (`venue-first-avenue`/`venue`/count 1) landed in prod.
  Then **removed that one synthetic row** so the first digest reports only
  genuine clicks (table back to 0 rows).
- **Rolled-back transaction probe:** the upsert counts +1 per (slug,source,day)
  and the grouped read sums across sources correctly; rollback left 0 rows.
- **Ops digest dry-run:** the Feeds section renders with the honest empty state.
- Tests +17 (730/730): parseFeedBeacon integrity (unadvertised slug rejected,
  raw category key rejected, unknown source rejected, event-shape rejected,
  every real slug accepted); summarize (cross-source merge, ranking, empty, cap);
  query tripwires; beacon-route wiring; Feeds section (totals, singular grammar,
  quiet-empty, unavailable-alert); resilience count updated 7→8.
- Schema drift guard green. Gate: tsc clean · 730/730 · build clean · audit 0.

## Deploy steps

1. ~~Apply schema~~ — **done** (`create table if not exists`, idempotent).
2. Push to `main` → Vercel.

## Verify checklist

- [ ] On a venue/collection page, click **Copy link** → the feed URL is on your
      clipboard; paste it into a calendar app's "add by URL" and events appear.
- [ ] After some real traffic: next ops digest's **Feeds** line shows click
      counts and top feeds (this is the 6.2 public-API signal — watch it grow or not).
- [ ] `select slug, source, count from feed_events order by day desc limit 10;`
      shows human-looking numbers.

## Rollback

`git revert` the commit. The `feed_events` table can stay (unused counter tables
are harmless).
