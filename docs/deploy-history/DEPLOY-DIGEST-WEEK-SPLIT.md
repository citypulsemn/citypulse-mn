# Deploy — The weekly email covers the whole week, not just the weekend

*Aug 20, 2026. "It's sent Thursday but only contained weekend events." True — and
the cause was not the schedule.*

## The diagnosis (it wasn't what it looked like)
The obvious read is "the window is wrong, send it on a different day." The window
was never wrong. `weeklyPicks` has always used a **full 7 days**, and the Aug 13
email even says so in its own header: *"August 13 – 19."*

The cause is in `scoreEvent`: weekend events get a hardcoded **+2**. A midweek event
caps at 6 points, a weekend event with identical qualities hits 8. With 8 slots and
~57 weekend candidates, the weekend filled every slot before a single midweek event
was considered.

Measured against real production data for the Aug 20 send:

| | Thu | Fri | Sat | Sun | Mon | Tue | Wed |
|---|---|---|---|---|---|---|---|
| available | **33** | 22 | 28 | 7 | 4 | 20 | 13 |
| in the email (before) | 0 | 3 | 3 | 2 | 0 | 0 | 0 |

**Weekend was 45% of what was available and 100% of what shipped** — and Thursday,
the day with the most events of any day, never appeared at all.

This is why changing the schedule wouldn't have fixed it: a Monday send would have
produced a Monday email full of *next* weekend.

## What shipped
**`splitDigestEvents(events, now)`** ([lib/digest.ts](../../lib/digest.ts)) returns
two halves, divided at **the first Monday strictly after the send**:
- **`soon`** — the send day through Sunday → renders under **"This weekend"**
- **`later`** — Monday onward, still inside the 7-day window → **"Next week"**

**A quota, not a re-scoring.** `scoreEvent` is shared with the Instagram picks
(`lib/content/weekly-picks`), so tilting it would silently change that surface too.
Reserving slots — `later` is filled *first*, to its quota of 3, then `soon` takes the
rest to 8 — changes only this email. The weekend bonus still does its job *within*
each section.

The spread rules the single list had (max one per venue, max two per day) are
preserved per section, so the email doesn't stack three things at one venue.

Labels are deliberately literal. The boundary **is** the coming Monday, so "This
weekend" / "Next week" is true for every possible pick rather than a flourish that
would need a caveat.

## Honest degradation
- **Thin next week** → `later` hands its unused slots back to `soon`. A quiet Tuesday
  shortens nobody's email.
- **Empty next week** → `later` is `[]`, and the caller renders **no second section
  and no orphan heading**. With one list there are no headings at all — the email is
  exactly what it was before.
- **Empty weekend** (unlikely, but) → the sender promotes `later` to the primary list
  rather than printing an empty section under "This weekend".
- **Subject counts both halves.** It briefly said "+ 4 more" while the email carried
  8 — caught in the dry run and fixed.

## Verification (observed, not intended)
Real production data, simulating the Aug 20 send:

```
BEFORE:  Fri Fri Fri Sat Sat Sat Sun Sun      (8 of 8 weekend)
AFTER:   This weekend — Fri Fri Sat Sat Sun
         Next week    — Tue Tue Wed          (5 weekdays covered)
```

- `npm run digest -- --dry-run` against production: 7 emails, subject
  *"…Minneapolis Summer Art, Craft & Food Festival + 7 more"*, both sections present
  in HTML and plain text.
- **Tests +11** (1267 total): the Monday boundary from Thursday/Sunday/Monday (never
  "today"); next week gets its reserved slots; max-2-per-day survives the split; both
  halves date-ordered; **a thin next week returns its slots instead of shortening the
  email**; an empty week yields two empty halves and never invented filler; both
  headings in both formats; the subject counts both; and no orphan heading when there
  is no second section.
- One existing tripwire re-anchored (not weakened): it asserted the API-key check
  fires before `digestEvents(` — that call is now `splitDigestEvents(`. Same property,
  new name.
- Gate: `tsc` clean · 1267/1267 · `npm run build` clean · `npm audit` 0.

## Deploy steps
Merge to `main`. No schema, no secret. **Takes effect on the next Thursday send.**

## Why not two sends (the alternative considered)
A Monday "week ahead" plus a Thursday "weekend" was the other real option, and it's
the right shape *eventually*. At **7 subscribers** it isn't: it doubles the
unsubscribe surface and doubles the operational surface — two crons, two failure
modes — a week after we finished making one send reliable. The constraint is
audience, not send frequency. Revisit when the list is large enough that
segmentation beats simplicity.

## Rollback
`git revert`. `laterEvents` is optional and `digestEvents()` is still exported and
unchanged, so the sender can go back to the single list with a one-line change.
