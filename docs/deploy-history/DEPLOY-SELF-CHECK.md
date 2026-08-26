# Deploy — the calendar's self-check (22 Aug 2026)

## What shipped

A verification pass that needs **no outside source**. The weekly ops digest gained
a **Self-check** section reporting where the calendar contradicts itself.

The sports and music importers verify against a league feed and a venue calendar.
That only helps where such a thing exists — and arts, family, festival, food and
weird, about 620 upcoming listings, have none.

First run over 1,225 upcoming listings:

```
27 conflicts · 26 probable duplicates · 6 placeholder venues
```

## Why this shape

From the sports post-mortem: on 14 Sep the site showed a Yankees game at 6:40 and
an Orioles game at 7:10, both at Target Field. **A stadium holds one game.** No
feed was needed — only a query. This is that query.

**Conflicts alert; duplicates and placeholders don't.** A conflict means something
false is live. A duplicate is untidy rather than untrue, and alerting on 26 of
them every week would destroy the subject-line signal the digest depends on.

**When unsure, call it a conflict.** A conflict gets read; the cost of a
mislabelled duplicate is ten seconds. Burying a real clash under housekeeping is
the expensive error.

**Four-hour window, not exact-time.** The Yankees/Orioles pair was 30 minutes
apart — an exact match sails past it. Four hours still leaves a 1 PM matinee and a
7:30 PM performance alone.

## The bit I'd keep if I kept one thing

**Two source-verified rows never conflict.** If a primary source vouches for both,
the venue runs concurrent programming and the calendar isn't disagreeing with
itself — the Turf Club books three acts some nights, Fine Line follows a show with
a club night, and their own calendar says so.

This is what stops `CONCURRENT_VENUES` growing without limit: every venue brought
under a primary source stops needing an entry. It removed three false positives on
the first run and will remove more as coverage grows. It suppresses only
conflicts; two verified rows with near-identical titles still report as a duplicate.

The allowlist covers the rest — campuses and multi-stage houses. Every entry
carries a written reason (enforced by a test) and **skipped pairs are counted and
shown**, because an allowlist that hides its own effect is how a check quietly
stops working.

## What it found, and it wasn't what I expected

A large share of the conflicts are **placeholder titles beside the real show**:

- `"Turf Club Show (Sep 3)"` next to the verified `"Clung Tight"`
- `"Hopkins Center for the Arts – Concert (September)"` next to `"John Jorgenson Quintet"`
- `"Concert at Ordway Concert Hall"` next to Cantus Vocal Ensemble

The research agents invent a filler listing when they know a venue has *something*
on but not what. That is a whole defect class nobody had named, surfaced by a
check built to look for something else.

The rest are genuine: three different bands at the Lake Harriet Bandshell at 7:30
one night; *Waiting for Godot* twice on the Guthrie's Wurtele stage at 1 PM; and
Larry Fleet and The Rapture at First Avenue on the night the venue's own calendar
says Kamelot is playing — **the same rows the music importer flagged, found
independently by a completely different route.**

## Two bugs fixed along the way

**`foldTitle` was eating the letter "s".** Relocating it from `music-feed.ts` to
`canonicalize.ts` through a nested heredoc stripped the backslashes from its
regexes: `/\s+/g` became `/s+/g`, so `"Various Locations"` folded to
`"variou  location"` and the placeholder and allowlist lookups silently missed.
Caught because two tests failed for reasons that made no sense. Second regex
mangled by a heredoc in two days — those get written with the editor now.

**`import_music_review` was re-inserting every run.** Nine flagged listings had
produced seventeen audit rows. A flag is a standing note that a row needs a
person, not a log line. Now guarded by `where not exists`; the repeats were
collapsed (17 → 9).

## Deploy steps

1. Merge to `main`. Nothing here is build-time; Vercel auto-deploys.
2. **No new secrets, no new dependencies, no schema change.**
3. It appears in the next weekly ops digest automatically.

## Verify

```bash
npm run ops-digest -- --dry-run
```

Expect a `## Self-check ⚠️` section listing clash counts and up to five examples.

## Rollback

Delete the Self-check block from `buildSections` in `lib/ops-digest.ts` and the
`contradictions` gather in `scripts/send-ops-digest.ts`. `lib/contradictions.ts`
is pure and inert unless called; no data is written by any of it.

## Quality gate

`npx tsc --noEmit` clean · **1394/1394** tests (+29) · `npm run build` exit 0 ·
`npm audit` 0 vulnerabilities · ran the real digest and read the rendered section.

## Still open — this is a backlog, not a bug list

The check reports; nobody has acted on it yet.

- **27 conflicts** to resolve, several of which are the placeholder-title class.
- **26 duplicates** — mostly Lake Harriet's "Free Music in the Parks – X" versus a
  bare "X", which suggests a targeted dedupe rather than 26 manual fixes.
- **6 listings with venue "TBD"**, all festivals in mid-September.
- **The placeholder-title class has no detector of its own.** It surfaces here
  only when a real listing happens to sit beside it. A direct check —
  titles that name a venue and a date but no event — would find the rest.
