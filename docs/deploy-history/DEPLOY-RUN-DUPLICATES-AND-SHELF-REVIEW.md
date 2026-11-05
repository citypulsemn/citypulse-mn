# Deploy — one show shown three times, and the ten things a review found in the shelf

**Date:** 5 November 2026
**Data:** 16 corrections applied — 14 archives, 1 republish, 1 date fix (backed up)
**Code:** `lib/events.ts`, `lib/dates.ts`, `app/day/[date]/page.tsx`,
`components/DayPanel.tsx`, `components/CalendarView.tsx`, `docs/ENGINEERING.md`,
`docs/MULTIDAY.md`, `lib/__tests__/ongoing.test.ts`
**Schema:** none.

Fourth and last in the day-surface sequence. The shelf
([DEPLOY-DAY-ALSO-RUNNING-SHELF.md](DEPLOY-DAY-ALSO-RUNNING-SHELF.md)) made long runs visible;
clearing the admission rows
([DEPLOY-ADMISSION-ROWS-TO-VENUE-HOURS.md](DEPLOY-ADMISSION-ROWS-TO-VENUE-HOURS.md)) left the
duplicates as the next thing a reader would notice. This clears those, and applies a 14-agent
adversarial review of the shelf itself.

---

## Part 1 — the duplicates

### Only one grouping question gives the right answer

Grouping live rows by the project's own `runKey` finds **75 "excess" rows** — and almost all of
them are legitimate: Timberwolves vs Denver on two different nights, two Gophers games in a
weekend set, a Nutcracker on the 12th and the 13th. Merging those would break the sports rule
outright.

The question that matters is **same production, OVERLAPPING dates** — the site claiming one
thing is running on one day twice. That is **7 productions, 14 excess rows**.

### Every run verified against the organiser, not against itself

| production | organiser says | our rows said |
|---|---|---|
| Twelve Kinds of Ice | "October 13-November 22, 2026" (CTC) | 4 rows starting 19 Oct, 26 Oct, 2 Nov, 6 Nov |
| Grinch | "November 3, 2026-January 3, 2027" (CTC) | keeper exact + a stray 26 Dec |
| Olalekan Jeyifous | "Aug 6, 2026–Jan 3, 2027" (Walker) | keeper exact + 15 Oct, 29 Oct, 14 Nov |
| Collection in Focus: Martine Syms | "Jun 25, 2026–May 23, 2027" (Walker) | **29 Oct – 27 Nov — both ends wrong** |
| Holiday Flower Show | "December 4, 2026 through January 3, 2027" (Como) | keeper exact + a 26 Dec tail |
| Kunene and the King | **page 404s, both tools** | 5 rows, all closing 8 Nov |

The starts one week apart with an identical close are the weekly sweep minting a fresh row each
pass and clipping it to the sweep window — the same mechanism as
[DEPLOY-RUN-REFIND-FOLD.md](DEPLOY-RUN-REFIND-FOLD.md), on runs that pre-date the fold.

### The find that justified checking before editing

For *Twelve Kinds of Ice*, **none of the four live rows had the real opening.** The obvious fix
— edit the earliest row's start to 13 October — **collides**: `event_key` is
`sha256(title|venue|start day)`, and an **archived** row already owns that key. It holds
`2026-10-13 00:00 → 2026-11-22 23:59`, which is CTC's printed run exactly. Created 21 September,
last seen 21 September, archived with **no `admin_audit` row** — so an automated pass dropped
the correct row and four clipped re-finds replaced it.

So the keeper is a `publish`, not an edit. The right row was already there.

### What was applied

**16 of 16, 0 refused**, backed up to
`C:\Users\mccul\Documents\CityPulseMN\backups\2026-11-05-run-duplicates-before.json`.

- **14 archives** — the surplus rows of six productions
- **1 republish** — the archived *Twelve Kinds of Ice* row with the true run
- **1 edit** — *Martine Syms* corrected to 25 Jun 2026 – 23 May 2027, the only keeper whose own
  dates were wrong. Start day changes, so `event_key` changes; checked, no collision. Not
  stamped: start and end are verify-relevant and the Walker prints no clock time.

**Kunene got no date correction, deliberately.** Its Guthrie page 404s for both a scripted fetch
and the browser, so the real opening is unverified. Archiving four rows asserts nothing new —
the keeper already said 10 Oct – 8 Nov — and the run closes in three days.

### Result

| | before | after |
|---|---|---|
| published rows | 592 | **579** |
| productions with overlapping live rows | 7 | **1** |
| excess live rows | 14 | **1** |
| duplicate titles on any shelf | 3× *Twelve Kinds of Ice* | **0** |
| "also running" on 10 Nov | 22 | **18** |

**The one left is not a duplicate.** Two Ordway rows on 17 November, one titled "– School
Performance" and one "– School Performance (Midday)": two genuinely different performances the
same day. Merging them would be the mistake the sports rule exists to prevent.

---

## Part 2 — what the review found in the shelf

14 agents, 5 claims, two lenses each, plus a synthesis pass. Verdict: *"Not safe to ship as it
stands, but it is close, and the core is sound."* It verified the membership partition
independently — no row double-renders, no open row falls between the predicates — and then
found the following. **All fixed here.**

### Must-fix

1. **"See all 29 ongoing runs →" was a promise `/ongoing` cannot keep.** That page is
   `chiDayKey(now)`-relative and capped at 12, so on any day but today it contains none of
   those runs. Now reads **"More ongoing runs →"** — true on every day page — and the honest
   total stays in the header count line, where it already was.
2. **`docs/MULTIDAY.md` stated the opposite of what ships** — including a line I had added
   in this same working tree saying "a day page is still start-day-only for a long run".
   This is the file whose stale text caused three bad corrections on 4 November. Corrected
   in both places: the grid is start-day-only, the day page carries the shelf.
3. **The rule-5 checklist was wrong on arrival — again.** `docs/ENGINEERING.md` and the
   `lib/dates.ts` comment said **two** derivations cannot delegate, while the shelf was adding
   a **third** in the same tree. Both now say three and name all of them. Two successive
   reviews caught this same paragraph undercounting; that is recorded in it.

### Also fixed

- **ENGINEERING rule 1 — a broken instrument must not kill its panel.** The shelf read
  re-threw, and the page awaits both reads in one `Promise.all`, so a transient failure of a
  *decorative* query would 500 a day page whose own read succeeded. It now logs and returns
  `[]`. The comment I had copied from the sibling cited an ISR cache this dynamic route does
  not have.
- **The guarded span expression.** A bare `coalesce(multi_day_end, end_at)` prefers
  `multi_day_end` even when it is not later than the start day, where `spanEndISO` falls
  through to `end_at` — so the SQL and the planner could disagree. **Measured: 0 published rows
  have that shape**, and `lib/corrections.ts` rejects only a `multi_day_end` *before* the start,
  so it permits one equal to it. Guarded in the new query. `readEventsForDay` still carries the
  bare form — the same latent defect, left for a change that can re-verify the main day list on
  its own, and now named in a comment beside it.
- **`limit 60`** on the new query — it shipped ~30 rows per day to render at most 6.
- **Deleted `getAlsoRunningForDayUncached`** — no caller anywhere.
- **Structured data on the day the feature exists for.** `/day/2027-01-19` shipped six visible
  cards and zero JSON-LD, because the ItemList gate read the day list. The shelf now stands in
  when the day's own slate is empty — still excluded otherwise, so 365 day pages don't carry
  the same 30 URLs.
- **The calendar cell stopped lying to screen readers.** A day whose only content was over-cap
  runs rendered `dim` and announced `"19: no events"` while the panel it opens held six cards.
  It now announces **"19: 14 ongoing runs"** and is not dimmed. The visible pills stay capped —
  that is what the cap protects.

### Tests added for both

- The complementarity sweep now builds **three fixtures per span** — `multiDayEnd`-carried,
  `end_at`-carried, and the `multiDayEnd == start day` shape the two SQL clauses disagreed
  about. A sweep that only understood `multiDayEnd` would have stayed green over that forever.
- **The rule-6 gates are pinned in source.** The dishonest empty state lived in JSX and so does
  the fix; re-ternarying the page would restore the exact bug with a green suite. Three
  assertions now read the page file.

### Two review findings deliberately not acted on

- **"Already running" vs "Also running"** on the same page. Editorial copy is Taren's call and
  Taren chose the phrase; `/ongoing` also uses "Also running" for something else. Flagged, not
  changed.
- **`readEventsForDay`'s bare coalesce** — see above. Measured zero, and fixing the main day
  query deserves its own verification pass.

---

## Quality gate

| | |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` | **3,135 passed in 152 files** (3,132 + 3) |
| `npm run build` | clean, 611 pages |
| `npm audit` | **0 vulnerabilities** |
| corrections | 16 applied, 0 refused, backed up, caches cleared |

### Observed on the running site, through the rewritten SQL

| page | count line | shelf |
|---|---|---|
| `/day/2026-11-10` | "6 events · 18 also running" | 6 distinct, 0 duplicates, 0 admission |
| `/day/2026-11-20` | "19 events · 22 also running" | 6 distinct, 0 duplicates |
| `/day/2027-01-19` | "14 also running" | 6 distinct, **6 JSON-LD items** (was 0) |

Link reads "More ongoing runs →" on all three. Calendar cell 19 Jan 2027:
`aria-label="19: 14 ongoing runs"`, not dimmed.

---

## Deploy

Data is live. Code ships with the rest of the branch.

```bash
git add -A lib app docs corrections-run-duplicates.json
git commit -m "fix — one show appeared three times on a day page"
git push
```

### Verify after deploy

Use **www**. The apex 308s to it, and a bare `curl` without `-L` gets a 15-byte
redirect body — which is how a deploy watcher reported "not live" for eight
minutes while the deploy had in fact landed. `SITE_URL` is already the www host
(lib/seo/site.ts).

1. `https://www.citypulsemn.com/day/2026-11-20` — *Twelve Kinds of Ice* appears **once**
2. `https://www.citypulsemn.com/event/c218b44b-523e-477c-a3fe-50a494b9decb` — live, 13 Oct – 22 Nov
3. `https://www.citypulsemn.com/day/2027-01-19` — view source, the ItemList has 6 items
4. Any day shelf — the onward link reads "More ongoing runs", never a count
5. `https://www.citypulsemn.com/venues/walker-art-center` — there is no such page; check
   *Martine Syms* on `/ongoing` instead, closing 23 May 2027

## Rollback

- **Data:** republish from `2026-11-05-run-duplicates-before.json`; the one republished row
  (`c218b44b`) goes back with `archive: true`, and *Martine Syms* takes its old dates from the
  backup.
- **Code:** `git revert`. Every code change here is a correction to the previous commit's work,
  so reverting returns to the shelf as first built — including the defects above.

---

## Left open

- **The sweep will mint more.** Nothing stops next Monday producing a fresh clipped row for any
  running show. The fold covers re-finds it can match; these pre-dated it or carried a start it
  did not expect. This is the same treadmill as the admission rows.
- **`readEventsForDay`'s bare `coalesce`** — measured zero today, unguarded still.
- **Kunene's real opening is unverified** — the Guthrie's show URL 404s; the run closes 8 Nov.
- **A "Final Weekend" row was archived** (`92142d03`). If the Guthrie sells that separately,
  bring it back; nothing on their site says so.
- **`eventsInWindow` is still not span-aware** — the explorer's list and map still drop any
  multi-day run whose start falls outside the viewed window. Unrelated to this work and still
  the largest remaining reach defect.
- **"Already running" / "Also running"** — Taren's call.
