# Title & field hygiene

Roadmap 4.7. A title carries the event's **name**; the structured fields already hold the venue, schedule, and format. Agents embed all of it in titles because that's how the source page phrased it — this layer cleans it up for display.

## Where cleaning happens (and why)

**At the read path, in `rowToEvent` — not at ingest.** The dedup key canonicalizer strips *trailing* parentheticals before hashing, but mid-title parens and dash-suffixes are hashed as-is: rewriting stored titles would change future event keys and duplicate events on the next re-find. Cleaning on read gives every consumer (cards, day panel, detail, digest, .ics, JSON-LD, OG images, IG captions) clean titles from one choke point, with **zero key risk, zero backfill**, and the raw title kept in the database as provenance. The sample-data fallback runs through the same cleaner, so local dev matches production.

The **admin intentionally shows raw titles** — that's the source of truth for debugging what an agent actually returned.

## What gets stripped (`lib/title-hygiene.ts`, golden-set tested)

| Noise class | Live example | Becomes |
|---|---|---|
| Schedule parens/tails | "Utepils … Raffle (Weekly Tuesdays)", "Marketfest at Manitou Days — Weekly Thursdays (July 16)" | name only |
| Format tags | "Trail of Small Wonders (Exhibition)", "Wicked (Touring)" | name only |
| The event's own venue/city restated | "In the Heights (Artistry / Bloomington Center for the Arts)", "Leprechaun Days (Rosemount)" | name only (≥60% token overlap with the event's venue/city fields) |
| Promo riders | "Twins vs. Angels – Beach Tote Bag Giveaway" | name only |
| Mixed dashes | " - ", " — " | " – " (en dash; hyphenated words untouched) |

## The prime rule: when unsure, KEEP

"(COSA Fest)" is an alias. "(World Premiere)" is information. "– Weekend 1" distinguishes two real weekends. A paren naming a *different* venue than the event's own is kept. If cleaning would gut a title (< 4 chars), the original is returned. Every one of these judgment calls is a named test in `lib/__tests__/title-hygiene.test.ts` — extend the golden set when a new noise pattern shows up on the live site.

`displayCity` canonicalizes Saint/St/St. prefixes to "St. " ("Saint Paul" and "St Paul" rendered on one live page). Area matching is unaffected — `lib/areas.ts` normalizes periods and saint/st on its side.

## Known trade-off

Search runs over cleaned titles, so querying "exhibition" no longer matches a stripped "(Exhibition)" tag; descriptions still carry those words. Vague sports titles ("Minnesota Lynx Home Game" with no opponent) are a *data* gap, not a formatting one — the future answer is resolving the opponent at verification time (4.5), noted in the roadmap.
