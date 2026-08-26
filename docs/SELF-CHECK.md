# Self-check — where the calendar contradicts itself

The third verification pass, and the only one that needs no outside source.

`docs/SPORTS-IMPORT.md` and `docs/MUSIC-IMPORT.md` check listings against a
league feed and a venue calendar. That works where such a thing exists. **Arts,
family, festival, food and weird — about 620 upcoming listings — have none**, and
they come from the same research pipeline that was 65% wrong about the Twins.

This module asks a question that needs no source at all: *does the calendar
disagree with itself?*

## The idea, and where it came from

On 14 September 2026 the site advertised a Twins–Yankees game at 6:40 PM and a
Twins–Orioles game at 7:10 PM, both at Target Field. **A stadium holds one game.**
No feed was required to know one of those was false — only a query. It would have
caught the whole incident in June, months before a reader did.

## Run it

The check runs inside the weekly ops digest as the **Self-check** section. There
is no separate command; `lib/contradictions.ts` is pure and the digest gathers it
like any other section.

## Two findings, because they are two different jobs

| Finding | Meaning | In the digest |
|---|---|---|
| **conflict** | Two *different* things in one room at one time. At most one is happening. | **alerts** |
| **duplicate** | One event listed twice under different titles. | reported, no alert |
| **placeholder title** | The TITLE names no event — `"Turf Club Show (Sep 3)"`. | reported, no alert |
| **placeholder venue** | The venue field names no place — `TBD`, `Various Locations`. | reported, no alert |

A conflict means something false is live on the site, which is exactly the
failure this project exists to avoid. A duplicate is untidy rather than untrue.

**When the matcher can't tell, it calls it a conflict.** That direction is
deliberate: a conflict gets read by a person, and the cost of a mislabelled
duplicate is ten seconds of their attention. Calling a real clash "housekeeping"
would bury it.

## The four-hour window

Two listings clash if they share a venue and a Chicago day and start within
**four hours** of each other.

It has to be a window, not an exact match: the Yankees/Orioles pair was thirty
minutes apart, and an exact-time check sails straight past it. Four hours also
leaves genuine pairs alone — a 1 PM matinee and a 7:30 PM performance are 5.5
hours apart and both true.

## What stops it crying wolf

**Two verified rows never conflict.** If a primary source vouches for *both*
events, the venue simply runs concurrent programming and the calendar isn't
disagreeing with itself. The Turf Club books three acts some nights; Fine Line
follows a show with a club night. Their own calendar says so.

This is the mechanism that keeps the allowlist below from growing forever: every
venue brought under a primary source stops needing an entry. It suppresses only
*conflicts* — two verified rows with near-identical titles are still worth
reporting as a duplicate.

**`CONCURRENT_VENUES`** covers the rest: campuses (Como Zoo, the Fairgrounds, the
museums) and multi-stage houses (Chanhassen, the Guthrie) where simultaneous
programming is the point. Every entry carries a written reason — a test enforces
that — and **skipped pairs are counted and reported**, never silently dropped. An
allowlist that hides its own effect is how a check quietly stops working.

Matching is **exact**, which is why `"Berlin"` and `"Berlin (Minneapolis)"` are
both listed. That is deliberate: `"Guthrie Theater"` is a three-stage complex, but
`"Guthrie Theater – Wurtele Thrust Stage"` is one room, and two performances in it
at 1 PM is a real finding that must not be suppressed by a prefix match.

## Acting on the duplicates

```bash
npm run dedupe-flagged            # dry run — prints keep/archive, writes nothing
npm run dedupe-flagged -- --apply # archives the losers, with a backup
```

Dry run by DEFAULT, unlike the importers, because this one archives on a fuzzy
title match rather than a primary source. Keeper order: source-verified, then
richer, then the more informative title, then earliest created. Pairs are
collapsed into clusters first — Valleyfair listed one Halloween day three ways,
and three pairwise decisions would have contradicted each other.

Nothing is deleted; losers become `archived` with an `admin_audit` row naming
the survivor. See `docs/deploy-history/DEPLOY-DEDUPE-FLAGGED.md`.

## Two things that are NOT duplicates

Both learned by reading all 26 findings before archiving any of them.

**A series.** The Lake Harriet Bandshell runs "Free Music in the Parks" all
summer, so "Free Music in the Parks – The Roundabouts" and "… – Hurricane Blaze"
share a long prefix and nothing else. The prefix is the series name and carries
no identity. When both titles open with the same run of words and the remainders
are disjoint, they are different events.

**The venue's own name.** It is already the grouping key, so a title repeating it
says nothing — "Walker Art Center – Dorothée Munyaneza: Tituba" and "Moriah
Evans … – Walker Art Center" are two unrelated performances that matched on the
building. Venue tokens are stripped from both titles before comparing.

Seven of the original 26 were one of these. Both fixes push borderline cases
toward `conflict`, which is the safe direction: a conflict gets read, a
wrongly-archived event does not.
## Placeholder titles — listings that name no event

`"Turf Club Show (Sep 3)"` was live beside the real, verified `"Clung Tight"`.
`"Hopkins Center for the Arts – Concert (September 26)"` beside
`"John Jorgenson Quintet"`. The research agents write these when they can tell a
venue has *something* on but not what — and the listing survives every other
check, because its date, venue and time are all perfectly valid.

The clash report found them only by luck, when a real listing happened to land
in the same room at the same hour. `findPlaceholderTitles` finds them directly.

**The test:** strip the venue name, the date, and generic event nouns. What's
left is what the title actually tells a reader. If nothing is left, it tells
them nothing.

### Acting on them

```bash
npm run hide-placeholders            # dry run — prints the list, writes nothing
npm run hide-placeholders -- --apply # hides them, with a backup
```

Hidden means `status = 'draft'`, not `archived`. A draft 404s; an archived event
page says "This event has already happened", which for a show still to come would
put a fresh falsehood where an empty one was.

**Not wired into the weekly workflow.** The pipeline keeps producing these so the
tool is repeatable, but a word list should not be quietly hiding listings every
Monday without someone reading the list first.

The dry run says, per listing, whether a real listing already covers that room
that night. It does not change the decision — a listing that names nothing is
unusable either way — but tidying a covered room and emptying a night are
different acts, and the operator should see which is which.
### The two tiers, and why they exist

A first cut flagged **47** listings and most were wrong, all in one way: on this
calendar a great many events are *named after the place they happen*. Strip the
venue words from `"Mill City Farmers Market"`, `"Dead End Hayride"`,
`"Trail of Terror"` or `"Sever's Fall Festival"` and nothing is left either —
but nothing is left because the venue name **is** the event name.

So the words are split in two:

- **Tier A — `PLACEHOLDER_NOUNS`**: nouns that stand in for a name. *Show,
  Concert, Event, Performance, Game.* One of these must be **present** before a
  title can be called a placeholder.
- **Tier B — `GENERIC_QUALIFIERS`**: *Early, Late, Opening, Season, Live,
  General Admission, Series.* Stripped before judging, but never a reason on
  their own.

That single requirement separates `"Turf Club Show (Sep 3)"`, which names
nothing, from `"Dead End Hayride"`, which names everything it needs to. It also
spares `"Scream Town — Opening Night 2026"` and
`"Utepils Brewing Friday Night Live"`, where the qualifier modifies a real name
instead of replacing one. With it, 47 became **21 — all genuine.**

### An unfilled slot is caught outright

`"Minnesota United FC vs. [Western Conference Opponent]"`,
`"vs. Big Ten Opponent"`, `"Headliner TBA"`.

The bracket rule is narrow **on purpose**: a bare `/[[^]]*]/` also flags the
Walker's `"Moriah Evans: }[…/+*^%<>€£¥## Deliberate non-goals@!!!^^^]{"` and a Lara Somogyi piece
called `"a [time] pattern"` — real works whose titles contain punctuation. Only a
bracket that names a *slot* counts.

### A separate tokenizer, deliberately

This detector cannot reuse `tokens()`. That one discards `show`, `event` and
`live` as meaningless noise — correct when comparing two titles, and exactly
wrong here, where those words are the entire signal. Using it made the Tier A
check unable to see the very words it tests for, and the detector silently
found seven listings instead of twenty-one.
## Deliberate non-goals

- **It DOES fold venue spellings** onto the room they name, since 26 Aug.
  It used to keep them apart, on the reasoning that fragmentation is its own bug
  and folding would hide it. That cost more than it saved: a verified show at
  `"Turf Club (St Paul)"` never met its duplicate at `"Turf Club"`, and
  `"Drake (with NAV)"` and `"Young Thug with NAV"` sat at the Armory on the same
  night under two spellings with nothing to notice them. The fragmentation is now
  reported directly as `venueSpellings` instead. `roomKey()` strips a trailing
  parenthetical ONLY when it is a city — `"First Avenue & 7th St Entry
  (7th St Entry)"` ends in one too, and there it names the other ROOM.
- **It changes nothing.** It is an instrument. Every finding names both listings
  so a person can act.

## Pieces

- **`lib/contradictions.ts`** — pure: `findContradictions`, `looksLikeSameEvent`,
  `findPlaceholderTitles`, `isPlaceholderTitle`, `formatFinding`,
  `CLASH_WINDOW_MINUTES`, `CONCURRENT_VENUES`.
- **`lib/ops-digest.ts`** — the Self-check section.
- **`scripts/send-ops-digest.ts`** — the gather, wrapped like every other section
  so a failed read says "unavailable" instead of a reassuring zero.
- **`lib/__tests__/contradictions.test.ts`** — 35 tests from real listings.

`foldTitle` moved from `lib/music-feed.ts` to `lib/canonicalize.ts`, since both
this and the music importer need it. It is **not** `normalizeKeyPart`, which feeds
`event_key` and must never change — editing that would re-key every row.

## What it found on the first run

Scanning 1,225 upcoming listings: **27 conflicts, 26 duplicates, 6 placeholder
venues.**

The conflicts are worth reading, because they are a different bug than expected.
A large share are **placeholder titles** sitting beside the real show:
`"Turf Club Show (Sep 3)"` next to the verified `"Clung Tight"`;
`"Hopkins Center for the Arts – Concert (September)"` next to
`"John Jorgenson Quintet"`; `"Concert at Ordway Concert Hall"` next to Cantus.
The research agents invent a filler listing when they know a venue has *something*
on but not what.

Others are real clashes: three different bands at the Lake Harriet Bandshell at
7:30 on one night; Waiting for Godot listed twice on the Guthrie's Wurtele stage
at 1 PM; Larry Fleet and The Rapture at First Avenue on the night the venue's own
calendar says Kamelot is playing — the same rows the music importer flagged, found
independently and by a different route.

## Known cost

An **abbreviated** duplicate lands in the conflict bucket. `"MNUFC vs. LA Galaxy"`
and `"Minnesota United FC vs. Los Angeles Galaxy"` share only "galaxy" once
expanded, so the matcher can't join them. Erring safe is the choice; a person
resolves it at a glance.
