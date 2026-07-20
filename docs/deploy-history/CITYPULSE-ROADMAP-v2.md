# City Pulse MN — Roadmap, refined (post-3.3)

*Written after auditing the live site and the codebase as they stand today.*

---

## Where the project actually is

**The build quality is not the problem.** 8,700 lines across 39 lib modules and 21 components, 207 passing tests, 0 vulnerabilities, 7 tables all with RLS, 17 docs. Phases 1–3 are complete and deployed: event/day pages, SEO + JSON-LD, search, analytics, admin + moderation, RLS, Instagram card generator, email capture, add-to-calendar, price/area filters, collections, weekly digest, community submissions, and saved events.

**The live site is real.** July is dense with genuine events — Twins and Lynx home games, the Aquatennial, Loring Park Art Festival, Twin Cities Carifest, five county fairs, brewery nights, museum exhibitions. This is a working product, not a demo.

### The one finding that should reorder everything

I pulled the live collections page. The counts:

| Collection | Live count |
|---|---|
| Festivals & Markets | **69** |
| Arts & Culture | 20 |
| Free This Week | 13 |
| Only in Minnesota | 11 |
| This Weekend | 3 |
| Date Night | 2 |
| **Live Music** | **0** |
| **Family Fun** | **0** |

**Live Music is empty. In Minneapolis. In July.** So is Family Fun. Meanwhile Festivals holds 69.

That is not a code bug — every one of those pages renders correctly. It's a **content-supply and taxonomy problem**, and it is the most important thing on the site. A Twin Cities events site where "Live Music" is blank in July has a credibility hole that no Phase 4 feature can paper over. First Avenue, the Armory, Palace, Icehouse, Turf Club, Xcel, and every patio in the metro are running shows this week.

Likely causes, in order of probability:
1. **The music agent under-returns in the near window.** Each category gets one agent with a small web_search budget (8 uses in the near band). Music is the highest-volume, most-fragmented category in any city — dozens of venues, each with its own calendar. One agent with eight searches cannot cover it, while "festivals" is easy (a handful of big, well-indexed events, each spanning multiple days and thus multiple rows).
2. **Category drift.** The homepage shows "Groovin' in the Garden – Salsa del Soul," "Medalist Concert Band," "Beer Choir," "Oratorio Society of Minnesota," "Day Block Brewing Live Music Event." Those are *music*. If they were found by the festival/food agent, they got stamped festival/food — because **an event's category is decided by which agent found it**, not by what it is. That's an architectural flaw: it makes category a function of discovery path rather than of the event.
3. **Window mismatch.** Live Music and Family Fun are the only two collections with a 7-day window and a single category. The full ones use 30-day windows. So the two empty collections are also the two most exposed to thin near-term supply.

Everything below is reordered around fixing that first.

---

## Phase 4 — Coverage & trust (NEW — do this next)

*The site's promise is "everything worth doing in the Twin Cities." Right now it can't keep that promise for the single most-searched category. Nothing else matters more.*

### 4.1 — Decouple category from discovery path ⚠️ **highest priority**
Stop letting the finding agent stamp the category. Add a **classification step**: after events are gathered (from any agent), run a cheap classifier pass that assigns the category from the event's own title, venue, and description. A brewery live-music night is `music`, whether the food agent or the music agent found it.

This alone likely populates Live Music and rebalances the bloated Festivals bucket. Ship it with a golden-set test: a fixture of ~40 real event titles from your own database with hand-labeled categories, asserting the classifier agrees. That test becomes the taxonomy's regression net.

### 4.2 — Venue-anchored music discovery
Music is too fragmented for one generic agent. Add a **venue registry** (`lib/venues.ts`): First Avenue/7th St Entry, Palace, Fillmore, Armory, Icehouse, Turf Club, Cedar Cultural Center, Dakota, Fine Line, Xcel, Target Center, Uptown Theater, Berlin, Hook & Ladder, Green Room, Amsterdam, plus the amphitheaters. Give the music agent the registry and a bigger search budget so it sweeps venue calendars rather than searching blindly.

Same pattern applies later to family (museums, zoos, libraries, parks) — the two empty collections.

### 4.3 — Coverage monitor (make thinness impossible to miss)
An admin panel (and a line in the pipeline run log) showing **events per category per week for the next 30 days**, with a red flag when any category falls below a floor. You should never again learn from a visitor that Live Music is empty. This is the cheap insurance that keeps 4.1/4.2 from silently regressing.

### 4.4 — Multi-day event handling
Festivals showing 69 is partly real and partly an artifact: multi-day events (county fairs, Aquatennial, Carifest, restaurant week) appear to be generating a row per day. Introduce a proper **run of dates** (a parent event with a date range, or explicit `is_multi_day` grouping) so a 9-day fair is one card that says "Jul 20–28," not nine cards crowding out everything else.

### 4.5 — Freshness & cancellation truth
Events are found weekly. Shows get cancelled, sell out, and move. Add a lightweight **re-verification pass** for near-term events (next 7 days) that re-checks the source URL and flags changes into the existing cancellation flow. Trust is the product.

---

## Phase 5 — Make it stickier (mostly your old Phase 3/5, re-scoped)

### 5.1 — First-party analytics (`event_stats`) *(was 5.4)*
Server-side counts for views, ticket clicks, saves, and calendar adds, queryable in the admin. Right now engagement lives only in the Vercel dashboard, which you can't join against your own data. This unlocks trending, "most saved this week," and tells you which categories people actually want — feeding 4.1's priorities with evidence instead of hunches.

### 5.2 — Trending / "What people are into" module
Once 5.1 exists: a homepage strip driven by real saves and clicks. Genuine editorial value, and it's the kind of thing that gets shared.

### 5.3 — Personalized digest
You now have saved events (3.3) and the weekly email (3.1). Join them: "Your saved events this week" at the top of the digest, then the curated picks. High-value, low-effort — the pieces already exist.

### 5.4 — Saved-events durability (honest gap from 3.3)
Saves live in a browser cookie, so they vanish on a new device or a cleared cache. Offer an optional **"email me a link to keep my list"** — no passwords, just a magic-link token that rebinds the cookie. Keeps the no-login philosophy while removing its sharpest edge.

### 5.5 — Neighborhood depth
Areas are currently 7 broad buckets. Twin Cities people think in neighborhoods (Northeast, Uptown, North Loop, Lowertown, Dinkytown, Grand Ave). Adding neighborhood tags for Minneapolis/St. Paul makes filtering feel local rather than regional.

---

## Phase 6 — Growth (SEO + distribution)

### 6.1 — Venue pages
`/venue/first-avenue` — every event at a venue, with an address, a map, and JSON-LD. This is a large, cheap SEO surface: people search "first avenue schedule," not "events aggregator." It falls straight out of the venue registry in 4.2.

### 6.2 — Neighborhood / city landing pages
`/events/northeast-minneapolis`, `/events/st-paul`. Same play, different axis. Both 6.1 and 6.2 turn your existing data into dozens of indexable, genuinely useful pages.

### 6.3 — "This weekend" evergreen page
A single permanent URL that always shows the coming weekend — the highest-intent search in local events, and the natural landing page for your Instagram bio link.

### 6.4 — Instagram automation tightening
The card generator (2.1) exists but the weekly Reels workflow is still manual. Close the loop: generate the week's cards and captions in one click from the admin, aligned to the locked content rules.

---

## Phase 7 — Revenue (unchanged philosophy: **curation is never for sale**)

Only worth starting once Phase 4 makes the coverage honest and Phase 6 brings traffic. In rough order of how well they preserve trust:

1. **Featured placement, clearly labeled** — a venue can pay to highlight an event that *already qualifies*. Never buys inclusion, never reorders organic results, always visually marked.
2. **Venue subscriptions** — a venue dashboard to manage their own listings (an upgrade of the 3.2 submission flow), with analytics on views/clicks/saves. Sells convenience and insight, not editorial.
3. **Sponsored collection** — "Free This Week, presented by X." The collection contents stay editorial.
4. **Newsletter sponsorship** — one clean slot in the digest, once the list is meaningful.
5. **Affiliate ticketing** — the least intrusive, but only worth it at real volume.

Deliberately excluded: pay-to-be-listed, pay-to-rank, and anything that makes the calendar a function of who paid.

---

## Phase 8 — Platform & scale

- Public API + iCal feeds (subscribe to "Live Music in Minneapolis" in your own calendar).
- Multi-city (the architecture is city-agnostic; areas and venues are the only city-bound layers — the real question is whether the research pipeline generalizes, and that's a *content* question, not a code one).
- Full-text/semantic search and recommendations.

---

## What I'd change about the roadmap itself

Three structural notes, said plainly:

**1. The roadmap has been feature-led when the product is content-led.** Every phase so far added capability, and the capability is excellent. But an events site lives or dies on whether the events are complete, correctly categorized, and true. Live Music being empty in July is a content failure that thirteen features couldn't prevent — and shipping a fourteenth won't fix it. Phase 4 as I've rewritten it is the correction.

**2. There is no feedback loop from reality.** You built analytics (1.4) but the data lands in a dashboard you don't query. You built a pipeline but nothing checks whether its output is any good. 4.3 (coverage monitor) and 5.1 (first-party stats) are the instruments that turn this from "build features and hope" into "see what's broken, fix it." I'd argue these are more valuable than any new user-facing feature.

**3. Revenue should stay parked.** Monetizing traffic you don't have yet, on a calendar with a visible hole in it, would trade the thing that makes the site worth visiting for a small amount of money. Phase 4 → 6 → *then* 7.

**If you only do one thing next: 4.1.** Category is currently decided by which agent happened to find the event. Fix that and the taxonomy stops lying — which is what's making two of your eight collections look dead.
