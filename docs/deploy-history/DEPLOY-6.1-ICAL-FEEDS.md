# Deploy 6.1 — iCal feeds

*July 20, 2026. Roadmap v4 item 6.1, taken ahead of Phase 4 as the roadmap allows
(post-Phase-3, cheap, on-brand) — built the same day the data got clean enough to syndicate.*

## What shipped

Every slice of the calendar as a subscribable iCal feed at `/feeds/<slug>`:
`this-weekend` · 7 categories (`unique` publicly, `weird` internally) · 7 collections ·
every registry venue (`venue-first-avenue`) · all 16 neighborhoods. Full reference:
`docs/FEEDS.md`.

## Design decisions

- **One slug namespace**, resolution order: this-weekend → category → collection →
  `venue-` prefix → neighborhood. A drift-guard test asserts every registry slug resolves
  and the namespace has no collisions, so a future colliding registry entry fails CI.
- **Rolling 30-day window with true-span intersection** (rule 5) — an ongoing exhibition
  belongs in the feed mid-run. Collection feeds apply the collection's filters with the
  *feed's* window: subscriptions look ahead; page snapshots keep their own windows.
- **Additive `lib/ics.ts` refactor**: `eventVEventLines()` extracted so the single-event
  download (`eventToICS`, byte-identical, existing goldens as the guard) and the new
  multi-event `feedICS()` share one VEVENT emitter. All-day `VALUE=DATE` handling rides
  along untouched.
- **`revalidate = 3600`**, on-demand, never build-time (rule 2). Calendar apps poll every
  few hours; the data changes mostly weekly.
- **Affordance, not promotion**: one quiet "📅 Subscribe to this calendar" line per
  matching page (this-weekend, venue, collection, neighborhood). No popups (brand stance).
- node-ical round-trip (the 4.6-era verification) was **not** re-added — it isn't in the
  dependency tree anymore. Envelope validity is covered by structural tests (single
  VCALENDAR, paired VEVENTs, CALNAME escaping, 75-char folding, CRLF) plus the shared
  emitter's existing goldens; the post-deploy checklist covers a real calendar app.

## Quality gate

589/589 tests (17 new) · tsc clean · build clean (`ƒ /feeds/[slug]` in the route table) ·
audit 0 · **live smoke against real data**: `music` (200, valid envelope), `unique` (13
events), `venue-first-avenue` (2), `this-weekend` (89), `free-this-week` (110), `como`
(7), unknown slug → 404; affordance rendered on all four page types.

## Deploy steps

Push to `main`. Code-only; no schema, no env.

## Verify checklist (post-deploy)

- [ ] `https://www.citypulsemn.com/feeds/music` returns `text/calendar` with events.
- [ ] Subscribe one feed in a real calendar app (Apple: File → New Calendar Subscription;
      Google: Other calendars → From URL) — events appear under the branded name, the
      State Fair renders as an all-day banner spanning its run.
- [ ] `/this-weekend` shows the subscribe line on phone.

## Rollback

`git revert` — feeds are additive; no other surface depends on them.
