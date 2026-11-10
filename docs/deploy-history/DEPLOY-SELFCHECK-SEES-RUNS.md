# Deploy — the duplicate detector was blind to the rows most likely to be duplicates

**Date:** 10 November 2026 · **Files:** `lib/ops-inputs.ts`, and tests in
`lib/__tests__/contradictions.test.ts`
**Schema:** none. **Data:** none. One SQL predicate.

The self-check is the Monday email's only no-outside-source instrument, and its own comment says
a duplicate pair with **both rows live** is "the one the write gate skips as the panel's
problem… so this line is the only place it is ever reported."

It fed `findContradictions` this:

```sql
from events where status = 'published' and start_at >= now()
```

A **start** question. Every run already underway was absent — and a run is the shape most likely
to *be* a duplicate, because [a long run mints a new row on each weekly
re-find](DEPLOY-RUN-REFIND-FOLD.md). **The detector was blind to exactly the rows that produce
the problem it exists to find.**

---

## Measured before changing anything

| | start-only | still-on |
|---|---|---|
| rows fed in | 683 | **701** (+18) |
| conflicts | 1 | **2** |
| duplicates | 0 | 0 |
| placeholder venues | 0 | 0 |

**One new finding. Zero false positives.** And the new one is real:

```
2026-05-23 · Minnesota Children's Museum (St Paul) (both 09:00):
  "Beach Monster Exhibit" / "Monsters on Vacation"
```

That pair is already on the record. [DEPLOY-VERIFY-YEAR-GATE.md](DEPLOY-VERIFY-YEAR-GATE.md)
judged it **one exhibit under two names** — the museum runs *Monsters on Vacation*, and
`Beach Monster Exhibit` is "a roundup writer's paraphrase… promoted to a title" with an end date
"attested nowhere" — and left it alone deliberately, because every move is a product call on a
live listing. It has been live since May. The instrument meant to surface it never could.

### Why it does not flood

`CONCURRENT_VENUES` already exempts the rooms that run concurrent programming by design — the
Walker, Mia, the Science Museum, the zoos, the Mall. Their overlapping exhibitions produce no
conflict even when they open on the same day. The Children's Museum is not on that list, and the
one finding that surfaced there is genuine. That is the whole reason +18 rows produced +1
finding rather than a page of noise.

### And it is classified as a conflict, not a duplicate

`looksLikeSameEvent("Beach Monster Exhibit", "Monsters on Vacation", …)` is false — the titles
are not similar — so it lands in `conflicts`, via the `apart === 0` escape: one room cannot
begin two *different* things at one instant, however well sourced each is. So the precise claim
is that the self-check could not **see runs at all**, not that it had a duplicate it mislabelled.

---

## What shipped

```sql
from events where status = 'published'
  and greatest(start_at, end_at, multi_day_end) >= now()
```

The same rule `isEnded` applies and the same one the open-flag queries adopted this week.

**No label change was needed here**, unlike the five widenings before it. The grouping key is
`roomKey|start day`, and for these rows that day *is* the finding — "both of these began on
23 May at the same minute". It is content, not a stale caption. I checked rather than assumed,
because the previous five all needed one.

---

## Verification

### The operator email, dry run

```
## Self-check ⚠️
-     2026-05-23 · Minnesota Children's Museum (St Paul) (both 09:00): "Beach Monster Exhibit" / "Monsters on Vacation"
```

The section carries the alert marker, so this reaches Taren on Monday rather than sitting in a
count.

### Mutation

| mutation | tests that failed |
|---|---|
| the self-check back to `start_at >= now()` | 1 |

### Quality gate

| | |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` | **3,397 passed in 156 files** |
| `npm run build` | clean, 637 pages |
| `npm audit` | **0 vulnerabilities** |

---

## A third source test of mine measured an empty string

The new assertion sliced `ops-inputs.ts` between a guessed whitespace anchor and another marker.
The anchor did not match, the slice was `""`, and `expect("").toContain(…)` failed — this time
loudly, but the same mistake has twice failed *silently* in the other direction, because an
empty string satisfies every `not.toContain`.

Both the slice and a **guard that the slice is non-empty** are now in the suite. That guard
would have caught all three.

---

## Deploy

```bash
git add lib/ops-inputs.ts lib/__tests__/contradictions.test.ts docs/deploy-history/DEPLOY-SELFCHECK-SEES-RUNS.md
git commit -m "fix — the duplicate detector could not see a run"
git push
```

Nothing is observable on the public site. The verification is **the Monday ops digest**: the
Self-check section should carry the Children's Museum pair.

## Rollback

`git revert`. One predicate. No schema, no data.

---

## Left open

- **The Children's Museum pair is still live, and now it is reported.** Resolving it — which
  title wins, whether the end date stands, which row is archived — is the product call
  `DEPLOY-VERIFY-YEAR-GATE.md` left to Taren. This change only ends the silence.
- **`lib/ops-inputs.ts:121`** (`never_upcoming`) is still start-only.
- **`lib/trending.ts:126`** carries the bare `coalesce(multi_day_end, end_at, start_at)` form,
  reader-facing.
- **`lib/day-order.ts:47`** sorts the day page's in-cap ongoing group by title while the "Also
  running" shelf beside it sorts ending-soonest.
