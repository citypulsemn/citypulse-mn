# Deploy R2.6 — schema drift guard (the test that would have caught R0.4)

*July 20, 2026 (late evening). Roadmap v5 sprint R2, item 6. Pure test
infrastructure — no runtime code changes at all.*

## What shipped

**New: [lib/__tests__/schema-drift.test.ts](../../lib/__tests__/schema-drift.test.ts).**
R0.4's bug — an insert writing `saver_token` where `saved_events`' column is
`user_token` — 500'd the flagship restore-merge for its whole life because
nothing compared the SQL in `lib/` against `db/schema.sql`. Now something does:

1. **Parse** `db/schema.sql` into table → column sets (create-table blocks plus
   additive `alter table … add column` lines, comments stripped — the
   commented-out `geom` line is correctly ignored).
2. **Sweep** `lib/ app/ scripts/` source text for the unambiguous SQL shapes:
   `insert into t (col, …)`, `on conflict (col)` + its `do update set` list,
   `update t set col = …`, and single-table `where col =`.
3. **Assert** every referenced column exists in the schema.

**Deliberately dumb and conservative** (per the roadmap): CTE names, joined or
aliased queries, and expression fragments are skipped, never guessed at. An
empty `ALLOW` set stands ready for legitimate dynamic fragments, each requiring
a note. Meta-tests pin the parser itself, so if `schema.sql`'s formatting ever
changes shape, the guard fails loudly instead of going silently blind.

## Verification (observed, not intended)

- The sweep sees **109 column references across 16 files** — the count is baked
  into the test name and floor-asserted (≥25) so regex rot shows as a
  collapsing number, not silence.
- **Live mutation test:** planted `usr_token` into the real
  `lib/saved-restore.ts` insert → the guard failed with the exact
  file/table/column named → reverted. The R0.4 class now dies in CI.
- Canary fixtures: the literal R0.4 typo (`saver_token` into `saved_events`)
  flagged; the corrected form quiet.
- Gate: tsc clean · 677/677 (+6) · build clean · audit 0.

## Deploy steps

Push to `main`. Tests only — zero runtime surface.

## Maintenance notes

- New table or column? Add it to `db/schema.sql` (as always) — the guard learns
  it automatically.
- A false positive from a dynamic fragment? Add `"file|table.column"` to
  `ALLOW` with a comment saying why.

## Rollback

`git revert` (or just delete the test file — nothing depends on it).
