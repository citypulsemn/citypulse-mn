# Deploy — U4: official (venue) site first, two-link CTA

*Roadmap UX2 U4 (Taren's list #6). Aug 14, 2026. Size S–M.*

## What shipped

Event pages now **lead with the venue's official page** when the ticket link is a
third-party platform, and offer a secondary **"Tickets"** button so people can still
buy. Before this, `ticketUrl` was the *only* link ever shown — so an event whose
ticket link is Ticketmaster / AXS / Eventbrite sent visitors to the aggregator even
when we'd stored the venue's own page in `sourceUrl`.

Example (live-verified): *Dimmu Borgir @ The Fillmore* now shows a gold **"Official
site" → fillmoreminneapolis.com** primary and an outline **"Tickets" → ticketmaster**
secondary. Same for Allianz Field (+ Ticketmaster), Surly (+ AXS), Armory, Target
Center, Grand Casino Arena, Bell Museum (+ Eventbrite).

## The design decision (validated against real data)

The hard part is *knowing* which URL is official. The pipeline stores `sourceUrl` as
"where we found it" — **usually the venue, but often a news/tourism/family-listing
site** (a probe of all 953 events found `aol.com/news/…`, `exploreminnesota.com`,
`familyfuntwincities.com`, `twincitiesfamily.com`, `bloomingtonmn.org`, … as
sources). A naive "not-an-aggregator" denylist was **whack-a-mole** — every fix
revealed another content host, and labeling those "Official site" would be dishonest.

**The signal that actually works: a venue-name match.** Promote `sourceUrl` to
"Official site" only when its host contains a *distinctive* word from the event's own
`venue` name (`fillmoreminneapolis.com` ↔ "The Fillmore Minneapolis";
`allianzfield.com` ↔ "Allianz Field"). Validated on live data: **every genuine venue
source matched, and every content/news/tourism source did not** — so they're left as
the plain ticket link instead of mislabeled. Distinctive = ≥4 chars and not in a
stoplist of venue-type nouns (hall, club, theater…) **and metro geography** (minnesota,
minneapolis, saint, paul, downtown…) — the geo words had to be stoplisted because
`exploreMINNESOTA.com` / `downtownSTPAUL.com` would otherwise "match" any venue
carrying the place name.

**Result on real data: 14 promotions, all clean venues, zero false positives.**

## Behavior

- Ticket link is a third party AND source is the venue's page → **"Official site"**
  (gold) + **"Tickets"** (outline). Two links.
- Ticket link is already on the venue's site, or there's no venue source → single
  **"Tickets & Info"** (unchanged — 934/953 events).
- No ticket link but source is the venue's page → **"Official site"** (beats the old
  "Ticket details coming soon" dead-end).
- Nothing linkable → the "coming soon" note (unchanged).
- **Conservative miss (documented):** a venue whose name is only geography/short words
  (e.g. "Minnesota Zoo") has no distinctive token, so we don't claim its source is
  official — it falls back to the ticket link. Safe (no false claim), just no promotion.

## Honesty / analytics

- Only **ticket** links are affiliate-tagged (M0.1, `outboundTicketUrl`) and count as
  the `ticket_click` metric (5.1) + `sendStat`. An **"Official site"** click is a
  different intent — tracked as `official_click` for vendor analytics only, so it does
  **not** inflate `ticket_click` (M0.2 metric integrity).

## Files

- `lib/event-links.ts` — new: `AGGREGATOR_HOSTS` + `isAggregatorUrl`,
  `hostMatchesVenue`, and `eventLinks(event)` (the official-first chooser).
- `components/TicketButton.tsx` — renders primary + optional secondary via a shared
  `CtaLink` (tags/tracks per link kind); UX1's dead-event gating is unchanged (the
  whole button is still hidden for ended/cancelled events).
- `app/globals.css` — `.ticket-btn-secondary` (outline under the gold primary).
- `lib/__tests__/event-links.test.ts` — 14 golden tests.

## Verification (observed)

- `npx tsc --noEmit` clean · `npm run build` clean · `npm audit` 0.
- `npm test` — **1036 passed** (event-links 14/14).
- **Real-data probe** (all 953 published events): 14 two-link promotions, every
  promoted host a venue (grandcasinoarena, bellmuseum.umn.edu, targetcenter,
  fillmoreminneapolis, allianzfield, surlybrewing, armorymn, varsitytheater); 934
  single ticket CTA; 0 mislabeled content sites.
- **Live smoke** (`/event/…` Dimmu Borgir @ Fillmore): gold "Official site" →
  `fillmoreminneapolis.com`, outline "Tickets" → the Ticketmaster URL, both
  `target="_blank"`.

## Deploy / rollback

Merge to `main` — Vercel auto-deploys. No schema/env change. Rollback: revert this
commit (new lib + component + CSS + tests together).

## Follow-up — the robust version (roadmap UX2 U4 "Option B")

This is the no-migration render-side win. The robust fix is for the **pipeline to
capture a verified official URL** as its own field (the research agent already
distinguishes primary sources) — then the render just reads it, no host heuristics.
Worth doing if we want official-first coverage beyond the venue-name-match set. The
`AGGREGATOR_HOSTS` list and the venue-match helper carry over.
