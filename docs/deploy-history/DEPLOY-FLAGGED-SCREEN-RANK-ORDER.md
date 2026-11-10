# Deploy — the flagged screen buried the listings a venue calendar contradicts

**Date:** 10 November 2026 · **Files:** `lib/verify-flags.ts`, `lib/admin.ts`, and their tests
**Schema:** none. **Data:** none. Two orderings.

Found by the review of [DEPLOY-VERIFY-FLAGS-STILL-ON.md](DEPLOY-VERIFY-FLAGS-STILL-ON.md).
`lib/verify-flags.ts` exists so the Monday email and `/admin?status=flagged` cannot disagree
about **which** listings are flagged. They still disagreed about **which matter**.

---

## What was wrong

### The screen threw the ranking away

```ts
order by ${flaggedOnly ? sql`start_at asc` : sql`created_at desc`}
```

`openVerifyFlagIds()` returns ids the email has already ranked — `flagRank` puts `wrong_event`
first, because the venue's own calendar contradicting us is the strongest negative the pass
produces, and `cancelled` second, because "a cancelled event still on the site is the
honest-data failure this project exists to avoid". The screen sorted by date and lost all of it.

**Measured 10 November 2026** — 71 open flags: 4 `wrong_event`, 30 `unproven`, 17 `not_found`,
14 `moved`, 5 `weak_source`, 1 `wrong_year`.

| | |
|---|---|
| where the four `wrong_event` sat | positions **7, 19, 33, 45** of 71 |
| what the screen opened on | `unproven, not_found, unproven, not_found, moved, unproven` |
| what the email led with | all four `wrong_event` |

So the operator scrolled past six rows, under thirty `unproven`, to reach the first listing a
venue calendar actually contradicts.

### And the email's examples were arbitrary within a verdict

The helper sorted by rank alone:

```ts
return [...rows].sort((x, y) => flagRank(x.verdict) - flagRank(y.verdict));
```

`Array.sort` is stable, so that preserved whatever the query produced underneath — and the query
is `distinct on (e.id) … order by e.id`, i.e. **UUID order**. The Monday email prints the first
four as examples, so *which* four it printed was effectively arbitrary within a verdict, and two
runs over the same data could not be told apart. That is not a defect anyone reported; it is one
the extraction below made visible.

---

## What shipped

**One comparator, exported and tested by behaviour:**

```ts
export function byDanger(a: OpenVerifyFlag, b: OpenVerifyFlag): number {
  return (
    flagRank(a.verdict) - flagRank(b.verdict) ||
    a.start.localeCompare(b.start) ||
    a.title.localeCompare(b.title)
  );
}
```

Most dangerous verdict, then soonest, then title. `OpenVerifyFlag` gains a sortable `start`
(the display field `day` is `"Mon DD"` or `"Mon DD – Mon DD"`, which does not sort).

**And the screen replays that order instead of discarding it:**

```sql
order by array_position(${flaggedIds}::uuid[], id)
```

That also fixes **which rows the limit drops**: truncating a rank-ordered list loses the least
dangerous, where truncating a date-ordered one lost whatever happened to be latest. Today 71 < 100,
so nothing truncates either way.

---

## Verification

### Against the live database

| | before | after |
|---|---|---|
| first six on the screen | `unproven, not_found, unproven, not_found, moved, unproven` | `wrong_event ×4`, then `unproven`, `not_found` |
| scroll to the first most-dangerous row | position **7** of 71 | position **1** |
| email and screen agree on the first six | no | **yes** |

### The operator email, dry run

```
- 71 listings the verify pass flagged, still live → /admin?status=flagged
-     wrong_event: "Nickelodeon Universe Winter Break – Universe" @ … · Nov 12 – Dec 31
-     wrong_event: "MercyMe" @ Target Center · Nov 15
-     wrong_event: "Dax - The Anger Management Tour" @ Varsity Theater · Nov 19
-     wrong_event: "Follow the Firefly Album Release" @ The Hook and Ladder · Nov 21
```

All four `wrong_event`, soonest first — and deterministic, which they were not before.

### Mutation

| mutation | tests that failed |
|---|---|
| `byDanger` drops the rank clause | 2 |
| `byDanger` drops the start tiebreak | 1 |
| `byDanger` drops the title tiebreak | 1 |
| the screen back to `start_at asc` | 1 |

### Quality gate

| | |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` | **3,392 passed in 156 files** |
| `npm run build` | clean, 637 pages |
| `npm audit` | **0 vulnerabilities** |

---

## A test of mine broke on its own prose, again

`byDanger`'s docstring contains the literal `order by e.id` — explaining the UUID order it
replaces. An existing assertion sliced the source between the **first** `"from admin_audit"` and
the **first** `"order by e.id"` to isolate a `WHERE` clause, and those markers had moved, so it
silently measured an empty string and failed.

That is the **second** time in two commits that a whole-file offset made a source test measure
the wrong region — the first was a `not.toContain` matching the docstring that named the form it
rejected. Both assertions are now scoped by **function** rather than by first-occurrence.

---

## Deploy

```bash
git add lib/verify-flags.ts lib/admin.ts lib/__tests__/verify-flags.test.ts docs/deploy-history/DEPLOY-FLAGGED-SCREEN-RANK-ORDER.md
git commit -m "fix — the flagged screen buried the listings a venue calendar contradicts"
git push
```

Nothing is observable on the public site. Verify on `/admin?status=flagged` (sign-in required):
the first rows should be the `wrong_event` listings, matching the Monday email's examples.

## Rollback

`git revert`. One comparator, one `order by`, one added interface field. No schema, no data.

---

## Left open

- **`lib/ops-inputs.ts:247`**, the contradictions self-check, is still start-only — a still-on
  run is dropped from the duplicate/conflict scan, which is the instrument the *live duplicate
  freeze* incident turned on. Unmeasured, and the most interesting of the remainder.
- **`lib/ops-inputs.ts:121`** (`never_upcoming`) is start-only.
- **`lib/trending.ts:126`** carries the bare `coalesce(multi_day_end, end_at, start_at)` form,
  reader-facing.
- **`lib/day-order.ts:47`** sorts the day page's in-cap ongoing group by title while the "Also
  running" shelf beside it sorts ending-soonest.
