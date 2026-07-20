# Deploy 4.4.1 — Span-aware collapse + parent-child fold

*July 20, 2026. Fixes the structural blind spot that let the Jul 20 pipeline run re-create
the duplicates COLLAPSE-1.1 had just cleaned up.*

## The bug

`collapseMultiDayRuns` clustered rows by **start-day adjacency only**. Once a festival is
collapsed to one card with a `multi_day_end` span, that span was invisible to the next
pass — a new "Minnesota Renaissance Festival (Weekend V)" row dated three weeks into the
run looked like an isolated event (21-day gap from the survivor's *start*) and always
survived. Every weekly pipeline run re-seeded duplicates; a one-time SQL can never win.

## What shipped

All planning moved into a pure, golden-tested `planCollapse()` in `lib/multiday.ts`
(consumed by both `lib/upsert.ts` in the pipeline and `scripts/collapse-multiday.ts`):

1. **Span-aware clustering** — rows cluster on their full interval (start → `multi_day_end`),
   so single-day rows landing inside or adjacent (gap ≤ 1 day) to an existing run card join
   it. Weekly-series protection unchanged: 7-day gaps still split. Sports unchanged: same-day only.
2. **Run-phrase normalization** — grouping keys now strip "Weekend V" (roman numerals) and
   trailing dash-phrases from a whitelist ("— Final Weekends", "– continued weekends",
   "— Opening Weekend"…). Whitelist only: "— Labor Day Weekend" and "— Butter Sculptures"
   keep their words (guarded by an existing golden test).
3. **Parent-child fold** (Taren's call, 2026-07-20, matching the COLLAPSE-1.1 precedent):
   a non-sports row whose normalized title word-prefix-extends another's ("Minnesota State
   Fair — Llama Costume Contest") folds into the parent when its dates sit **entirely inside**
   the parent's span. Distinct titles never fold (Phantom's Feast survived); out-of-span
   sub-events stay live (conservative floor).
4. Survivor choice: earliest start; ties prefer the row already carrying the curated span,
   then the shorter title. Spans only ever extend, from attested rows.

## Applied to production (this session)

`npm run collapse` archived **32 rows** (726 → 694): RenFest 3 retitles, State Fair 6
attraction rows, Sever's 5, plus same-day dupes the old pass missed (Guys and Dolls,
Suzanne Jackson exhibition, Thai Sunday Market date-suffix retitles ×4, J. Cole, DJ Shadow,
Farm Aid, three church fall festivals, Skyline Mini Golf, Can Can Wonderland, Washington
County Fair, Stockyard Days, Steampunk Wasteland, Improv All-Stars same-day dup).
Second dry-run plans **0 actions** (idempotent). Row states of everything touched are
backed up in the session scratchpad (`collapse-backup-20260720.json`); nothing deleted —
rollback is `status = 'published'` per the backup.

**For the Thursday verify pass:** "Sever's Fall Festival (Weekend V)" Oct 10 and
"(Weekend VI)" Oct 17 remain live because the curated card's end (Oct 4) is a conservative
floor. If Sever's really runs to Oct 17–18, extend the card's `multi_day_end`; next
pipeline run will then fold both automatically.

## Quality gate

37/37 multiday tests (13 new golden cases incl. the Jul 20 wave as regressions, sports
guards, honest emptiness) · `npm test` 572/572 · tsc clean · build clean · audit 0 ·
verified live DB counts: RenFest 1, State Fair 1, Sever's 3 (card + 2 verify-pass rows).

## Deploy steps

1. Push to `main`. Code-only — no schema change. The pipeline picks up the new logic on
   its next scheduled run; until pushed, **the Monday pipeline will re-create duplicates again**.

## Verify checklist (after next Monday's pipeline)

- [ ] Pipeline log line shows `folded N sub-event group(s)` when applicable.
- [ ] RenFest / Sever's / State Fair still one published card each.
- [ ] A Twins homestand still shows every game.

## Rollback

`git revert` the commit (restores start-day-only clustering). Data rollback: re-publish
archived ids from the scratchpad backup file.
