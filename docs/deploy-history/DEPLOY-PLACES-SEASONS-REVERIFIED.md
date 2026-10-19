# Deploy — Places seasons re-verified against their sources (6 Oct 2026)

## What shipped

Six registry entries in `lib/places.ts` carried a `season` wider than their own
source attests. They were found on 5 Oct 2026 while building the weekly Places
still card, which works around them with a card-only table
(`CARD_SAFE_BY_SLUG` in `lib/reels/cards/places-card.ts`, uncommitted in the
main checkout). The public Places pages kept showing the wrong season. Each
entry was re-read against its `sourceUrl`, and where the live page says only
"Open" or "Closed", against the Wayback Machine's captures of that same page
across 2025–2026.

| slug | was | now | what the source said |
|---|---|---|---|
| `hyland-hills-disc-golf` | year-round | **May–September** | "Closed for the season" 9 Feb 2025, 17 Dec 2025, 26 Jan 2026; "Closed" 14 Apr 2026; "Open" 17 Jun and 10 Sep 2025, 13 May and 27 Aug 2026; "Closed for the 2026 season" by 5 Oct 2026 |
| `elm-creek-disc-golf` | year-round | **June–October** | "Closed for the season" 9 Feb and 19 Apr 2025, 25 Jan and 14 Apr 2026; "Open" 17 Jun and 10 Sep 2025, 10 Jul and 6 Oct 2026 |
| `apple-valley-sports-arena` (rink) | September–May (closed summer) | **October–March** | "ice from mid-October to mid-March and dry floor space from mid-March to September" |
| `theodore-wirth-disc-golf` | year-round | unchanged; `verifiedAt` bumped | "Open sunrise to sunset daily" on the live page and in the January 2026 capture alike, no seasonal wording. Winter closure is attested neither way |
| `lorraine-splash-pool-south-st-paul` | April–October | June–August — **already on main, 90d89a3 (5 Oct)** | "has closed for the 2026 season. We look forward to seeing you next year!" No 2027 date |
| `northview-pool-south-st-paul` | April–October | **pulled from the registry, 90d89a3 (5 Oct)** | the parks director's letter: site being prepared for a new aquatics center, no reopening date |

Card side (applied in the main checkout, see "Deploy steps"): the lines for Apple Valley, Hyland
and Elm Creek come out of `CARD_SAFE_BY_SLUG`; the three new labels get windows
in `CARD_SAFE_SEASONS` (October–March → Nov 1–Mar 10; May–September → Jun 1–Aug
31; June–October → Jun 15–Sep 30). Theodore Wirth and Gibbs Farm keep their
lines. `docs/REELS-PUBLISH.md`'s two passages about the table are updated.

**Addendum, 19 Oct 2026 — Gibbs Farm.** `gibbs-farm` (museum) was year-round
against its own intro ("open the warm months"). rchs.com/gibbs-farm/visit-us,
read 19 Oct: public hours Saturdays 10–2, from opening day in late May (May
23, 2026) to mid-October (last public day Oct 17, 2026); ticketed events run
outside those hours. Now **May–October** (the label its sibling museums use),
intro rewritten to say the Saturdays, `verifiedAt` 2026-10-19. Its line came
out of `CARD_SAFE_BY_SLUG`; only Theodore Wirth keeps one.

## Why it was done this way

- **The conservative floor, flagged.** No Three Rivers page states opening or
  closing months. The Wayback captures bracket each season but leave edge
  months unsettled: Hyland's April and October (closed on 14 Apr and 5 Oct, no
  capture between), Elm Creek's May and November. CLAUDE.md's rule for an
  unattested fact is the conservative floor plus a flag for the verify pass,
  so each season is only the months a capture attests open, and the comment
  above each entry lists every capture so the next pass can widen it on
  evidence. The cost is a false "closed" in those edge months, never a false
  "open".
- **Two windows, not one shared label.** Hyland was open on 13 May 2026 and
  closed by 5 Oct; Elm Creek was open on 6 Oct and has no May capture. One
  label would overstate one course or understate the other.
- **Inline seasons, no new constants.** Each is a one-off window with its own
  evidence; a shared constant would imply a shared fact.
- **Theodore Wirth left year-round.** Its intro puts it beside a par-3 course
  that closes for winter, but the Park Board's disc golf page reads the same in
  January as in July. Changing it would state what the source does not. The
  still card keeps its own warm-season line, a card-safety stance, not a
  registry claim.
- **Drift guards** in `lib/__tests__/places.test.ts`: a disc golf course whose
  intro puts it on ski slopes, ski trails or a tubing hill may not be
  year-round; no rink may sit on the indoor water park's September–May
  season; the three corrected seasons are pinned with the dates the captures
  attest.

## Quality gate

The registry fix lives on branch `claude/elated-rubin-68f9e8` (this worktree).
The card-side change cannot live there, because the card files are uncommitted
work in the main checkout, so it was applied there directly and verified in place:

- **Combined, in the main checkout** (registry fix + card-side edits, 6 Oct):
  tsc clean (worktree copies under `.claude/` excluded); vitest 141 files,
  **2,607 tests passing**, card suite included (edge table of 11 labels, the
  three-year rotation from four go-live Wednesdays); `next build` clean, 610
  static pages; `npm audit` 0. The main checkout was then restored byte-for-byte
  to its prior state (the app's worktree guard is right that a session's edits
  belong on its branch). After the registry fix landed on main (f88371c), the
  card-side edits were re-applied there on 12 Oct 2026 by the same
  string-matching script: 141 files, **2,610 tests passing**.
- **This branch alone**: tsc clean; vitest 136 files, **2,358 tests passing**;
  `next build` clean. `npm audit`: **2 high, both pre-existing on HEAD's
  lockfile** and unrelated to this change (sharp < 0.35.5, CVE-2026-96889;
  source-map-js ≤ 1.2.1, GHSA-68fv-2mgg-jv7q). The main checkout's uncommitted
  `package-lock.json` bump (6 Oct, 12:02) already clears both — audit reads 0
  there. The lockfile is deliberately not bumped on this branch, so a plain
  `git pull` into the main checkout is not blocked by its dirty lockfile. If
  the still-card work does not land first, run `npm audit fix` after this
  merges to bring the committed lockfile to 0.
- **Smoke on the built combined site** (`next start`, 6 Oct 2026):
  `/places/disc-golf` with "Open this season" ticked reads **31 of 32** and
  Hyland Hills is the one hidden; Elm Creek and Bryant Lake stay. Kind-page
  HTML carries each new label once (the map popup's season text);
  `/places/rink` carries "October–March" for the arena.

## Deploy steps

Two parts, in this order. Both are done.

1. **Registry fix (this branch).** Files: `lib/places.ts`,
   `lib/__tests__/places.test.ts` and this guide. Committed as f88371c
   (`fix — three Places seasons were wider than their sources`) and pushed to
   `main` on 12 Oct 2026. Vercel deploys on push. The kind pages are ISR with
   a one-hour revalidate, so `/places/disc-golf` and `/places/rink` pick it up
   within the hour.
2. **Card table (main checkout, where the still-card work lives).** Applied
   there the same day, after `git pull`: three lines out of
   `CARD_SAFE_BY_SLUG`, three label windows into `CARD_SAFE_SEASONS`, the card
   tests and two passages of `docs/REELS-PUBLISH.md` updated. Full suite in
   the main checkout: 2,610 passing. These files are uncommitted there and go
   into the still card's own commit. (A `git apply` patch of the same change
   shipped with f88371c and was retired once applied.)

Also: the main checkout's `.next` folder was built from the combined tree
during the smoke and is stale against its source until the next `npm run
build` there.

## Verify after deploy

- `/places/disc-golf`, tick "Open this season": in October it reads 31 of 32
  and Hyland Hills is absent; Elm Creek is present until 1 November.
- `/places/rink`, tick "Open this season": Apple Valley Sports Arena is listed
  October through March and absent April–September.
- The map popup for each of the three shows the new label.
- `/places/disc-golf/hyland-hills-disc-golf` still renders (slug pages are
  static and carry no season note).

## Rollback

`git revert` the commit. Flipping the three seasons back by hand is not a
rollback: the card table would need its three lines back too, or the card
drift guards fail.

## Left for the verify pass

- **Hyland Hills**: open in late April or early October? The Three Rivers page
  status around 20–30 April 2027 and 1–4 October 2027 settles both. Widen only
  on a capture that says "Open".
- **Elm Creek**: May and November. Same check in May 2027 and mid-November 2026.
- **Theodore Wirth**: whether the disc golf course closes with the par-3 for
  winter. Nothing on the Park Board's pages says. If it appears, the registry
  changes and the card line comes out.
- **Lorraine Splash Pool**: a 2027 opening date on
  `southstpaulmn.gov/171/Aquatics`. **Northview**: an announced reopening, at
  which point it is re-added.
