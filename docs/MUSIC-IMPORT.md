# Music import — shows from the venues themselves

The second primary-source importer, after `docs/SPORTS-IMPORT.md`. Reads First
Avenue's own show calendar and makes the site agree with it.

## Why

The sports audit fixed the category where a stranger could instantly tell we were
wrong. Music was the category where nobody could: **220 upcoming listings, one of
them ever verified against anything.** The same research pipeline that invented
six Twins games wrote all of them.

It was wrong in the same ways. Japanese Breakfast advertised at the Palace on a
night the Palace was dark. Garbage at First Avenue on a night the Mainroom had
nothing. Altın Gün listed twice, in the wrong room — the show was real, it was at
Fine Line.

## Run it

```bash
npm run import-venues -- --dry-run     # prints the plan, writes nothing
npm run import-venues                  # applies
npm run import-venues -- --days=180    # widen the horizon (default 92)
```

**Renamed from `import-music` on 26 Aug**, when the Minneapolis Park Board source
landed and it started importing nature walks and movies in the park. A script
named for one category while importing four is the drift this project writes
rules about. The Park Board source has its own doc: `docs/PARKS-IMPORT.md`.

Weekly in `.github/workflows/weekly-research.yml`, after the sports step.

## Why this is harder than sports

There is no league and no feed. Three things that came free in sports have to be
earned:

**A day is not a key.** A team plays at most one home game a night. First Avenue
routinely runs the Mainroom and the Entry at once, and a room can host an early
and a late show. Listings key on `(venue, day)` and resolve to a *list*.

**Titles are messy.** "GCW presents RUDE AWAKENING" is our "Rude Awakening";
"Mastodon with Deafheaven and Alcest (18+)" is their "Mastodon". Matching is
fuzzy — and *because* it is fuzzy it is never allowed to be the reason something
is hidden.

**A calendar speaks only for its own rooms.** First Avenue promotes shows at the
Armory and the Cedar. Their absence from a First Avenue page says nothing about
those buildings, so `authoritative: false` venues are only ever added to or
confirmed, never hidden.

## The verdicts

| Verdict | Meaning | Action |
|---|---|---|
| `ok` | On the calendar, that room, that night | stamp `verified_at` |
| `moved` | Real show, wrong room or wrong date — found elsewhere on the calendar | **hide**, with the evidence |
| `phantom` | That room is dark that night | **hide** |
| `unmatched` | Room is busy, nothing we can match | **flag only — nothing touched** |
| `unknown` | Outside the window, or a room this calendar doesn't speak for | nothing |

`unmatched` is the safety valve and the reason this module has a verdict sports
doesn't. If the room is busy and our title doesn't match anything, that is far
likelier to be our fuzzy matcher failing than the venue forgetting a show. It
writes an `import_music_review` audit row and leaves the listing alone.

`moved` is the opposite — the strongest negative available. We aren't inferring
absence, we are *looking at the show somewhere else*, and the correct version is
created in the same pass.

## Safety properties

Same contract as sports:

- **A fetch that fails changes nothing.** The month pages are slices of one
  calendar and a missing slice reads as "the room was dark", which is the verdict
  that hides things — so it is all-or-nothing.
- **The window comes from the data**, first show to last. Outside it, `unknown`.
- **No invented times.** The list page has no times, so a detail page is fetched
  per show we add and "Show Starts" is preferred over "Doors Open". No time
  found → stored `all_day`. (In practice all 243 rows got a real time.)
- **Nothing is deleted.** Hides are `status = 'draft'` with an audit row.
- Requests are paced at 500ms with an identifying User-Agent, capped at 260
  detail fetches per run.

## Pieces

- **`lib/music-feed.ts`** — pure. `parseFirstAvenueMonth`, `parseFirstAvenueTime`,
  `foldTitle`, `showTitlesMatch`, `reconcileShows`.
- **`lib/music-sources.ts`** — the venue registry, with `authoritative` and the
  spellings our own listings use.
- **`scripts/import-music.ts`** — the I/O.
- **`lib/__tests__/music-feed.test.ts`** — 36 tests, from the real cases.

## Things that bit, written down

**Non-ASCII names failed to match themselves.** `[^a-z]` filtering turned
"Altın Gün" into `alt n` and "Eivør" into `eiv r`, so each was hidden and
re-added on every run, forever. `foldTitle` now does NFD plus a small
transliteration map for the letters Unicode won't decompose (ı, ø, ł, æ, ß…).

**Short band names failed too.** The matcher demands a 4-character word to be
sure of itself, which meant L7 and RAV could not match themselves. An exact
folded-title equality check now short-circuits that.

**Tightening the matcher was worse than leaving it loose.** Requiring the overlap
to be a large fraction of the *longer* title killed "Mastodon" vs "Mastodon with
Deafheaven and Alcest", "Chat Pile" vs "Chat Pile with Soul Glo" — headliner plus
support, which is most of a venue calendar. Reverted; the loose rule is correct
here because `unmatched` never destroys anything.

**Two shows, same billing, same room, same night** cannot be stored: `event_key`
is `sha256(title|venue|day)`. Michael Che played two on 29 Aug and the second was
"missing" on every run. The feed now collapses them to one listing, which is the
honest representation of what we can hold.

**The classifier had to be removed.** It was added on the reasoning that a music
room also books comedy and wrestling. Measured against the real calendar it did
active harm: it scores the VENUE name, so every show at the Fitzgerald *Theater*
came back "arts" — They Might Be Giants, Gary Clark Jr., Chelsea Wolfe, sunn O)))
and Rodrigo y Gabriela included — and the word "Kid" made a family event of Ugly
Kid Joe. Blanking the venue moved everything to music *except* the "Kid" bug, and
it never once recognised Paula Poundstone as comedy. Flat `music` gets about 20
of 26 right where the classifier got 6.

**Known cost of that,** stated rather than hidden: comedy and spoken-word
bookings — mostly at the Fitzgerald — sit under music. First Avenue publishes a
genre taxonomy with Comedy and Improv terms but tags no events with it, so there
is no signal to use yet.

## The Armory: blocked, and why

Attempted 22 Aug 2026. **armorymn.com is behind a Sucuri JavaScript challenge.**
Every HTML path — the calendar, individual event pages, `wp-json`, the Events
Calendar plugin's iCal exports — answers `307` with an obfuscated script instead
of content. Getting past it means executing a challenge whose whole purpose is to
tell scripts from browsers, so we don't.

What *is* open on that host, and what it's worth:

| Path | Status | Useful? |
|---|---|---|
| `robots.txt` | 200, `Disallow:` (nothing disallowed) | states a permissive policy the WAF then contradicts |
| `sitemap.xml` | 200 | event URLs only — and the pages 307 |
| `/events/feed/` | 200 | **10 items, and `pubDate` is the POST date, not the show date** |

So the RSS feed hits the same wall as First Avenue's WordPress REST route: real
titles, no dates. There is no keyless primary source for this room.

**First Avenue's calendar does not reach it either** — they promote nothing at the
Armory in a three-month window, which is why the Armory is deliberately absent
from `PROMOTED_ELSEWHERE`.

### The way in

The Armory sells through **Ticketmaster** (venue 50674). The Discovery API is
documented, free, and rate-limited at 5,000 requests a day — and it would not
just solve the Armory. Xcel Energy Center, Target Center, the Fillmore, Varsity,
Uptown, Mystic Lake, the Orpheum/State/Pantages and the Ordway all sell there
too, so one adapter plausibly covers most of what is left unverified.

It needs one thing this project does not have: a free API key, which is an
account signup and therefore an owner decision, not something to be arranged
here. Until then the Armory's 26 upcoming listings stay agent-written.
## Coverage, honestly

Twelve rooms of about thirty music venues in `lib/venues.ts`: six First Avenue
runs, and six it books into (Amsterdam Bar & Hall, the Cedar, Surly Festival
Field, the State, Grand Casino Arena, Icehouse) which are add-and-confirm only.
The other eighteen — the Armory, the Cedar, Icehouse, the Dakota, Orchestra Hall, the
Ordway, Xcel, Target Center, Mystic Lake and the rest — are still
agent-researched and unverified.

Probed and rejected while building this: venue calendar pages carry **no**
schema.org event markup (checked eight sites); only First Avenue exposes a
WordPress REST route, and its `event` post type publishes titles without dates,
so the HTML calendar is the usable surface.
