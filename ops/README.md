# ops/

One-off and scheduled operator SQL.

- `COLLAPSE-1.1.sql` — **ran Jul 16, verified Jul 20** (STEP 0 zero rows; all 159 targets archived; `collapse_backup_20260716` in place). Kept for the record + rollback. The ~14 conflicting events its guide flagged were resolved with web evidence Jul 20 (see `docs/deploy-history/DEPLOY-VERIFY-PASS-20260720.md`).
- `sql-history/` — previously executed one-off operations, kept for reference on how similar problems were handled (dedupe, time fixes, reclassification, moderation).

Rule for anything in here: back up first, run the pre-flight, check the count, and never delete an event — archive it.
