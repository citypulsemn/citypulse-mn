# Deploy — placeholder title detector (26 Aug 2026)

## What shipped

`findPlaceholderTitles` in `lib/contradictions.ts`, reported in the weekly ops
digest's **Self-check** section.

It finds listings that name no event: `"Turf Club Show (Sep 3)"`,
`"Hopkins Center for the Arts – Concert (September 26)"`,
`"Fitzgerald Theater Concert Event"`, `"Show (Aug 26)"`.

**21 found** across 1,209 upcoming listings.

## Why it needed to exist

The research agents write these when they can tell a venue has *something* on but
not what. The listing then survives every existing check, because its date, venue
and time are all perfectly valid — there is nothing wrong with it except that it
tells the reader nothing.

The clash report caught a handful of them by luck, when a real listing happened
to land in the same room at the same hour: `"Turf Club Show (Sep 3)"` sat beside
the verified `"Clung Tight"`. That is not a detector, that is a coincidence.

## The rule

Strip the venue name, the date, and generic event nouns. What's left is what the
title actually tells a reader. If nothing is left, it tells them nothing.

## The calibration that mattered

A first cut flagged **47**, and most were wrong in a single way I hadn't
anticipated: **a great many real events are named after the place they happen.**

```
Mill City Farmers Market      Dead End Hayride
Trail of Terror               Sever's Fall Festival
```

Strip the venue words from those and nothing is left either — but nothing is left
because the venue name *is* the event name.

So the vocabulary is split in two. **Tier A** (`PLACEHOLDER_NOUNS`) are nouns that
stand in for a name — *Show, Concert, Event, Performance, Game* — and one must be
**present** before anything can be called a placeholder. **Tier B**
(`GENERIC_QUALIFIERS`) are *Early, Opening, Season, Live, General Admission,
Series*: stripped before judging, never a reason on their own.

That one requirement separates `"Turf Club Show (Sep 3)"`, which names nothing,
from `"Dead End Hayride"`, which names everything it needs to. It also spares
`"Scream Town — Opening Night 2026"` and `"Utepils Brewing Friday Night Live"`,
where the qualifier modifies a real name rather than replacing one.

**47 → 21, all genuine.**

## Two traps, both hit

**The bracket rule was too greedy.** A bare `/\[[^\]]*\]/` flags the Walker's
`"Moriah Evans: }[…/+*^%<>€£¥$&@!!!^^^]{"` and a Lara Somogyi piece called
`"a [time] pattern"` — real works whose titles contain punctuation. (I hit this
same false positive during the sports cleanup and evidently didn't learn it the
first time.) Only a bracket naming a *slot* counts now.

**The detector couldn't see the words it tests for.** Reusing `tokens()` was the
obvious move and silently wrong: that tokenizer discards `show`, `event` and
`live` as meaningless noise — correct when comparing two titles for similarity,
exactly wrong here, where those words are the entire signal. The Tier A check
could never match, and the detector quietly found 7 instead of 21. It needed its
own tokenizer and its own connector list.

## Reported, not alerted

Placeholder titles print with up to four examples and **do not raise the section
alert**, matching placeholder venues. Conflicts remain the only alert: 21 is a
fixed backlog, and a permanent warning would destroy the subject-line signal the
digest depends on. The count is visible either way.

## Deploy steps

1. Merge to `main`. Nothing here is build-time; Vercel auto-deploys.
2. **No new secrets, no dependencies, no schema change.**
3. It appears in the next weekly ops digest automatically.

## Verify

```bash
npm run ops-digest -- --dry-run
```

Expect a `21 listings whose TITLE names no event` line under `## Self-check`,
with examples.

## Rollback

Drop the `placeholderTitles` / `titleExamples` block from the Self-check section
in `lib/ops-digest.ts` and the `findPlaceholderTitles` call in
`scripts/send-ops-digest.ts`. The library function is pure and inert unless
called; no data is written by any of it.

## Quality gate

`npx tsc --noEmit` clean · **1405/1405** tests (+11) · `npm run build` exit 0 ·
`npm audit` 0 vulnerabilities · ran the real digest and read the rendered section.

## Still open

**Nothing has been acted on.** This reports; it does not fix.

- **21 placeholder titles.** Most are music rooms now covered by the First Avenue
  importer, so the honest fix for those is not to retitle them but to hide them —
  the real show is already on the site beside them. Worth a `--apply` tool in the
  shape of `dedupe-flagged`, once you've read the list.
- **32 conflicts** and **6 listings with venue "TBD"**, unchanged.
- The detector is **report-only by design**; nothing archives on the strength of a
  word-list.
