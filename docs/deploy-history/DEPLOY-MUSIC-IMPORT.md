# Deploy — venue calendar importer, music (22 Aug 2026)

## What shipped

The second primary-source importer. First Avenue's own show calendar — six rooms,
the densest single source of live music in the Twin Cities — now drives the site's
listings for those rooms.

**Ran against production.** First pass:

```
316 shows on the calendar · 9 hidden (3 found elsewhere) · 4 flagged · 231 added · 58 verified
```

Converged run: `0 hidden · 0 added · 287 verified · 4 flagged`.

| | Before | After |
|---|---|---|
| Upcoming music listings | 220 | **442** |
| …verified against a source | **1** | **278** |
| Whole site verified | ~3% | **33%** (364 of 1119) |

Every one of the 243 imported rows carries a real show time; none fell back to
all-day.

## Design decisions, and why

**The calendar is truth for its own rooms only.** `authoritative` is per venue.
First Avenue promotes shows at the Armory and the Cedar, and their absence from a
First Avenue page says nothing about those buildings — those listings can only be
added to or confirmed, never hidden.

**A new verdict sports didn't need: `unmatched` → flag, don't touch.** Music
titles are fuzzy. If the room is busy that night and nothing matches, that is
likelier to be our matcher failing than the venue forgetting a show, so it writes
an `import_music_review` audit row and leaves the listing up. Four this run.

**And its opposite, `moved`.** If the same act appears elsewhere on the calendar,
we are not inferring absence — we are looking at the show. Altın Gün was on the
site at First Avenue when the calendar had it at Fine Line the same night; Steel
Beans was eleven days off. Hidden with the evidence recorded, correct version
created in the same pass.

**Every hide was checked by hand before applying.** The six `phantom` verdicts
were verified against the calendar one at a time: the Palace was genuinely dark on
9 Sep, the Mainroom on 4, 25 and 30 Oct. The calendar returns 82/102/127/70 shows
across those months, so it is not a thin page being over-read.

**Times come from detail pages, paced.** The month list has no times. One fetch
per added show, 500ms apart, identifying User-Agent, "Show Starts" preferred over
"Doors Open", capped at 260 per run.

## Two things I got wrong and reversed

**I tightened the title matcher and made it worse.** Requiring the overlap to be a
large fraction of the *longer* title killed "Mastodon" vs "Mastodon with
Deafheaven and Alcest (18+)" and "Chat Pile" vs "Chat Pile with Soul Glo" —
headliner-plus-support, which is most of a venue calendar. It was guarding against
a case I had invented. Reverted, with the real cases pinned as tests.

**I added the classifier and had to remove it.** The reasoning was sound — a music
room also books comedy and wrestling — but measured against the real calendar it
scored the VENUE name, so all eighteen Fitzgerald *Theater* shows came back
"arts", They Might Be Giants and Gary Clark Jr. among them, and the word "Kid"
made a family event of Ugly Kid Joe. Flat `music` gets ~20 of 26 right where the
classifier got 6. Twenty-six already-inserted rows were corrected with
`import_music_recategorise` audit rows.

## The bugs the second run caught

The first run reported 231 added; the second still wanted 8. All three causes were
the same shape — **a listing that could not match itself**:

- **Non-ASCII names.** `[^a-z]` filtering turned "Altın Gün" into `alt n` and
  "Eivør" into `eiv r`. Fixed with NFD plus a transliteration map.
- **Short names.** The 4-character distinctive-word rule meant L7 and RAV failed.
  Fixed with an exact folded-title short-circuit.
- **Same billing twice in one night.** `event_key` is `title|venue|day`, so
  Michael Che's two 29 Aug shows can't be stored separately and the second was
  missing forever. The feed now collapses them.

## Deploy steps

1. Merge to `main`. Vercel auto-deploys; nothing here is build-time.
2. **No new secrets.** `DATABASE_URL` only — the calendar is public HTML.
3. The weekly step is already in `.github/workflows/weekly-research.yml`, after
   the sports step.

## Verify

```bash
npm run import-music -- --dry-run     # expect 0 to hide, 0 to add
```

- `/day/2026-09-04` shows the Turf Club double-header at 7 PM and 7:30 PM.
- Admin → Events, Music: First Ave / Entry / Turf Club / Fine Line / Palace /
  Fitzgerald rows all carry `verified_at`.
- No listing shows an invented time: `all_day = false` on all 243 rows because
  every one had a real "Show Starts".

## Rollback

- Undo a run from `admin_audit`: `import_music_hide`, `import_music_review`,
  `import_music_recategorise`.
- Stop it running: delete the "Reconcile music against venue calendars" step from
  the workflow.
- The code is inert unless invoked — no page imports it.

## Quality gate

`npx tsc --noEmit` clean · **1359/1359** tests (36 new) · `npm run build` exit 0 ·
`npm audit` 0 vulnerabilities · rendered `/day/2026-09-04` and read the output.

## Still open

- **Twenty-four of thirty music venues** are still agent-researched and
  unverified: the Armory, the Cedar, Icehouse, the Dakota, Orchestra Hall, the
  Ordway, Xcel, Target Center, Mystic Lake and the rest.
- **No venue publishes schema.org event markup** — eight sites checked — and only
  First Avenue exposes a WordPress REST route, whose `event` type omits dates. So
  each additional venue needs its own adapter; there is no shortcut.
- **Comedy and spoken word at the Fitzgerald sit under music.** No usable category
  signal exists yet.
- **Four flagged listings** await a human in `admin_audit` (`import_music_review`).
- **arts, family, festival, food and weird** remain almost entirely unverified —
  192, 173, 96, 79 and 55 upcoming listings with 11, 3, 2, 1 and 0 verified.
