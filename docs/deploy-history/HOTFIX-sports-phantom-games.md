# Hotfix — phantom sports listings (Aug 21, 2026)

## How we found out

A stranger used the report form. Reason, in full: **"this event doesn't exist."**
The listing was *Minnesota Twins vs. Kansas City Royals, Target Field, Fri Sep 4,
7:10 PM*. No email, no role — they just told us and left.

They were right. On Sep 4 the Twins are in Chicago playing the White Sox at Rate
Field. Checked against `statsapi.mlb.com`, the feed that drives the scoreboards.

## What was actually wrong

The report was one listing. The audit found **13 of 20 published upcoming Twins
listings were wrong**:

| Kind | Count | Example |
|---|---|---|
| Phantom — team is away that day | 6 | Sep 4/5/6 "vs. Royals", Sep 18/19/20 "vs. Tigers" |
| Wrong opponent | 2 | Sep 14 & 16 "vs. Baltimore Orioles" — it's the Yankees |
| Wrong first pitch | 5 | Sep 2 listed 12:10, actual 18:40 |

Sep 14 and Sep 16 each had **two published home games at Target Field at once** —
the real Yankees game and a fictional Orioles game, side by side.

**11 people had added these to their calendar.** One clicked through for tickets.

## Root cause

Every bad listing traces to a *news article about the schedule release* —
`minnesotanewsnetwork.com`, `puckettspond.com`, `drgnews.com`, a Yahoo schedule
page. Four pipeline runs (Jun 25, Jun 29, Jul 20, Aug 3) each read a different
article and each produced a different September. They do not agree with each other.

Two failures let it reach the public:

1. **We were reading prose about a schedule instead of the schedule.** MLB, the
   NHL and MLS all publish exact, free JSON. We were paraphrasing sportswriters
   paraphrasing it.
2. **Collapse can't catch it.** The dedupe pass merges near-identical listings.
   These name *different opponents*, so they read as different events and stack
   instead of merging. The sports rule ("never merge games across different days")
   is about not over-merging; nothing guarded the opposite failure.
3. **The verify pass never looked.** Wild: 27 upcoming, **0 ever verified**.
   United, Timberwolves, Gophers, Lynx, Vikings: all zero. Twins was 10 of 20 —
   and every listing the reporter caught sat in the unverified half.

## What we did

Hid **26 listings** (`published` → `draft`, reversible, nothing deleted):

- the 13 wrong Twins listings above
- 13 listings whose titles **named no opponent at all** — including, live on the
  site, `Minnesota United FC vs. [Western Conference Opponent]` and
  `Minnesota Wild vs. Opponent (Home Game)`

Each hide wrote an `admin_audit` row with its reason. The report was closed
`actioned` / `hidden` with a note recording the verification.

**Rollback:** every affected id and its prior status is in the backup JSON noted
in the session log; restoring is `update events set status='published' where
id = any(...)`, or one click per row in Admin → Events.

Because the hide ran as a script rather than through `setStatus`, Vercel's cache
was not busted by `refresh()`. A deploy was pushed immediately after to clear it —
otherwise the hidden games would have sat on cached pages for up to the 1-hour
`EVENTS_TTL_SECONDS` window.

## Hockey, same day

Confirmed against `api-web.nhle.com/v1/club-schedule-season/MIN/20262027` (which
includes preseason — two of the listings were preseason games). **13 of 20
published Wild listings were wrong**, the identical ratio to the Twins:

| Kind | Count | Example |
|---|---|---|
| Phantom — no home game that night | 10 | Oct 7 "vs. Sabres", Oct 9 *and* Oct 10 both "vs. Lightning" |
| Wrong opponent | 3 | Oct 3, Oct 12, Oct 15 — each shown *beside* the correct listing |

Oct 3 was the clearest symptom: the site advertised both the real Bruins home
opener and a fictional Predators home opener, same arena, same 7 PM.

One listing, Nov 4, was titled **"New York Rangers vs. Minnesota Wild"** — an
away game framed as a home one. That framing error deserves its own guard: on a
local events site, the home team belongs on the left.

All 13 hidden the same way (draft + audit row). **39 listings hidden in total
today.** Wild is now 7 upcoming listings, all matching the NHL feed; Twins 7, all
matching MLB.

The match filter was `title ilike '%minnesota wild%'`, deliberately not
`'%wild%'` — the loose pattern also catches the Harriet Alexander **Wild Rice
Festival** and a Minnesota Zoo listing. A bulk status change is exactly where a
clever pattern becomes an incident.

## Still open

One true duplicate remains at Allianz Field on Sep 19: the same LA Galaxy match
listed twice, as "Minnesota United FC vs. Los Angeles Galaxy" and "MNUFC vs. LA
Galaxy". Not a falsehood — a dedupe that collapse missed because the abbreviated
form shares almost no characters with the spelled-out one.

MLS, Gophers, Lynx, Timberwolves, Vikings and Saints remain **0-verified** and
unaudited. There is no reason to believe they are cleaner; they are unchecked.

Hiding the placeholder listings also left **holes on real game dates**: Nov 6
(vs. Sharks) and Nov 7 (vs. Lightning) are genuine home games whose only listing
was an opponent-less placeholder. Removing them was still right — a listing that
can't say who's playing is not usable — but the repair is an import, not a restore.

## The rule this bought

**Never derive a fact from prose when the primary source publishes it.** For any
event class with an official machine-readable schedule — MLB, NHL, NBA, MLS,
NCAA, a venue's own calendar API — that feed is the source, and a news article is
at best a hint that the feed changed. Where no such feed exists, the listing is
unverified by construction and must be treated that way.

Corollary, learned from Sep 14: **two published events in the same venue at the
same time is a contradiction the site can detect on its own.** That check costs
one query and would have caught this in June.
