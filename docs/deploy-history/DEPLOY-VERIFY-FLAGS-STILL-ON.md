# Deploy — a flagged run dropped out of triage while staying live

**Date:** 10 November 2026 · **Files:** `lib/verify-flags.ts`, `lib/__tests__/verify-flags.test.ts`
**Two changes:** the window predicate, and the date label the widening made reachable.
**Schema:** none. **Data:** none. One SQL predicate.

The last start-only predicate in this chain that is arguably a defect. Not a page — the
**reader-report and verify triage path**, which feeds the Monday ops digest and
`/admin?status=flagged`.

---

## What was wrong

```sql
and e.start_at >= now()
```

A **start** question, in a query whose own docstring says the set is "live, upcoming, and
flagged". A listing that **opened before today and is still on** fell out of triage while
remaining `status = 'published'` on the site.

A `cancelled` verdict on a run is precisely the honest-data failure the file's own ranking
exists to surface — `flagRank` puts `cancelled` second only to `wrong_event`, because "a
cancelled event still on the site is the honest-data failure this project exists to avoid".
On a run, that flag could sit unseen for the length of the run.

---

## Measured, 10 November 2026

**Nothing was hidden on the day of the fix.** `openVerifyFlags()` returned **71** rows before
and **71** after; the newly-visible set was **0**, and nothing was lost (the new predicate is a
strict superset). That is the honest headline.

What makes it worth fixing is the shape that admits it, not a count of victims:

| | |
|---|---|
| distinct listings that have ever carried a verify flag | **846** |
| of those, listings that are **runs** | **240** (28%) |
| flags whose verdict was `cancelled` or `wrong_event` | **277** |
| published rows underway right now | **17** |
| longest live run | **333 days** (`Collection in Focus: Martine Syms`) |

So the verify pass flags runs routinely, the dangerous verdicts are common, and the window a
hidden flag could persist for is most of a year. One flag on one of today's 17 underway runs
is all it takes.

The one flag ever raised on a row underway today — `not_found` on *Dr. Seuss's How the Grinch
Stole Christmas!*, 22 October — was legitimately closed by a re-verification on 29 October, so
it is correctly absent.

---

## What shipped

```sql
and greatest(e.start_at, e.end_at, e.multi_day_end) >= now()
```

**`greatest()`, not `coalesce()`,** and that distinction is the whole care in this one-line
change. `lib/event-view.ts` `isEnded` takes the **latest** of start / end / multiDayEnd. A bare
`coalesce(multi_day_end, end_at, start_at)` instead *prefers* `multi_day_end` even when it is
not later than the start — the latent disagreement `lib/events.ts:305` documents at length, and
the shape `lib/trending.ts:126` still carries. Postgres `greatest()` ignores NULLs, so this is
`isEnded`'s rule expressed in SQL, and `lib/upsert.ts` already uses `greatest()` over these same
three columns for the same reason.

---

## And the label the widening made reachable

**Sixth time in this chain that a widened filter met a label written for the narrow set.**
`day` was `to_char(e.start_at …)`, and `lib/ops-inputs.ts:196` prints it straight into the
operator email. The moment runs became eligible, a cancelled exhibition would have arrived as:

```
cancelled: "Monsters on Vacation" @ Minnesota Children's Museum · May 23
```

— a date months past for something still on, and useless for the operator's actual question,
which is whether the listing is still live. A run now states its span:

```
cancelled: "Monsters on Vacation" @ Minnesota Children's Museum · May 23 – Jan 10
```

Deliberately **not** a port of `multiDayLabel`, which collapses a same-month span to
"Oct 19 – 23". This is one line in an operator email; repeating the month is clearer there
than teaching SQL a display rule, and nothing compares the two strings.

---

## Verification

Source-text tests cannot run SQL, so the predicate was also exercised against the live
database directly:

- `openVerifyFlags()` → **71 rows**, `openVerifyFlagIds()` → 71 ids, no row missing
  `id`/`title`/`day`
- the `day` expression run over the longest live runs returns `Jun 25 – May 23`,
  `May 23 – Jan 10`, `Aug 15 – Feb 28`; single-day rows still return `Nov 08`
- ranking intact: the first three verdicts are `wrong_event`, `wrong_event`, `wrong_event`
- the widened query returns a strict superset of the old one — **0 lost**

### Mutation

| mutation | tests that failed |
|---|---|
| back to `e.start_at >= now()` | 2 |
| to a bare `coalesce(multi_day_end, end_at, start_at)` | 2 |
| `day` back to the start day alone | 1 |

One of the new tests **failed on its own explanation** first: a blunt
`expect(src).not.toContain("coalesce(multi_day_end")` matched the docstring where the coalesce
form is *named in order to reject it*. It is now scoped to the `WHERE` clause.

### Quality gate

| | |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` | **3,383 passed in 156 files** |
| `npm run build` | clean, 637 pages |
| `npm audit` | **0 vulnerabilities** |

---

## Deploy

```bash
git add lib/verify-flags.ts lib/__tests__/verify-flags.test.ts docs/deploy-history/DEPLOY-VERIFY-FLAGS-STILL-ON.md
git commit -m "fix — a flagged run dropped out of triage while staying live"
git push
```

Nothing is observable on the public site. The verification is **the Monday ops digest**: its
open-flag count should be unchanged at 71 unless the Sunday research or Monday verify pass
raises a flag on a run, which is now the point.

## Rollback

`git revert`. One predicate in one query, and its two source tests. No schema, no data, no
signature change.

---

## Left open

- **All-day rows are compared by instant, not by day.** `isEnded` treats an all-day row as over
  only once the *day* has passed; this query compares timestamps, so an all-day row flagged
  today reads as over from 00:01. **Measured at 0 rows today**, and it is unchanged by this
  commit — the old predicate excluded them identically — so it is a pre-existing gap, named
  rather than fixed inside a one-line change.
- **`lib/trending.ts:126`** still carries the bare `coalesce(e.multi_day_end, e.end_at,
  e.start_at) >= now()` form. Same latent disagreement with `isEnded`, on a reader-facing
  surface, unmeasured here.
- **`lib/day-order.ts:47`** sorts the day page's in-cap ongoing group by title while the "Also
  running" shelf beside it sorts ending-soonest — the last ordering that disagrees with
  `lib/ongoing.ts`'s stated rule.
