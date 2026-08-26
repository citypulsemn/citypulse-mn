# Deploy — collapsing the flagged duplicates (22 Aug 2026)

## What shipped

`npm run dedupe-flagged` — a tool that acts on the duplicate half of the
self-check (`docs/SELF-CHECK.md`), plus two corrections to the classifier that
feeds it.

**18 rows archived, 17 kept. Duplicates now report zero.**

## The classifier was wrong first, so it got fixed first

The self-check reported 26 duplicates. Reading all 26 before touching anything,
**seven were not duplicates at all** — and archiving them would have deleted real,
distinct events from the calendar.

**A series is not a duplicate.** The Lake Harriet Bandshell runs "Free Music in
the Parks" all summer:

```
Free Music in the Parks – The Roundabouts
Free Music in the Parks – Hurricane Blaze
```

Two different bands, one night, and the shared prefix is the *series name* — it
carries no identity whatever. `looksLikeSameEvent` now checks: when both titles
open with the same run of words and what follows has nothing in common, they are
different events. Three Lake Harriet pairs and the Children's Museum's "First
Free Sunday" pair were rescued by this.

**The venue's own name carries no identity either.** It is already the grouping
key, so a title that repeats it is saying nothing:

```
Walker Art Center – Dorothée Munyaneza: Tituba
Moriah Evans: }[…/+*^%<>€£¥$&@!!!^^^]{ – Walker Art Center
```

Two unrelated performances that looked alike purely on the strength of the
building. Venue tokens are now stripped from both titles before comparing.

Both changes push borderline cases from `duplicate` toward `conflict`, which is
the safe direction — a conflict is read by a person, and a wrongly-archived event
is not. It demoted a few genuine duplicates too (Carpenter's Apple Festival,
Scream Town's opening night); those now await review rather than being collapsed
automatically, which is the right trade.

## How a keeper is chosen

1. **Source-verified** — evidence beats everything.
2. **Richer** (more populated fields), matching `lib/upsert.ts`.
3. **More informative title**, in distinct meaningful words.
4. Earliest created, so a re-run cannot oscillate.

Step 3 was added after reading the first dry run. Field-count richness is a
near-useless tiebreaker here — **every one of these rows scored 5** — so it fell
straight through to creation order, which is arbitrary. Arbitrary is fine when
copies are equivalent and bad when they aren't: it had kept `"Bleachers"` over
`"Bleachers with This Is Lorelei"`, and a support-act billing over
`"Underoath – Define the Great Line 20th Anniversary Tour"`. The reader loses
information both times. With step 3 every keeper is the more informative title.

## Safety

- **Dry run by default** — the opposite of the importers, because this archives
  on a fuzzy title match rather than a primary source. `--apply` to write.
- **Nothing deleted.** Losers become `status = 'archived'`, reversible from the
  Events tab.
- **Backup before the bulk change**, and an `admin_audit` row per archived listing
  naming the row that survived (`dedupe_flagged`, 18 written).
- **Clusters, not pairs.** Valleyfair listed one Halloween day three ways; a
  union-find pass collapses the graph so three pairwise decisions can't
  contradict each other.

## Verify

```bash
npm run dedupe-flagged
```

Expect `nothing flagged as a duplicate — nothing to do`.

Spot-checked in the database and on the rendered page: Lake Harriet on 4 Sep now
shows one 7:30 listing, `"Free Music in the Parks – Dan Israel"`, with the bare
`"Dan Israel"` archived — and Tony Ortiz still published, correctly, because a
second band at the same hour is a *conflict* for review, not a duplicate.
Valleyfair on 10 Oct keeps the daytime listing and its separate evening
ValleySCARE event, with two redundant titles archived.

## Rollback

**Restore from `admin_audit`, not from the backup file** — the file is written
wherever the operator pointed `--backup=` and is not a durable record. Action
`dedupe_flagged` carries every archived id and the status it was set to; the
recipe is in `docs/ADMIN.md` under "Undoing a bulk change". Or one click per row
in Admin → Events.

## Quality gate

`npx tsc --noEmit` clean · **1397/1397** tests (+3) · `npm run build` exit 0 ·
`npm audit` 0 vulnerabilities · verified in the database and on two rendered day
pages.

## Effect on the digest

Duplicates 26 → **0**. Conflicts 27 → **32**, which is not a regression: five
pairs moved out of the duplicate bucket because they are genuinely different
bands in a series, and they belong in front of a person.

Still open, unchanged: **32 conflicts** and **6 listings with venue "TBD"**. A
large share of the conflicts are the placeholder-title class
(`"Turf Club Show (Sep 3)"` beside the verified `"Clung Tight"`), which still has
no detector of its own.
