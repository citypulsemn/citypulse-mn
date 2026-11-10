# Deploy — the music-review queue reported 0 while hiding a listing permanently

**Date:** 10 November 2026 · **Files:** `lib/verify-flags.ts`, `lib/ops-inputs.ts`, and their tests
**Schema:** none. **Data:** none.

Found by the review of [DEPLOY-VERIFY-FLAGS-STILL-ON.md](DEPLOY-VERIFY-FLAGS-STILL-ON.md), **six
lines above the call that guide had just fixed**. The guide claimed that fix was "the last
start-only predicate in this chain that is arguably a defect"; the counter-example was on screen
the whole time.

---

## What was wrong

```sql
where a.action = 'import_music_review'
  and e.status = 'published'
  and e.verified_at is null          -- no after-stamp clause
  and e.start_at >= now()
```

The same shape as `openVerifyFlags`, over the same two tables, one `a.action` value over — and
still computed **inline** in `lib/ops-inputs.ts`, which is exactly the arrangement
`lib/verify-flags.ts` was created to end.

The missing clause is the one its own docstring calls **"the whole point"** and **"the most
dangerous flag there is"**: a flag raised *after* a stamp is still open. Without
`or a.at > e.verified_at`, it vanishes.

### Here it is worse than it was for verify flags

`scripts/import-venues.ts` makes the hole permanent:

- it stamps `verified_at = now()` on every row it matched (`:298`, `:354`)
- it inserts the review flag **only `where not exists`** a prior one for that event (`:285`) —
  deliberately, because "a flag is a standing note that this row needs a person, not a log line"

So the ordinary life of the flag is: matched and stamped in run *N* → the calendar re-spells or
drops the listing in run *N+1* → the **first** flag is inserted with `a.at` **after** the stamp
→ a count keyed on `verified_at is null` never sees it, **and no fresher flag row can ever
arrive to make it visible.** Invisible permanently, by the common path.

The digest line is gated on `> 0`, so the operator saw **nothing at all** — not a wrong number,
an absent line.

---

## Measured, 10 November 2026

| | |
|---|---|
| the queue as shipped | **0** |
| with the after-stamp clause | **1** |
| listings ever flagged this way | 21 |
| of those, flagged *after* a stamp | **1** |
| additionally hidden by the start-only window | **0** |

That last row matters, and it corrects the emphasis the review itself led with: the start-only
half costs **nothing** here, because this importer mints rows with no `end_at` and no
`multi_day_end`, so `greatest(…)` equals `start_at` for its whole population. The real defect
was the after-stamp clause alone. The still-on window is included anyway, for one rule rather
than two.

---

## What shipped

The rule gets its **third reader in its one home** rather than a fourth hand-rolled copy:

```ts
export async function openFlagCount(action: string): Promise<number>
```

`lib/ops-inputs.ts` now calls `openFlagCount("import_music_review")`. The action is a **bound
parameter**, not string-built SQL.

`lib/verify-flags.ts`'s title changes from *"OPEN VERIFY FLAGS — one definition, two readers"*
to *"OPEN AUDIT FLAGS — one definition, three readers"*, and its docstring records that it had
three all along.

---

## Verification

### Against the live database

| call | result |
|---|---|
| `openFlagCount("import_music_review")` | **1** (0 as shipped) |
| `openFlagCount("verify_flag")` | **71** |
| `openVerifyFlags().length` | **71** |
| `openFlagCount("no_such_action")` | 0 |

The third and fourth rows are the point: the generic count and the specialised row query
**agree exactly**, which is the single-home property this file exists for, now provable rather
than asserted.

### The operator email, dry run

```
- 1 music listing a venue calendar disagrees with → /admin
- 71 listings the verify pass flagged, still live → /admin?status=flagged
```

The first line did not appear at all before this change.

### Mutation

| mutation | tests that failed |
|---|---|
| drop the after-stamp clause from `openFlagCount` | 1 |
| revert the digest to its inline query | 1 |

### Quality gate

| | |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` | **3,387 passed in 156 files** |
| `npm run build` | clean, 637 pages |
| `npm audit` | **0 vulnerabilities** |

---

## Deploy

```bash
git add lib/verify-flags.ts lib/ops-inputs.ts lib/__tests__/verify-flags.test.ts docs/deploy-history/DEPLOY-MUSIC-REVIEW-QUEUE-AFTER-STAMP.md
git commit -m "fix — the music-review queue reported 0 while hiding a listing"
git push
```

Nothing is observable on the public site. The verification is **the Monday ops digest**: the
Queue section should now carry a "1 music listing a venue calendar disagrees with" line that was
absent before.

## Rollback

`git revert`. One new exported function and one call site. No schema, no data.

---

## Left open — and this time with the grep behind it

- **`/admin?status=flagged` discards `flagRank`.** `lib/admin.ts:162` orders `start_at asc`,
  and `openVerifyFlagIds()` drops the ranking the email applies. Measured: the screen opens on
  `unproven, not_found, unproven, not_found, moved` while the email leads with three
  `wrong_event`. Not fixed here.
- **`lib/ops-inputs.ts:121` (`never_upcoming`) and `:247` (the contradictions self-check)** are
  both still start-only. The second is the interesting one: a still-on run is dropped from the
  duplicate/conflict scan, which is the instrument the *live duplicate freeze* incident turned
  on. Unmeasured.
- **`lib/trending.ts:126`** still carries the bare `coalesce(multi_day_end, end_at, start_at)`
  form, reader-facing.
- **`lib/day-order.ts:47`** sorts the day page's in-cap ongoing group by title.
- The intake, sweep and "upcoming" counts in `lib/admin.ts:254`, `lib/ops-inputs.ts:111/:247`,
  `scripts/verify-events.ts`, `scripts/run-pipeline.ts` and `scripts/import-venues.ts:190` ask a
  start question **on purpose**; calling them defects would be its own overclaim.
